// "Ask Bale to Brick": the voice assistant. The browser does speech-to-text and text-to-speech;
// this route answers. It reads the person's own live data (auctions, bids, deals, payments) so the
// answer is about *their* marketplace, then:
//   1. asks Gemini (or Gemma offline) for a short spoken answer + an optional page to open, or
//   2. if no AI is configured or it fails, answers with a built-in bilingual intent engine.
// Either way the reply only uses facts from the database; numbers are never invented.
const express = require('express');
const jwt = require('jsonwebtoken');
const { db } = require('./db');
const { SECRET, limiter } = require('./auth');
const ai = require('./google/ai');
const payments = require('./payments');
const { lowestSeries } = require('./auction');
const { CROPS } = require('./constants');

const router = express.Router();
const TZ = Number(process.env.TZ_OFFSET_MIN ?? 330);
const today = () => new Date(Date.now() + TZ * 60000).toISOString().slice(0, 10);
const daysTo = (d) => Math.round((Date.parse(d + 'T00:00:00Z') - Date.parse(today() + 'T00:00:00Z')) / 86400000);
const crop = (k) => (CROPS[k] ? CROPS[k].label.replace(/ \(.*\)/, '').toLowerCase() : k);
const cropHi = { paddy: 'धान की पराली', wheat: 'गेहूँ का भूसा', sugarcane: 'गन्ने की पत्तियाँ', cotton: 'कपास की डंठल', maize: 'मक्का की डंठल', mustard: 'सरसों की डंठल', other: 'अवशेष' };
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');

// Logged-in user if a valid token is sent; visitors can still ask general questions.
function optionalUser(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    const { sub } = jwt.verify(h.slice(7), SECRET);
    return db.prepare('SELECT id, role, name, company, state, district FROM users WHERE id = ?').get(sub) || null;
  } catch { return null; }
}

const ROUTES = {
  any: { home: '#/', track: '#/track', payments: '#/payments', deals: '#/deals', profile: '#/profile', tech: '#/tech' },
  visitor: { home: '#/', how: '#/how-it-works', login: '#/login/farmer', register: '#/register/farmer', tech: '#/tech' },
  buyer: { marketplace: '#/buyer/find', auctions: '#/buyer/auctions', dashboard: '#/buyer/jobs' },
  operator: { jobs: '#/operator/jobs', bids: '#/operator/bids' },
  farmer: { dashboard: '#/farmer', post: '#/farmer/new' },
};
const routesFor = (u) => (u ? { ...ROUTES.any, ...ROUTES[u.role] } : ROUTES.visitor);

