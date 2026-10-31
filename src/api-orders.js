// Payments (escrow), order tracking and the buyer's reverse-auction hall.
const express = require('express');
const { db, tx } = require('./db');
const { HttpError, requireAuth } = require('./auth');
const { notify } = require('./notify');
const payments = require('./payments');
const { lowestSeries } = require('./auction');
const api = require('./api');

const { num, optStr, bad, inr, today, addDays, diffDays, route, now, loadDeal, operatorStats, BID_STATS_SQL } = api.helpers;
const router = express.Router();

/* ───────────────────────── payments ───────────────────────── */

router.post('/deals/:id/pay', requireAuth('buyer'), route((req, res) => {
  const method = req.body?.method;
  if (!payments.METHODS[method]) throw bad('Choose how to pay: UPI, card or net banking.');
  let handle = null;
  if (method === 'upi') {
    handle = String(req.body?.upi_id || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,64}@[a-z]{2,32}$/.test(handle)) throw bad('Enter a UPI ID like name@okaxis.');
  }
  if (method === 'netbanking') handle = optStr(req.body?.bank, 60);
  if (method === 'card') {
    const last4 = String(req.body?.card_last4 || '');
    if (!/^\d{4}$/.test(last4)) throw bad('Enter the last 4 digits of the card.');
    handle = '•••• ' + last4;
  }
  const out = tx(() => {
    const d = loadDeal(req.params.id, req.user);
    if (d.buyer_id !== req.user.id) throw new HttpError(403, 'Only the buyer pays for this deal.');
    if (d.status !== 'sealed') throw new HttpError(409, 'Payment is made after the deal is sealed and before work starts.');
    if (payments.escrowOf(d.id)) throw new HttpError(409, 'This deal is already paid.');
    const p = payments.payIntoEscrow(d, { method, payer_handle: handle });
    const where = `${d.acres}-acre job in ${d.district}`;
    notify(d.operator_id, `${req.user.company} paid ${inr(p.breakdown.operator)} into escrow for the ${where}. You can start work.`, `#/track/${d.id}`);
    notify(d.farmer_id, `The buyer has paid into escrow for your land in ${d.district}. Work can start now.`, `#/track/${d.id}`);
    return p;
  });
  res.status(201).json({ ok: true, ref: out.ref, amount: out.amount, status: out.status, breakdown: out.breakdown });
}));

router.get('/payments', requireAuth(), route((req, res) => {
  const me = req.user.id;
  const rows = db.prepare(
    `SELECT p.*, l.acres, l.crop, l.district, l.state,
            bu.company AS buyer_company, ou.company AS operator_company, fu.name AS farmer_name
       FROM payments p
       JOIN deals d ON d.id = p.deal_id
       JOIN listings l ON l.id = d.listing_id
       JOIN users bu ON bu.id = d.buyer_id
       JOIN users ou ON ou.id = d.operator_id
       JOIN users fu ON fu.id = d.farmer_id
      WHERE p.from_user = ? OR p.to_user = ?
      ORDER BY p.created_at DESC, p.id DESC`
  ).all(me, me).map((p) => ({
    ...payments.publicRow(p), direction: p.from_user === me ? 'out' : 'in',
    acres: p.acres, crop: p.crop, district: p.district, state: p.state,
    counterparty: p.kind === 'escrow' ? 'Escrow' : p.kind === 'refund' ? 'Escrow refund' : 'Escrow payout',
    buyer_company: p.buyer_company, operator_company: p.operator_company, farmer_name: p.farmer_name,
  }));

  // Money still in escrow on my deals (for operators and farmers it is money on its way).
  const col = { farmer: 'd.farmer_id', buyer: 'd.buyer_id', operator: 'd.operator_id' }[req.user.role];
  const held = db.prepare(
    `SELECT p.meta_json, p.amount FROM payments p JOIN deals d ON d.id = p.deal_id
      WHERE ${col} = ? AND p.kind = 'escrow' AND p.status = 'held'`
  ).all(me);
  const share = (m, amount) => {
    const x = JSON.parse(m || '{}');
    return req.user.role === 'buyer' ? amount : req.user.role === 'operator' ? (x.operator || 0) : (x.farmer || 0);
  };
  const sum = (f) => rows.filter(f).reduce((a, r) => a + r.amount, 0);
  const due = db.prepare(
    `SELECT d.id FROM deals d LEFT JOIN payments p ON p.deal_id = d.id AND p.kind = 'escrow'
      WHERE ${col} = ? AND d.status = 'sealed' AND p.id IS NULL`
  ).all(me).map((x) => ({ deal_id: x.id, ...payments.breakdown(x.id) }));

  res.json({
    items: rows,
    summary: {
      paid_out: sum((r) => r.direction === 'out'),
      received: sum((r) => r.direction === 'in' && r.kind !== 'refund'),
      refunded: sum((r) => r.kind === 'refund'),
      in_escrow: held.reduce((a, h) => a + share(h.meta_json, h.amount), 0),
      due: req.user.role === 'buyer' ? due : [],
      due_total: req.user.role === 'buyer' ? due.reduce((a, x) => a + x.total, 0) : 0,
    },
    gateway: payments.GATEWAY,
    fee_pct: payments.FEE_PCT,
  });
}));

