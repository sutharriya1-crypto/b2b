// Reverse-auction history: every bid placed, lowered or withdrawn is kept, so buyers can see
// how the lowest price fell over time.
const { db } = require('./db');

function logBid(requirementId, operatorId, kind, price, days, at) {
  db.prepare('INSERT INTO bid_events (requirement_id, operator_id, price_total, days, kind, created_at) VALUES (?,?,?,?,?,?)')
    .run(requirementId, operatorId, price ?? null, days ?? null, kind, at || new Date().toISOString());
}

// Lowest live bid after each event: [{ t, low, kind }]. Replays the log, one current bid per operator.
function lowestSeries(requirementId) {
  const events = db.prepare('SELECT * FROM bid_events WHERE requirement_id = ? ORDER BY created_at, id').all(requirementId);
  const live = new Map();
  const out = [];
  for (const e of events) {
    if (e.kind === 'withdrawn') live.delete(e.operator_id);
    else live.set(e.operator_id, e.price_total);
    const prices = [...live.values()];
    out.push({ t: e.created_at, low: prices.length ? Math.min(...prices) : null, kind: e.kind });
  }
  return { series: out, events: events.length, first_bid: events.find((e) => e.kind !== 'withdrawn')?.price_total ?? null };
}

module.exports = { logBid, lowestSeries };
