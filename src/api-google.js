// Routes for the Google-powered features. Each one works with its Google service when configured,
// and either falls back to a simpler method or explains what to set up.
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db, UPLOAD_DIR } = require('./db');
const { HttpError, requireAuth, limiter } = require('./auth');
const { CROPS, STATES } = require('./constants');
const { helpers: h } = require('./api');
const { notify } = require('./notify');
const { subscribe } = require('./live');
const { baseline } = require('./estimate');
const ai = require('./google/ai');
const earth = require('./google/earth');
const vision = require('./google/vision');
const routes = require('./google/routes');
const vertex = require('./google/vertex');
const firebase = require('./google/firebase');
const otp = require('./otp');

const router = express.Router();
const env = (k) => (process.env[k] || '').trim();
const now = () => new Date().toISOString();

const aiLimit = limiter({
  windowMs: 60 * 60 * 1000, max: 60, keyFn: (req) => 'ai|' + (req.user?.id ?? req.ip),
  message: 'You have used the AI helpers a lot in the last hour. Please try again later.',
});

function imageOf(b) {
  const mime = String(b?.mime || '');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw h.bad('Upload a JPG, PNG or WebP photo.');
  const data = String(b?.image || '').replace(/^data:[^,]+,/, '');
  if (!/^[A-Za-z0-9+/=\s]+$/.test(data)) throw h.bad('The photo could not be read.');
  const bytes = Buffer.byteLength(data, 'base64');
  if (bytes < 2000) throw h.bad('The photo is too small to read.');
  if (bytes > 4 * 1024 * 1024) throw h.bad('The photo is too large (max 4 MB).');
  return { mime, data };
}

function loadDealFor(id, user) {
  const d = db.prepare('SELECT * FROM deals WHERE id = ?').get(id);
  if (!d || ![d.farmer_id, d.buyer_id, d.operator_id].includes(user.id)) throw new HttpError(404, 'Deal not found.');
  return d;
}

/* ───────── what is switched on (for the app and for judges) ───────── */

router.get('/integrations', (req, res) => {
  const fb = firebase.publicConfig();
  res.json({
    gemini: ai.geminiReady(), gemma: ai.gemmaReady(),
    maps_browser: !!env('GOOGLE_MAPS_API_KEY'), maps_routes: routes.routesReady(),
    earth_engine: earth.eeReady(), firms: earth.firmsReady(),
    firebase_auth: !!fb, firebase_phone: !!fb?.phone_auth, firestore: firebase.firestoreReady(),
    vision: vision.visionReady(), vertex: vertex.vertexReady(),
    cloud_run: !!process.env.K_SERVICE,
    sms: otp.configured('phone'), email: otp.configured('email'), sms_alerts: otp.smsAlertsReady() && env('SMS_ALERTS') === '1',
  });
});

/* ───────── live updates (Server-Sent Events) ───────── */

// EventSource cannot send headers, so the token comes in the query string.
router.get('/events', (req, res, next) => {
  if (req.query.token) req.headers.authorization = 'Bearer ' + req.query.token;
  next();
}, requireAuth(), (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 5000\n\n');
  subscribe(req.user.id, res);
});

/* ───────── Gemini: listing from speech or text (Hindi, Marwari, Mewari, English) ───────── */