/* ───────────── what the assistant knows about this person ───────────── */
function context(u) {
  if (!u) return { role: 'visitor' };
  const c = { role: u.role, name: u.name, company: u.company, state: u.state, district: u.district, today: today() };
  const col = { farmer: 'd.farmer_id', buyer: 'd.buyer_id', operator: 'd.operator_id' }[u.role];
  c.deals = db.prepare(
    `SELECT d.id, d.status, d.price_total, d.due_date, l.acres, l.crop, l.district,
            (SELECT status FROM payments p WHERE p.deal_id = d.id AND p.kind = 'escrow') AS escrow
       FROM deals d JOIN listings l ON l.id = d.listing_id WHERE ${col} = ? ORDER BY d.id DESC LIMIT 8`
  ).all(u.id).map((d) => ({ ...d, days_left: daysTo(d.due_date) }));

  if (u.role === 'buyer') {
    c.auctions = db.prepare(
      `SELECT r.id, r.budget_total, r.needed_by, l.acres, l.crop, l.district,
              (SELECT COUNT(*) FROM bids b WHERE b.requirement_id = r.id AND b.status = 'active') AS bids,
              (SELECT MIN(price_total) FROM bids b WHERE b.requirement_id = r.id AND b.status = 'active') AS lowest
         FROM requirements r JOIN listings l ON l.id = r.listing_id WHERE r.buyer_id = ? AND r.status = 'open'`
    ).all(u.id).map((a) => {
      const best = db.prepare(
        `SELECT COALESCE(u.company, u.name) AS who, b.days FROM bids b JOIN users u ON u.id = b.operator_id
          WHERE b.requirement_id = ? AND b.status = 'active' ORDER BY b.price_total, b.days LIMIT 1`
      ).get(a.id);
      const h = lowestSeries(a.id);
      return { ...a, best_operator: best?.who || null, best_days: best?.days || null, days_left: daysTo(a.needed_by),
        drop_pct: h.first_bid && a.lowest ? Math.round(((h.first_bid - a.lowest) / h.first_bid) * 100) : 0 };
    });
    c.payment_due = c.deals.filter((d) => d.status === 'sealed' && !d.escrow).map((d) => ({ deal: d.id, total: payments.breakdown(d.id).total }));
  }
  if (u.role === 'operator') {
    c.open_jobs = db.prepare(
      `SELECT r.id, r.budget_total, r.needed_by, l.acres, l.crop, l.district, l.state,
              (SELECT MIN(price_total) FROM bids b WHERE b.requirement_id = r.id AND b.status = 'active') AS lowest,
              (SELECT price_total FROM bids b WHERE b.requirement_id = r.id AND b.operator_id = ? AND b.status = 'active') AS my_bid
         FROM requirements r JOIN listings l ON l.id = r.listing_id
        WHERE r.status = 'open' AND r.needed_by > ? ORDER BY (l.state = ?) DESC, r.needed_by LIMIT 6`
    ).all(u.id, today(), u.state);
    c.my_bids = db.prepare(
      `SELECT b.requirement_id AS job, b.price_total, b.days, l.acres, l.district,
              (SELECT COUNT(*) + 1 FROM bids x WHERE x.requirement_id = b.requirement_id AND x.status = 'active'
                 AND (x.price_total < b.price_total OR (x.price_total = b.price_total AND x.days < b.days))) AS rank,
              (SELECT COUNT(*) FROM bids x WHERE x.requirement_id = b.requirement_id AND x.status = 'active') AS of
         FROM bids b JOIN requirements r ON r.id = b.requirement_id JOIN listings l ON l.id = r.listing_id
        WHERE b.operator_id = ? AND b.status = 'active'`
    ).all(u.id);
  }
  if (u.role === 'farmer') {
    c.listings = db.prepare('SELECT id, crop, acres, status, clear_by FROM listings WHERE farmer_id = ? ORDER BY id DESC LIMIT 8').all(u.id);
  }
  if (u.role !== 'buyer') {
    const share = u.role === 'operator' ? 'operator' : 'farmer';
    const rows = db.prepare(`SELECT p.meta_json FROM payments p JOIN deals d ON d.id = p.deal_id WHERE ${col} = ? AND p.kind = 'escrow' AND p.status = 'held'`).all(u.id);
    c.money_in_escrow = rows.reduce((a, r) => a + (JSON.parse(r.meta_json || '{}')[share] || 0), 0);
    c.money_received = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE to_user = ? AND kind LIKE 'payout_%'").get(u.id).s;
  }
  return c;
}