/* ───────────────────────── order tracking ───────────────────────── */

const STAGES = { on_the_way: 'Crew on the way', baling: 'Baling in the field', loading: 'Loading bales', in_transit: 'Bales on the way to the kiln', delivered: 'Bales delivered at the kiln', note: 'Update' };

router.post('/deals/:id/updates', requireAuth('operator'), route((req, res) => {
  const stage = req.body?.stage;
  if (!STAGES[stage]) throw bad('Choose what is happening now.');
  const note = optStr(req.body?.note, 300);
  const acres = req.body?.acres_done == null || req.body?.acres_done === '' ? null : num(req.body.acres_done, 'Acres cleared', { min: 0, max: 100000 });
  tx(() => {
    const d = loadDeal(req.params.id, req.user);
    if (d.operator_id !== req.user.id) throw new HttpError(403, 'Only the operator on this deal can post updates.');
    if (!['in_progress', 'awaiting_confirmation'].includes(d.status)) throw new HttpError(409, 'Post updates once work has started.');
    if (acres != null && acres > d.acres) throw bad(`This field is ${d.acres} acres. Enter ${d.acres} or less.`);
    db.prepare('INSERT INTO deal_updates (deal_id, user_id, stage, note, acres_done, created_at) VALUES (?,?,?,?,?,?)')
      .run(d.id, req.user.id, stage, note, acres, now());
    const txt = `${STAGES[stage]}${acres != null ? ` (${acres} of ${d.acres} acres)` : ''}: ${d.acres}-acre job in ${d.district}.`;
    notify(d.buyer_id, txt, `#/track/${d.id}`);
    notify(d.farmer_id, txt, `#/track/${d.id}`);
  });
  res.status(201).json({ ok: true });
}));