router.post('/ai/parse-listing', requireAuth('farmer'), aiLimit, async (req, res) => {
  const text = h.reqStr(req.body?.text, 'Description', 1500);
  const today = h.today();
  const { data, engine } = await ai.generateJSON({
    system: 'You turn a farmer\'s spoken or typed description of crop residue on their land into a form. ' +
      'The farmer may write in Hindi, Marwari, Mewari, Punjabi, Haryanvi or English, in any script. Never invent values: use null for anything not said.',
    prompt: `Today is ${today}. The farmer's account is in ${req.user.district}, ${req.user.state}.\n` +
      `Crop keys: ${Object.keys(CROPS).join(', ')} (dhan/chawal/parali = paddy, gehun/toori/bhusa = wheat, ganna = sugarcane, kapas/narma = cotton, makka = maize, sarson = mustard).\n` +
      'Area: convert to acres. 1 killa = 1 acre. 1 hectare = 2.47 acres. For bigha use the usual size in the farmer\'s state ' +
      '(Rajasthan and Punjab pucca bigha about 0.625 acre, Uttar Pradesh about 0.625, Bihar about 0.62) and say so in notes.\n' +
      'Dates: turn phrases like "10 din mein" or "Diwali se pehle" into a YYYY-MM-DD clear_by date after today.\n' +
      'state must be one of the Indian state names in English. reply is one short sentence back to the farmer, in the language they used, ' +
      'confirming what you understood and asking for anything missing.\n\nFarmer said:\n' + text,
    schema: {
      type: 'object',
      properties: {
        crop: { type: 'string', nullable: true }, acres: { type: 'number', nullable: true },
        village: { type: 'string', nullable: true }, district: { type: 'string', nullable: true }, state: { type: 'string', nullable: true },
        clear_by: { type: 'string', nullable: true }, ask_price_per_acre: { type: 'integer', nullable: true },
        notes: { type: 'string', nullable: true }, reply: { type: 'string' },
      },
      required: ['reply'],
    },
  });
  // Never trust the model blindly: keep only values that pass the same checks as the form.
  const clean = { reply: String(data.reply || '').slice(0, 300), engine };
  if (CROPS[data.crop]) clean.crop = data.crop;
  if (Number(data.acres) >= 0.5 && Number(data.acres) <= 5000) clean.acres = Math.round(Number(data.acres) * 2) / 2;
  if (STATES.includes(data.state)) clean.state = data.state;
  for (const k of ['village', 'district']) if (typeof data[k] === 'string' && data[k].trim()) clean[k] = data[k].trim().slice(0, 60);
  if (h.isDate(data.clear_by) && data.clear_by > today && h.diffDays(today, data.clear_by) <= 180) clean.clear_by = data.clear_by;
  if (Number.isInteger(data.ask_price_per_acre) && data.ask_price_per_acre >= 0 && data.ask_price_per_acre <= 100000) clean.ask_price_per_acre = data.ask_price_per_acre;
  if (typeof data.notes === 'string' && data.notes.trim()) clean.notes = data.notes.trim().slice(0, 500);
  res.json(clean);
});

/* ───────── Gemini: read a land record (Jamabandi / Khatauni / Khasra) ───────── */

const tokens = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);

router.post('/ai/read-document', requireAuth('farmer'), aiLimit, async (req, res) => {
  const img = imageOf(req.body);
  const { data, engine } = await ai.generateJSON({
    images: [img],
    system: 'You read Indian land records (Jamabandi, Khatauni, Khasra/Girdawari, Fard, 7/12 extract, B1) and extract fields exactly as printed. Use null when a field is not visible. Do not guess.',
    prompt: 'Extract the owner names (as printed, and transliterated into English letters), Khasra / survey numbers, the Khewat or Khatauni number, ' +
      'village, tehsil, district, state, and the total area with its unit as printed. Convert the area to acres when the unit is clear ' +
      '(1 hectare = 2.471 acres; kanal-marla: 8 kanal = 1 acre, 20 marla = 1 kanal; bigha: use the state\'s usual size and mention it in notes). ' +
      'Set readable to false if this is not a land record or cannot be read.',
    schema: {
      type: 'object',
      properties: {
        readable: { type: 'boolean' }, document_type: { type: 'string', nullable: true },
        owner_names: { type: 'array', items: { type: 'string' } }, owner_names_english: { type: 'array', items: { type: 'string' } },
        khasra_numbers: { type: 'array', items: { type: 'string' } }, khewat_or_khatauni: { type: 'string', nullable: true },
        village: { type: 'string', nullable: true }, tehsil: { type: 'string', nullable: true }, district: { type: 'string', nullable: true },
        state: { type: 'string', nullable: true }, area_as_printed: { type: 'string', nullable: true },
        area_acres: { type: 'number', nullable: true }, notes: { type: 'string', nullable: true },
      },
      required: ['readable', 'owner_names', 'khasra_numbers'],
    },
  });
  if (!data.readable) throw h.bad('This does not look like a readable land record. Try a clearer, straight photo in good light.');
  const mine = tokens(req.user.name);
  const names = [...(data.owner_names_english || []), ...(data.owner_names || [])];
  const nameMatch = names.some((n) => { const t = tokens(n); return mine.filter((w) => t.includes(w)).length >= Math.min(2, mine.length); });
  const area = Number(data.area_acres);
  const out = {
    document_type: data.document_type || null,
    owner_names: (data.owner_names_english?.length ? data.owner_names_english : data.owner_names || []).slice(0, 6).map(String),
    khasra_numbers: (data.khasra_numbers || []).slice(0, 20).map(String),
    khewat_or_khatauni: data.khewat_or_khatauni || null,
    village: data.village || null, tehsil: data.tehsil || null, district: data.district || null, state: data.state || null,
    area_as_printed: data.area_as_printed || null,
    area_acres: Number.isFinite(area) && area > 0 && area < 50000 ? Math.round(area * 100) / 100 : null,
    notes: data.notes || null, name_match: nameMatch, engine,
  };
  // The photo itself is not kept; only what was read from it.
  const info = db.prepare('INSERT INTO land_docs (farmer_id, data_json, created_at) VALUES (?,?,?)').run(req.user.id, JSON.stringify(out), now());
  res.json({ id: Number(info.lastInsertRowid), ...out });
});