/* ───────────── built-in intent engine (works with no AI key, Hindi + English) ───────────── */
const has = (text, words) => words.some((w) => text.includes(w));
const W = {
  open: ['open', 'show', 'go to', 'take me', 'kholo', 'khol', 'dikhao', 'dikha', 'le chalo', 'chalo', 'खोलो', 'खोल', 'दिखाओ', 'दिखा', 'ले चलो', 'जाओ'],
  auction: ['auction', 'neelami', 'nilami', 'नीलामी', 'reverse'],
  bid: ['bid', 'boli', 'बोली', 'offer'],
  lowest: ['lowest', 'cheapest', 'best', 'sabse kam', 'सबसे कम', 'सस्ता', 'kam se kam'],
  track: ['track', 'status', 'where', 'progress', 'kahan', 'kaha', 'कहाँ', 'कहां', 'ट्रैक', 'order', 'ऑर्डर', 'pragati', 'प्रगति'],
  pay: ['pay', 'payment', 'escrow', 'paisa', 'paise', 'money', 'bhugtan', 'भुगतान', 'पैसा', 'पैसे', 'एस्क्रो', 'refund'],
  deal: ['deal', 'sauda', 'सौदा', 'सौदे'],
  market: ['marketplace', 'land', 'zameen', 'jameen', 'ज़मीन', 'जमीन', 'find', 'khet', 'खेत'],
  post: ['post', 'list my', 'sell', 'bechna', 'बेच', 'darj', 'दर्ज', 'parali', 'पराली', 'stubble'],
  jobs: ['job', 'kaam', 'काम', 'work'],
  how: ['how', 'kaise', 'कैसे', 'explain', 'samjhao', 'समझाओ', 'what is', 'kya hai', 'क्या है'],
  fee: ['fee', 'commission', 'charge', 'shulk', 'शुल्क'],
  hello: ['hello', 'hi ', 'hey', 'namaste', 'नमस्ते', 'namaskar', 'नमस्कार', 'sat sri akal'],
  help: ['help', 'madad', 'मदद', 'what can you', 'kya kar sakte'],
  burn: ['burn', 'fire', 'aag', 'आग', 'jala', 'जला', 'smoke', 'dhuan', 'धुआँ'],
};

