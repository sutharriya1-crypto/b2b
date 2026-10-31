// Escrow payments. The buyer pays one amount into escrow after the deal is sealed:
// the operator's price + the farmer's asking price for the stubble + a small platform fee.
// The operator can start work only after the money is held. When the farmer confirms the field
// is clear, escrow is released to the operator and the farmer. A deal cancelled before work starts
// refunds the buyer.
//
// PAYMENT_GATEWAY=demo (the default) records every step in the ledger without moving real money,
// so the full flow can be shown at a hackathon. To go live, replace `charge()` with a call to a
// licensed gateway (Razorpay Route, Cashfree Escrow, etc.) and keep the ledger as is.
const crypto = require('crypto');
const { db } = require('./db');

const FEE_PCT = Math.max(0, Math.min(10, Number(process.env.PLATFORM_FEE_PCT ?? 1)));
const GATEWAY = process.env.PAYMENT_GATEWAY || 'demo';
const METHODS = { upi: 'UPI', card: 'Card', netbanking: 'Net banking' };

const now = () => new Date().toISOString();
const newRef = (prefix) => `${prefix}${new Date().toISOString().slice(2, 10).replace(/-/g, '')}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

// What the buyer owes on a deal, split into who gets what.
function breakdown(dealId) {
  const d = db.prepare(
    `SELECT d.price_total, l.acres, l.ask_price_per_acre FROM deals d JOIN listings l ON l.id = d.listing_id WHERE d.id = ?`
  ).get(dealId);
  const operator = d.price_total;
  const farmer = Math.round((d.ask_price_per_acre || 0) * d.acres);
  const fee = Math.round(((operator + farmer) * FEE_PCT) / 100);
  return { operator, farmer, fee, fee_pct: FEE_PCT, total: operator + farmer + fee };
}

const escrowOf = (dealId) => db.prepare("SELECT * FROM payments WHERE deal_id = ? AND kind = 'escrow'").get(dealId);

function insert(row) {
  const t = row.created_at || now();
  db.prepare(
    `INSERT INTO payments (deal_id, kind, from_user, to_user, amount, method, status, ref, meta_json, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(row.deal_id, row.kind, row.from_user ?? null, row.to_user ?? null, row.amount, row.method ?? null, row.status,
    row.ref || newRef(row.kind === 'escrow' ? 'ESC' : row.kind === 'refund' ? 'RFD' : 'PAY'),
    row.meta ? JSON.stringify(row.meta) : null, t, t);
}

// Demo gateway: always succeeds and returns a reference. Swap for a real gateway call to go live.
function charge({ method }) {
  if (GATEWAY !== 'demo') throw Object.assign(new Error('This payment gateway is not set up on the server.'), { status: 501 });
  return { ok: true, ref: newRef('ESC'), gateway: 'Demo gateway (no real money moves)', method };
}

// Buyer pays into escrow. Call inside a transaction.
function payIntoEscrow(deal, { method, payer_handle }) {
  const amount = breakdown(deal.id);
  const res = charge({ method, amount: amount.total });
  insert({
    deal_id: deal.id, kind: 'escrow', from_user: deal.buyer_id, to_user: null, amount: amount.total, method,
    status: 'held', ref: res.ref, meta: { ...amount, gateway: res.gateway, payer_handle: payer_handle || null },
  });
  return { ...escrowOf(deal.id), breakdown: amount };
}

// Farmer confirmed: pay the operator and the farmer out of escrow. Call inside a transaction.
function release(deal) {
  const e = escrowOf(deal.id);
  if (!e || e.status !== 'held') return null;
  const meta = JSON.parse(e.meta_json || '{}');
  db.prepare("UPDATE payments SET status = 'released', updated_at = ? WHERE id = ?").run(now(), e.id);
  insert({ deal_id: deal.id, kind: 'payout_operator', from_user: null, to_user: deal.operator_id, amount: meta.operator ?? deal.price_total, method: 'bank_transfer', status: 'paid' });
  if (meta.farmer > 0) insert({ deal_id: deal.id, kind: 'payout_farmer', from_user: null, to_user: deal.farmer_id, amount: meta.farmer, method: 'bank_transfer', status: 'paid' });
  return true;
}

// Deal cancelled before work started: give the buyer the money back. Call inside a transaction.
function refund(deal) {
  const e = escrowOf(deal.id);
  if (!e || e.status !== 'held') return null;
  db.prepare("UPDATE payments SET status = 'refunded', updated_at = ? WHERE id = ?").run(now(), e.id);
  insert({ deal_id: deal.id, kind: 'refund', from_user: null, to_user: deal.buyer_id, amount: e.amount, method: e.method, status: 'paid' });
  return true;
}

// Payment status of one deal, for the deal and tracking pages.
function summary(dealId) {
  const e = escrowOf(dealId);
  const rows = db.prepare('SELECT * FROM payments WHERE deal_id = ? ORDER BY id').all(dealId);
  return {
    breakdown: e?.meta_json ? (({ operator, farmer, fee, fee_pct, total }) => ({ operator, farmer, fee, fee_pct, total }))(JSON.parse(e.meta_json)) : breakdown(dealId),
    escrow: e ? { status: e.status, amount: e.amount, method: e.method, ref: e.ref, paid_at: e.created_at, updated_at: e.updated_at } : null,
    rows: rows.map(publicRow),
    gateway: GATEWAY,
  };
}

function publicRow(p) {
  return { id: p.id, deal_id: p.deal_id, kind: p.kind, amount: p.amount, method: p.method, status: p.status, ref: p.ref, created_at: p.created_at, updated_at: p.updated_at };
}

module.exports = { breakdown, escrowOf, payIntoEscrow, release, refund, summary, insert, publicRow, METHODS, FEE_PCT, GATEWAY };