/* ───────── Estimator: residue, bricks, coal and carbon (Gemini explains) ───────── */

router.post('/ai/estimate', requireAuth(), aiLimit, async (req, res) => {
  const b = req.body || {};
  if (!CROPS[b.crop]) throw h.bad('Choose the crop residue type.');
  const acres = h.num(b.acres, 'Land area (acres)', { min: 0.5, max: 5000 });
  const tonnes = b.est_tonnes ? h.num(b.est_tonnes, 'Estimated tonnes', { min: 0.1, max: 50000 }) : null;
  const est = baseline(b.crop, acres, tonnes);
  let advice = null, engine = null;
  if (ai.aiReady()) {
    try {
      const lang = b.lang === 'hi' ? 'Hindi (Devanagari)' : 'simple English';
      const r = await ai.generateJSON({
        prompt: `A farmer in ${req.user.district}, ${req.user.state}, India has ${acres} acres of ${CROPS[b.crop].label} residue, about ${est.tonnes} tonnes. ` +
          `Selling it to a brick kiln instead of burning keeps about ${est.co2_avoided_t} t CO2 and ${est.pm25_avoided_kg} kg PM2.5 out of the air and can fire about ${est.bricks} bricks. ` +
          `Write in ${lang}: a two-sentence summary for the farmer, and three short practical tips for getting it baled well (moisture, timing, field access). No numbers other than the ones given.`,
        schema: { type: 'object', properties: { summary: { type: 'string' }, tips: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'tips'] },
      });
      advice = { summary: String(r.data.summary || '').slice(0, 500), tips: (r.data.tips || []).slice(0, 3).map((t) => String(t).slice(0, 200)) };
      engine = r.engine;
    } catch (e) { console.error('estimate advice:', e.message); }
  }
  res.json({ ...est, advice, engine });
});

/* ───────── Price suggestion (Vertex AI or local model) ───────── */

router.post('/ai/price', requireAuth('buyer', 'operator'), async (req, res) => {
  const l = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.body?.listing_id);
  if (!l) throw new HttpError(404, 'Listing not found.');
  const days = req.body?.days ? h.num(req.body.days, 'Days', { min: 1, max: 180, int: true }) : null;
  const p = await vertex.suggestPrice({ crop: l.crop, acres: l.acres, est_tonnes: l.est_tonnes, days, state: l.state, month: new Date().getMonth() + 1 });
  res.json(p);
});

/* ───────── Earth Engine: is the field harvested, and has it burned? ───────── */

router.post('/listings/:id/satellite', requireAuth('farmer'), aiLimit, async (req, res) => {
  const l = db.prepare('SELECT * FROM listings WHERE id = ? AND farmer_id = ?').get(req.params.id, req.user.id);
  if (!l) throw new HttpError(404, 'Listing not found.');
  if (l.lat == null) throw h.bad('Pin the field on the map first. Satellite checks need the exact spot.');
  if (!earth.eeReady() && !earth.firmsReady()) throw new HttpError(503, 'Satellite checks are not set up on this server yet (Earth Engine).');
  const to = h.today(), from = h.addDays(to, -15);
  const [ground, fire] = await Promise.all([
    earth.groundCheck(l.lat, l.lng).catch((e) => { console.error(e.message); return null; }),
    earth.fireCheck(l.lat, l.lng, from, to).catch((e) => { console.error(e.message); return null; }),
  ]);
  if (!ground && !fire) throw new HttpError(502, 'The satellite service did not answer. Please try again later.');
  const result = { ground, fire: fire && { ...fire, from, to }, checked_at: now() };
  db.prepare('UPDATE listings SET sat_json = ? WHERE id = ?').run(JSON.stringify(result), l.id);
  res.json(result);
});