function rulesAnswer(text, u, c, hi) {
  const q = ' ' + text.toLowerCase() + ' ';
  const R = routesFor(u);
  const L = (en, hiText) => (hi ? hiText : en);
  const wantsOpen = has(q, W.open);
  const nav = (key) => (R[key] ? R[key] : null);
  const cr = (k) => (hi ? cropHi[k] || k : crop(k));

  if (has(q, W.hello) && q.trim().split(/\s+/).length <= 4) {
    return { reply: L(`Hello${u ? ' ' + u.name.split(' ')[0] : ''}! Ask me about your auctions, bids, orders or payments, or say "open track".`,
      `नमस्ते${u ? ' ' + u.name.split(' ')[0] + ' जी' : ''}! अपनी नीलामी, बोली, ऑर्डर या भुगतान के बारे में पूछिए, या बोलिए "ट्रैक खोलो"।`) };
  }

  // Buyer: auctions and lowest bids
  if (u?.role === 'buyer' && (has(q, W.auction) || has(q, W.bid) || has(q, W.lowest))) {
    const a = c.auctions || [];
    if (!a.length) return { reply: L('You have no live auctions. Pick land on the marketplace to start one.', 'अभी आपकी कोई लाइव नीलामी नहीं है। मार्केटप्लेस पर ज़मीन चुनकर नई शुरू करें।'), navigate: nav('marketplace') };
    const parts = a.slice(0, 3).map((x) => (x.lowest
      ? L(`${x.acres} acres in ${x.district}: lowest bid ${inr(x.lowest)} from ${x.best_operator} in ${x.best_days} days, ${x.bids} bids, ${x.drop_pct}% below the first bid`,
        `${x.district} की ${x.acres} एकड़: सबसे कम बोली ${inr(x.lowest)}, ${x.best_operator} से, ${x.best_days} दिन में, कुल ${x.bids} बोलियाँ`)
      : L(`${x.acres} acres in ${x.district}: no bids yet`, `${x.district} की ${x.acres} एकड़: अभी कोई बोली नहीं`)));
    return { reply: L(`You have ${a.length} live auction${a.length > 1 ? 's' : ''}. `, `आपकी ${a.length} लाइव नीलामी है। `) + parts.join('. ') + '.', navigate: nav('auctions') };
  }
  // Operator: my bids / rank / jobs
  if (u?.role === 'operator' && (has(q, W.bid) || has(q, W.lowest))) {
    const b = c.my_bids || [];
    if (!b.length) return { reply: L('You have no active bids. Open jobs to place one.', 'अभी आपकी कोई सक्रिय बोली नहीं है। काम देखकर बोली लगाइए।'), navigate: nav('jobs') };
    const parts = b.slice(0, 3).map((x) => L(`${x.acres} acres in ${x.district}: your bid ${inr(x.price_total)}, rank ${x.rank} of ${x.of}`,
      `${x.district} की ${x.acres} एकड़: आपकी बोली ${inr(x.price_total)}, ${x.of} में से ${x.rank} नंबर`));
    return { reply: parts.join('. ') + '.', navigate: wantsOpen ? nav('bids') : null };
  }
  if (u?.role === 'operator' && has(q, W.jobs)) {
    const j = c.open_jobs || [];
    if (!j.length) return { reply: L('No open jobs right now.', 'अभी कोई खुला काम नहीं है।'), navigate: nav('jobs') };
    const x = j[0];
    return { reply: L(`${j.length} open jobs. Nearest deadline: ${x.acres} acres of ${cr(x.crop)} in ${x.district}, budget ${inr(x.budget_total)}${x.lowest ? `, lowest bid ${inr(x.lowest)}` : ', no bids yet'}.`,
      `${j.length} खुले काम हैं। सबसे जल्दी वाला: ${x.district} में ${x.acres} एकड़ ${cr(x.crop)}, बजट ${inr(x.budget_total)}${x.lowest ? `, सबसे कम बोली ${inr(x.lowest)}` : ', अभी कोई बोली नहीं'}।`), navigate: nav('jobs') };
  }
  // Payments
  if (has(q, W.pay) && !has(q, W.how)) {
    if (!u) return { reply: L('The buyer pays into escrow after a deal is sealed. The operator and farmer are paid when the farmer confirms the field is clear.', 'सौदा पक्का होने पर खरीदार एस्क्रो में पैसा जमा करता है। खेत साफ होने की पुष्टि पर ऑपरेटर और किसान को पैसा मिलता है।') };
    if (u.role === 'buyer') {
      const due = c.payment_due || [];
      const held = c.deals.filter((d) => d.escrow === 'held').length;
      return { reply: due.length
        ? L(`${due.length} deal${due.length > 1 ? 's are' : ' is'} waiting for your payment, total ${inr(due.reduce((a, x) => a + x.total, 0))}. ${held} payment${held === 1 ? ' is' : 's are'} held in escrow.`,
          `${due.length} सौदे आपके भुगतान का इंतज़ार कर रहे हैं, कुल ${inr(due.reduce((a, x) => a + x.total, 0))}। ${held} भुगतान एस्क्रो में सुरक्षित हैं।`)
        : L(`Nothing is due. ${held} payment${held === 1 ? ' is' : 's are'} held safely in escrow.`, `अभी कुछ देय नहीं है। ${held} भुगतान एस्क्रो में सुरक्षित हैं।`), navigate: nav('payments') };
    }
    return { reply: L(`You have received ${inr(c.money_received)} so far, and ${inr(c.money_in_escrow)} is held in escrow for you until the farmer confirms.`,
      `अब तक आपको ${inr(c.money_received)} मिल चुके हैं, और ${inr(c.money_in_escrow)} एस्क्रो में आपके लिए सुरक्षित हैं।`), navigate: nav('payments') };
  }
  // Order tracking / deals
  if (has(q, W.track) || has(q, W.deal)) {
    if (!u) return { reply: L('Log in to track your orders.', 'अपने ऑर्डर ट्रैक करने के लिए लॉग इन करें।'), navigate: nav('login') };
    const live = c.deals.filter((d) => !['completed', 'cancelled'].includes(d.status));
    if (!live.length) return { reply: L(`No order is running right now. ${c.deals.filter((d) => d.status === 'completed').length} deals are completed.`, `अभी कोई ऑर्डर चालू नहीं है। ${c.deals.filter((d) => d.status === 'completed').length} सौदे पूरे हो चुके हैं।`), navigate: nav('track') };
    const st = { sealed: L('sealed, waiting to start', 'पक्का, काम शुरू होना बाकी'), in_progress: L('work in progress', 'काम चल रहा है'), awaiting_confirmation: L('waiting for the farmer to confirm', 'किसान की पुष्टि का इंतज़ार') };
    const parts = live.slice(0, 3).map((d) => L(`Order ${d.id}, ${d.acres} acres in ${d.district}: ${st[d.status]}, due in ${d.days_left} days`,
      `ऑर्डर ${d.id}, ${d.district} की ${d.acres} एकड़: ${st[d.status]}, ${d.days_left} दिन बाकी`));
    return { reply: parts.join('. ') + '.', navigate: live.length === 1 ? `#/track/${live[0].id}` : nav('track') };
  }
  if (u?.role === 'farmer' && (has(q, W.post) || has(q, W.market))) {
    const open = (c.listings || []).filter((l) => ['open', 'claimed', 'assigned'].includes(l.status));
    return { reply: L(`You have ${open.length} active listing${open.length === 1 ? '' : 's'}. Opening the form to post new land. You can speak the details there too.`,
      `आपकी ${open.length} ज़मीन सक्रिय है। नई ज़मीन दर्ज करने का फ़ॉर्म खोल रहा हूँ, वहाँ भी बोलकर भर सकते हैं।`), navigate: nav('post') };
  }
  if (u?.role === 'buyer' && has(q, W.market)) {
    return { reply: L('Opening the marketplace. Land is ranked by how well it matches your preferences.', 'मार्केटप्लेस खोल रहा हूँ। ज़मीन आपकी पसंद के हिसाब से क्रम में दिखेगी।'), navigate: nav('marketplace') };
  }
  if (has(q, W.fee)) {
    return { reply: L(`The platform fee is ${payments.FEE_PCT}% of the order, added to the buyer's escrow payment. Farmers and operators pay nothing.`, `प्लेटफ़ॉर्म शुल्क ऑर्डर का ${payments.FEE_PCT}% है, जो खरीदार के एस्क्रो भुगतान में जुड़ता है। किसान और ऑपरेटर से कुछ नहीं लिया जाता।`) };
  }
  if (has(q, W.burn)) {
    return { reply: L('Instead of burning, the farmer lists the stubble. Operators bale it and a brick kiln uses it as fuel. A satellite check confirms no fire on the field.', 'जलाने की जगह किसान पराली दर्ज करता है। ऑपरेटर गठ्ठे बनाते हैं और ईंट भट्ठा उसे ईंधन बनाता है। सैटेलाइट जाँच से पक्का होता है कि खेत में आग नहीं लगी।') };
  }
  if (has(q, W.how) || has(q, W.auction)) {
    return { reply: L('Farmers list land with stubble. A buyer picks it and sets a budget. Operators bid the price down in a reverse auction. The buyer accepts a bid, pays into escrow, and money is released once the field is clear.',
      'किसान पराली वाली ज़मीन दर्ज करता है। खरीदार उसे चुनकर बजट तय करता है। ऑपरेटर रिवर्स नीलामी में कीमत घटाते हैं। खरीदार बोली मानकर एस्क्रो में भुगतान करता है, और खेत साफ होने पर पैसा जारी होता है।'), navigate: wantsOpen ? nav('how') : null };
  }
  // Plain navigation words
  for (const [key, words] of [['payments', W.pay], ['track', W.track], ['deals', W.deal], ['jobs', W.jobs], ['profile', ['profile', 'प्रोफ़ाइल', 'account']], ['home', ['home', 'होम']]]) {
    if (has(q, words) && R[key]) return { reply: L('Opening it now.', 'खोल रहा हूँ।'), navigate: R[key] };
  }
  return { reply: u
    ? L({ buyer: 'Try: "what is my lowest bid", "do I have payments due", or "track my order".', operator: 'Try: "what is my rank", "show open jobs", or "how much money is in escrow".', farmer: 'Try: "post my land", "where is my order", or "how much have I received".' }[u.role],
      { buyer: 'बोलिए: "मेरी सबसे कम बोली क्या है", "कोई भुगतान बाकी है", या "मेरा ऑर्डर कहाँ है"।', operator: 'बोलिए: "मेरी रैंक क्या है", "खुले काम दिखाओ", या "एस्क्रो में कितना पैसा है"।', farmer: 'बोलिए: "मेरी ज़मीन दर्ज करो", "मेरा ऑर्डर कहाँ है", या "मुझे कितना पैसा मिला"।' }[u.role])
    : L('I can explain how Bale to Brick works, the reverse auction, escrow payments and fees. Log in to ask about your own bids and orders.', 'मैं बेल टू ब्रिक, रिवर्स नीलामी, एस्क्रो भुगतान और शुल्क के बारे में बता सकता हूँ। अपनी बोली और ऑर्डर के बारे में पूछने के लिए लॉग इन करें।') };
}