function trackData(d) {
  const pay = payments.summary(d.id);
  const updates = db.prepare('SELECT stage, note, acres_done, created_at FROM deal_updates WHERE deal_id = ? ORDER BY created_at, id').all(d.id);
  const firstOf = (...stages) => updates.find((u) => stages.includes(u.stage))?.created_at || null;
  const acresDone = d.status === 'completed' || d.work_done_at ? d.acres
    : updates.reduce((m, u) => (u.acres_done != null ? Math.max(m, u.acres_done) : m), 0);
  const released = pay.rows.find((r) => r.kind === 'payout_operator')?.created_at || null;
  const refunded = pay.rows.find((r) => r.kind === 'refund')?.created_at || null;

  const steps = [
    { key: 'sealed', label: 'Deal sealed', at: d.sealed_at },
    { key: 'paid', label: 'Paid into escrow', at: pay.escrow?.paid_at || null },
    { key: 'started', label: 'Work started', at: d.started_at },
    { key: 'baling', label: 'Baling in the field', at: firstOf('baling', 'loading') },
    { key: 'in_transit', label: 'Bales on the way to the kiln', at: firstOf('in_transit') },
    { key: 'delivered', label: 'Bales delivered at the kiln', at: firstOf('delivered') },
    { key: 'work_done', label: 'Work marked done', at: d.work_done_at },
    { key: 'confirmed', label: 'Farmer confirmed', at: d.completed_at },
    { key: 'released', label: 'Payment released', at: released },
  ];
  // A later step being reached means the earlier optional ones are behind us too.
  let last = -1;
  steps.forEach((s, i) => { if (s.at) last = i; });
  steps.forEach((s, i) => { s.done = !!s.at || i < last; });
  const current = d.status === 'cancelled' ? null : steps.find((s) => !s.done)?.key || 'released';
  const pct = d.status === 'cancelled' ? 0 : Math.round((steps.filter((s) => s.done).length / steps.length) * 100);

  return {
    deal: {
      id: d.id, status: d.status, price_total: d.price_total, days: d.days, due_date: d.due_date,
      sealed_at: d.sealed_at, cancelled_at: d.cancelled_at, days_left: diffDays(today(), d.due_date),
      acres: d.acres, crop: d.crop, district: d.district, state: d.state, village: d.village, est_tonnes: d.est_tonnes,
      buyer_company: d.buyer_company, operator_company: d.operator_company || d.operator_name, farmer_name: d.farmer_name,
    },
    steps, current, pct, refunded,
    acres_done: acresDone,
    updates: updates.map((u) => ({ ...u, label: STAGES[u.stage] })),
    payment: { escrow: pay.escrow, breakdown: pay.breakdown },
  };
}

router.get('/track', requireAuth(), route((req, res) => {
  const col = { farmer: 'd.farmer_id', buyer: 'd.buyer_id', operator: 'd.operator_id' }[req.user.role];
  const ids = db.prepare(`SELECT d.id FROM deals d WHERE ${col} = ? ORDER BY (d.status IN ('completed','cancelled')), d.due_date`).all(req.user.id);
  res.json({ items: ids.map(({ id }) => trackData(loadDeal(id, req.user))) });
}));

router.get('/deals/:id/track', requireAuth(), route((req, res) => {
  const d = loadDeal(req.params.id, req.user);
  res.json({ ...trackData(d), my_role: req.user.role, stages: STAGES });
}));

/* ───────────────────────── buyer: reverse-auction hall ───────────────────────── */

router.get('/buyer/auctions', requireAuth('buyer'), route((req, res) => {
  const reqs = db.prepare(
    `SELECT r.*, l.crop, l.acres, l.est_tonnes, l.state, l.district, l.village, l.clear_by, ${BID_STATS_SQL},
            d.id AS deal_id, d.price_total AS deal_price
       FROM requirements r
       JOIN listings l ON l.id = r.listing_id
       LEFT JOIN deals d ON d.requirement_id = r.id
      WHERE r.buyer_id = ? AND (r.status = 'open' OR r.created_at >= ?)
      ORDER BY (r.status != 'open'), r.needed_by`
  ).all(req.user.id, addDays(today(), -60));

  const items = reqs.map((r) => {
    const top = db.prepare(
      `SELECT b.id, b.operator_id, b.price_total, b.days, b.status, u.company, u.name
         FROM bids b JOIN users u ON u.id = b.operator_id
        WHERE b.requirement_id = ? AND b.status IN ('active','accepted')
        ORDER BY b.price_total, b.days, b.created_at LIMIT 3`
    ).all(r.id).map((b) => ({
      id: b.id, status: b.status, price_total: b.price_total, days: b.days, operator: b.company || b.name,
      meets_deadline: addDays(today(), b.days) <= r.needed_by, ...operatorStats(b.operator_id),
    }));
    const h = lowestSeries(r.id);
    const final = r.deal_price ?? r.lowest_bid;
    return {
      id: r.id, status: r.status, budget_total: r.budget_total, needed_by: r.needed_by, created_at: r.created_at,
      days_left: diffDays(today(), r.needed_by), crop: r.crop, acres: r.acres, est_tonnes: r.est_tonnes,
      state: r.state, district: r.district, village: r.village, bid_count: r.bid_count, lowest_bid: r.lowest_bid,
      deal_id: r.deal_id, deal_price: r.deal_price, top, history: h.series, events: h.events, first_bid: h.first_bid,
      saving: final != null ? r.budget_total - final : 0,
      drop_pct: h.first_bid && final != null ? Math.round(((h.first_bid - final) / h.first_bid) * 100) : 0,
    };
  });
  const live = items.filter((a) => a.status === 'open');
  res.json({
    items,
    summary: {
      live: live.length,
      bids_live: live.reduce((a, x) => a + x.bid_count, 0),
      budget_live: live.reduce((a, x) => a + x.budget_total, 0),
      saving: items.filter((a) => a.status !== 'cancelled').reduce((a, x) => a + Math.max(0, x.saving), 0),
    },
  });
}));