// Zero-burn proof for a deal: any fire at the field between a week before sealing and today.
router.post('/deals/:id/burn-check', requireAuth(), aiLimit, async (req, res) => {
  const d = loadDealFor(req.params.id, req.user);
  const l = db.prepare('SELECT * FROM listings WHERE id = ?').get(d.listing_id);
  if (l.lat == null) throw h.bad('This field has no map pin, so it cannot be checked from space.');
  const from = h.addDays(d.sealed_at.slice(0, 10), -7);
  const to = (d.completed_at || now()).slice(0, 10);
  const fire = await earth.fireCheck(l.lat, l.lng, from, to);
  if (!fire) throw new HttpError(503, 'Satellite checks are not set up on this server yet (Earth Engine).');
  const result = { ...fire, from, to, zero_burn: fire.fire_days.length === 0, checked_at: now() };
  db.prepare('UPDATE deals SET burn_json = ? WHERE id = ?').run(JSON.stringify(result), d.id);
  if (!result.zero_burn) {
    for (const uid of [d.farmer_id, d.buyer_id, d.operator_id]) {
      if (uid !== req.user.id) notify(uid, `Satellite data shows fire near the field on ${fire.fire_days.join(', ')}.`, `#/deal/${d.id}`);
    }
  }
  res.json(result);
});

/* ───────── Routes API: yard -> field -> kiln ───────── */

router.get('/deals/:id/route', requireAuth(), async (req, res) => {
  const d = loadDealFor(req.params.id, req.user);
  if (d.route_json && !req.query.refresh) return res.json(JSON.parse(d.route_json));
  const l = db.prepare('SELECT lat, lng, est_tonnes FROM listings WHERE id = ?').get(d.listing_id);
  const op = db.prepare('SELECT base_lat, base_lng FROM users WHERE id = ?').get(d.operator_id);
  const buyer = db.prepare('SELECT base_lat, base_lng FROM users WHERE id = ?').get(d.buyer_id);
  if (l.lat == null) return res.json({ ready: false, missing: 'field' });
  const field = { lat: l.lat, lng: l.lng };
  const out = { ready: true, legs: {} };
  if (op.base_lat != null) out.legs.yard_to_field = await routes.leg({ lat: op.base_lat, lng: op.base_lng }, field);
  if (buyer.base_lat != null) {
    out.legs.field_to_kiln = await routes.leg(field, { lat: buyer.base_lat, lng: buyer.base_lng });
    const rate = Number(env('TRANSPORT_RS_PER_TONNE_KM')) || 12;
    out.haul_cost = Math.round((l.est_tonnes * out.legs.field_to_kiln.km * rate) / 100) * 100;
    out.rate = rate;
  }
  for (const leg of Object.values(out.legs)) leg.km = Math.round(leg.km * 10) / 10;
  if (!Object.keys(out.legs).length) out.missing = 'bases';
  else db.prepare('UPDATE deals SET route_json = ? WHERE id = ?').run(JSON.stringify(out), d.id);
  res.json(out);
});

/* ───────── Cloud Vision: proof photos on a deal ───────── */

router.post('/deals/:id/photos', requireAuth(), aiLimit, async (req, res) => {
  const d = loadDealFor(req.params.id, req.user);
  if (!['in_progress', 'awaiting_confirmation', 'completed'].includes(d.status)) throw new HttpError(409, 'Photos can be added once work has started.');
  if (db.prepare('SELECT COUNT(*) AS n FROM deal_photos WHERE deal_id = ?').get(d.id).n >= 12) throw new HttpError(409, 'This deal already has 12 photos.');
  const img = imageOf(req.body);
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[img.mime];
  const file = `deal${d.id}-${crypto.randomBytes(9).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, file), Buffer.from(img.data, 'base64'));
  let check = null;
  try { check = await vision.checkPhoto(img.data, img.mime); } catch (e) { console.error(e.message); }
  if (check?.verdict === 'rejected') {
    fs.rmSync(path.join(UPLOAD_DIR, file), { force: true });
    throw h.bad('This photo cannot be used. Please upload a photo of the field or the bales.');
  }
  const info = db.prepare('INSERT INTO deal_photos (deal_id, uploader_id, file, mime, check_json, created_at) VALUES (?,?,?,?,?,?)')
    .run(d.id, req.user.id, file, img.mime, check ? JSON.stringify(check) : null, now());
  const who = req.user.company || req.user.name;
  for (const uid of [d.farmer_id, d.buyer_id, d.operator_id]) if (uid !== req.user.id) notify(uid, `${who} added a photo to the deal.`, `#/deal/${d.id}`);
  res.status(201).json({ id: Number(info.lastInsertRowid), check });
});

router.get('/deals/:id/photos/:pid', requireAuth(), (req, res) => {
  const d = loadDealFor(req.params.id, req.user);
  const p = db.prepare('SELECT * FROM deal_photos WHERE id = ? AND deal_id = ?').get(req.params.pid, d.id);
  if (!p) throw new HttpError(404, 'Photo not found.');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.type(p.mime).sendFile(path.join(UPLOAD_DIR, path.basename(p.file)));
});

module.exports = router;