/* ───────────── route ───────────── */
const askLimit = limiter({ windowMs: 60 * 1000, max: 30, keyFn: (req) => req.ip, message: 'Too many questions in a minute. Please wait a moment.' });

router.post('/assistant', askLimit, async (req, res, next) => {
  try {
    const text = String(req.body?.text || '').trim().slice(0, 500);
    if (!text) return res.status(400).json({ error: 'Say or type a question.' });
    const hi = req.body?.lang === 'hi' || /[\u0900-\u097F]/.test(text);
    const u = optionalUser(req);
    const c = context(u);
    const R = routesFor(u);
    const history = (Array.isArray(req.body?.history) ? req.body.history : []).slice(-6)
      .map((m) => `${m.from === 'me' ? 'User' : 'Assistant'}: ${String(m.text || '').slice(0, 300)}`).join('\n');

    if (ai.aiReady()) {
      try {
        const { data, engine } = await ai.generateJSON({
          system: 'You are "Ask Bale to Brick", the voice assistant of an Indian marketplace where farmers list crop stubble, buyers (brick kilns, biomass plants) pick land, ' +
            'and baling operators bid the price down in a reverse auction. The buyer pays into escrow; money is released to the operator and farmer when the farmer confirms the field is clear. ' +
            `Platform fee: ${payments.FEE_PCT}% paid by the buyer. Reply in ${hi ? 'simple Hindi (Devanagari)' : 'simple English'}, at most 3 short sentences, because it will be read aloud. ` +
            'Use ONLY numbers and names from CONTEXT; if something is not there, say you do not have it. Never claim to have done an action (accepting bids, paying); you can only answer and open a page. ' +
            'Set navigate to one of the ROUTES values when the user asks to open, see or go somewhere, or when a page clearly helps; otherwise null.',
          prompt: `CONTEXT (live data for this user):\n${JSON.stringify(c)}\n\nROUTES:\n${JSON.stringify(R)}\n\n` +
            (history ? `Recent conversation:\n${history}\n\n` : '') + `User said: ${text}`,
          schema: { type: 'object', properties: { reply: { type: 'string' }, navigate: { type: 'string', nullable: true } }, required: ['reply'] },
        });
        const routes = Object.values(R);
        let navigate = typeof data.navigate === 'string' ? data.navigate.trim() : null;
        if (navigate && !routes.includes(navigate) && !/^#\/(track|deal|requirement)\/\d+$/.test(navigate)) navigate = null;
        const reply = String(data.reply || '').slice(0, 600);
        if (reply) return res.json({ reply, navigate, engine });
      } catch (e) { /* fall through to the built-in engine */ }
    }
    const out = rulesAnswer(text, u, c, hi);
    res.json({ reply: out.reply, navigate: out.navigate || null, engine: 'Built-in assistant' });
  } catch (e) { next(e); }
});

module.exports = router;
module.exports.rulesAnswer = rulesAnswer;