/* ───────────────────────── public showcase for the landing page ───────────────────────── */

router.get('/showcase', route((req, res) => {
  const deals = db.prepare(
    `SELECT d.id, d.price_total, d.sealed_at, d.started_at, d.completed_at, d.work_done_at, r.budget_total,
            l.crop, l.acres, l.est_tonnes, l.district, l.state, l.village,
            bu.company AS buyer, COALESCE(ou.company, ou.name) AS operator,
            (SELECT COUNT(DISTINCT operator_id) FROM bids b WHERE b.requirement_id = d.requirement_id) AS bid_count,
            (SELECT amount FROM payments p WHERE p.deal_id = d.id AND p.kind = 'payout_farmer') AS farmer_paid
       FROM deals d
       JOIN requirements r ON r.id = d.requirement_id
       JOIN listings l ON l.id = d.listing_id
       JOIN users bu ON bu.id = d.buyer_id
       JOIN users ou ON ou.id = d.operator_id
      WHERE d.status = 'completed' ORDER BY d.completed_at DESC LIMIT 6`
  ).all().map((d) => {
    const rt = db.prepare('SELECT stars, comment FROM ratings WHERE deal_id = ? AND comment IS NOT NULL ORDER BY id LIMIT 1').get(d.id);
    const from = (d.started_at || d.sealed_at).slice(0, 10), to = (d.work_done_at || d.completed_at).slice(0, 10);
    return {
      crop: d.crop, acres: d.acres, tonnes: d.est_tonnes, district: d.district, state: d.state, village: d.village,
      budget_total: d.budget_total, price_total: d.price_total, bid_count: d.bid_count, completed_at: d.completed_at,
      days_taken: Math.max(1, diffDays(from, to)), buyer: d.buyer, operator: d.operator,
      farmer_paid: d.farmer_paid || 0, stars: rt?.stars || null, comment: rt?.comment || null,
    };
  });
  const live = db.prepare(
    `SELECT r.id, r.budget_total, l.crop, l.acres, l.district, l.state, ${BID_STATS_SQL}
       FROM requirements r JOIN listings l ON l.id = r.listing_id
      WHERE r.status = 'open' ORDER BY bid_count DESC, r.id DESC LIMIT 4`
  ).all().map((r) => {
    const h = lowestSeries(r.id);
    return { crop: r.crop, acres: r.acres, district: r.district, state: r.state, budget_total: r.budget_total,
      bid_count: r.bid_count, lowest_bid: r.lowest_bid,
      drop_pct: h.first_bid && r.lowest_bid ? Math.round(((h.first_bid - r.lowest_bid) / h.first_bid) * 100) : 0 };
  });
  res.json({ deals, live });
}));

module.exports = router;
