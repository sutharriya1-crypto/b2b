// End-to-end API test: runs the real server against a throwaway database.
process.env.DB_PATH = ':memory:';
process.env.DEMO_SEED = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

let server, base;
test.before(async () => {
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server.close());

async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const future = (n) => {
  const d = new Date(Date.now() + 330 * 60000);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const randomPhone = () => '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');

// Two-step sign-up: details first (a code is sent), then the code. No SMS/email service is set up
// in tests, so the server runs in demo mode and returns the code as dev_code.
async function signup(role, extra = {}, channel = 'phone') {
  const n = Math.random().toString(36).slice(2, 8);
  const body = {
    role, name: `${role} ${n}`, email: `${role}.${n}@test.in`, password: 'secret123',
    phone: randomPhone(), state: 'Punjab', district: 'Ludhiana', otp_channel: channel, ...extra,
  };
  const first = await call('POST', '/auth/register', { body });
  assert.equal(first.status, 202, JSON.stringify(first.data));
  assert.match(first.data.dev_code, /^\d{6}$/);
  const r = await call('POST', '/auth/register', { body: { ...body, otp_code: first.data.dev_code } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return { token: r.data.token, user: r.data.user, email: body.email, phone: body.phone };
}

test('full flow: list land → buyer picks → operators bid in reverse → deal sealed → completed', async () => {
  const farmer = await signup('farmer');
  const buyer = await signup('buyer', { company: 'Test Bricks Ltd' });
  const op1 = await signup('operator', { company: 'Op One', equipment: '2 balers', capacity_acres_per_day: 20 });
  const op2 = await signup('operator', { company: 'Op Two', equipment: '1 baler', capacity_acres_per_day: 10 });

  // farmer posts land
  const created = await call('POST', '/listings', { token: farmer.token, body: {
    crop: 'paddy', acres: 10, state: 'Punjab', district: 'Ludhiana', village: 'Raikot',
    address: 'Near canal, Raikot', clear_by: future(10), lat: 30.6514, lng: 75.6011,
  } });
  assert.equal(created.status, 201);
  const listingId = created.data.id;
  const mine = await call('GET', '/listings/mine', { token: farmer.token });
  assert.equal(mine.data.items[0].est_tonnes, 25); // 10 acres * 2.5 t/acre

  // buyer sees it with a match score, sets preferences
  await call('PUT', '/buyer/prefs', { token: buyer.token, body: { states: ['Punjab'], crops: ['paddy'], min_acres: 5 } });
  const market = await call('GET', '/market/listings', { token: buyer.token });
  const found = market.data.items.find((x) => x.id === listingId);
  assert.ok(found);
  assert.ok(found.match >= 70, `expected a good match, got ${found.match}`);
  assert.equal(found.address, undefined, 'exact address must stay private before a deal');
  assert.equal(found.lat, undefined, 'exact map pin must stay private before a deal');

  // validation: needed_by cannot go beyond the farmer's deadline
  const tooLate = await call('POST', '/requirements', { token: buyer.token, body: { listing_id: listingId, budget_total: 50000, needed_by: future(20) } });
  assert.equal(tooLate.status, 400);

  const req = await call('POST', '/requirements', { token: buyer.token, body: { listing_id: listingId, budget_total: 50000, needed_by: future(8), notes: 'Stack at roadside' } });
  assert.equal(req.status, 201);
  const reqId = req.data.id;

  // a second buyer cannot grab the same land
  const buyer2 = await signup('buyer', { company: 'Other Bricks' });
  const dup = await call('POST', '/requirements', { token: buyer2.token, body: { listing_id: listingId, budget_total: 40000, needed_by: future(8) } });
  assert.equal(dup.status, 409);

  // operators bid in reverse
  const over = await call('POST', `/requirements/${reqId}/bids`, { token: op1.token, body: { price_total: 60000, days: 5 } });
  assert.equal(over.status, 400, 'bid above budget must be rejected');
  const slow = await call('POST', `/requirements/${reqId}/bids`, { token: op1.token, body: { price_total: 40000, days: 30 } });
  assert.equal(slow.status, 400, 'bid slower than the deadline must be rejected');

  const b1 = await call('POST', `/requirements/${reqId}/bids`, { token: op1.token, body: { price_total: 45000, days: 6 } });
  assert.equal(b1.status, 201);
  const b2 = await call('POST', `/requirements/${reqId}/bids`, { token: op2.token, body: { price_total: 42000, days: 7 } });
  assert.equal(b2.status, 201);
  assert.equal(b2.data.bid.rank, 1);

  // op1 was undercut → notified; revision must improve
  const notes = await call('GET', '/notifications', { token: op1.token });
  assert.ok(notes.data.items.some((n) => n.text.includes('undercut')));
  const same = await call('POST', `/requirements/${reqId}/bids`, { token: op1.token, body: { price_total: 45000, days: 6 } });
  assert.equal(same.status, 409);
  const better = await call('POST', `/requirements/${reqId}/bids`, { token: op1.token, body: { price_total: 41000, days: 6 } });
  assert.equal(better.status, 200);

  // operators cannot see rivals' identities; buyer sees ranked bids
  const opView = await call('GET', `/requirements/${reqId}`, { token: op2.token });
  assert.equal(opView.data.view, 'operator');
  assert.equal(opView.data.requirement.lowest_bid, 41000);
  assert.equal(opView.data.bids, undefined);
  assert.equal(opView.data.listing.lat, undefined, 'operators see only the village before a deal');
  const buyerView = await call('GET', `/requirements/${reqId}`, { token: buyer.token });
  assert.deepEqual(buyerView.data.bids.map((b) => b.price_total), [41000, 42000]);
  // auction history: lowest price after each bid event (op1 placed, op2 undercut, op1 revised)
  assert.deepEqual(buyerView.data.history.series.map((x) => x.low).slice(-3), [45000, 42000, 41000]);
  const hall = await call('GET', '/buyer/auctions', { token: buyer.token });
  assert.equal(hall.status, 200);
  const room = hall.data.items.find((a) => a.id === reqId);
  assert.equal(room.lowest_bid, 41000);
  assert.equal(room.top[0].price_total, 41000);
  assert.equal(hall.data.summary.live, 1);
  assert.equal((await call('GET', '/buyer/auctions', { token: op1.token })).status, 403);

  // strangers are blocked
  const stranger = await call('GET', `/requirements/${reqId}`, { token: buyer2.token });
  assert.equal(stranger.status, 403);

  // seal the deal with op2 (not the cheapest — buyer's choice)
  const award = await call('POST', `/requirements/${reqId}/award`, { token: buyer.token, body: { bid_id: buyerView.data.bids[1].id } });
  assert.equal(award.status, 201);
  const dealId = award.data.deal_id;

  const dealOp = await call('GET', `/deals/${dealId}`, { token: op2.token });
  assert.equal(dealOp.data.listing.address, 'Near canal, Raikot', 'address revealed to parties after sealing');
  assert.equal(dealOp.data.farmer.phone, farmer.phone);
  assert.equal(dealOp.data.farmer.phone_verified, true);
  assert.equal(dealOp.data.listing.lat, 30.6514, 'exact pin revealed to parties after sealing');
  assert.equal(dealOp.data.listing.lng, 75.6011);
  const dealStranger = await call('GET', `/deals/${dealId}`, { token: op1.token });
  assert.equal(dealStranger.status, 404);

  // losing operator was told; further bidding closed
  const late = await call('POST', `/requirements/${reqId}/bids`, { token: op1.token, body: { price_total: 30000, days: 3 } });
  assert.equal(late.status, 404);
  const loserNotes = await call('GET', '/notifications', { token: op1.token });
  assert.ok(loserNotes.data.items.some((n) => n.text.includes('went to another operator')));

  // escrow: work cannot start until the buyer pays
  assert.equal((await call('POST', `/deals/${dealId}/advance`, { token: op2.token, body: { action: 'start' } })).status, 409);
  assert.equal((await call('POST', `/deals/${dealId}/pay`, { token: op2.token, body: { method: 'upi', upi_id: 'x@okaxis' } })).status, 403);
  assert.equal((await call('POST', `/deals/${dealId}/pay`, { token: buyer.token, body: { method: 'upi', upi_id: 'not a upi' } })).status, 400);
  const paid = await call('POST', `/deals/${dealId}/pay`, { token: buyer.token, body: { method: 'upi', upi_id: 'testbricks@okaxis' } });
  assert.equal(paid.status, 201, JSON.stringify(paid.data));
  assert.equal(paid.data.status, 'held');
  assert.equal(paid.data.breakdown.operator, 42000);
  assert.equal(paid.data.amount, paid.data.breakdown.total);
  assert.equal((await call('POST', `/deals/${dealId}/pay`, { token: buyer.token, body: { method: 'upi', upi_id: 'testbricks@okaxis' } })).status, 409);
  const opPay = await call('GET', '/payments', { token: op2.token });
  assert.equal(opPay.data.summary.in_escrow, 42000);

  // role gates on deal progress
  assert.equal((await call('POST', `/deals/${dealId}/advance`, { token: farmer.token, body: { action: 'start' } })).status, 409);
  assert.equal((await call('POST', `/deals/${dealId}/advance`, { token: op2.token, body: { action: 'start' } })).status, 200);

  // order tracking: operator posts updates, everyone on the deal sees them
  assert.equal((await call('POST', `/deals/${dealId}/updates`, { token: op2.token, body: { stage: 'baling', acres_done: 99 } })).status, 400);
  assert.equal((await call('POST', `/deals/${dealId}/updates`, { token: buyer.token, body: { stage: 'baling' } })).status, 403);
  assert.equal((await call('POST', `/deals/${dealId}/updates`, { token: op2.token, body: { stage: 'baling', acres_done: 6, note: 'Half done' } })).status, 201);
  assert.equal((await call('POST', `/deals/${dealId}/updates`, { token: op2.token, body: { stage: 'in_transit' } })).status, 201);
  const track = await call('GET', `/deals/${dealId}/track`, { token: buyer.token });
  assert.equal(track.status, 200);
  assert.equal(track.data.acres_done, 6);
  assert.equal(track.data.current, 'delivered');
  assert.ok(track.data.steps.find((x) => x.key === 'paid').done);
  assert.equal((await call('GET', `/deals/${dealId}/track`, { token: op1.token })).status, 404);
  assert.equal((await call('POST', `/deals/${dealId}/advance`, { token: farmer.token, body: { action: 'confirm' } })).status, 409);
  assert.equal((await call('POST', `/deals/${dealId}/advance`, { token: op2.token, body: { action: 'complete' } })).status, 200);
  assert.equal((await call('POST', `/deals/${dealId}/advance`, { token: farmer.token, body: { action: 'confirm' } })).status, 200);

  // rating
  assert.equal((await call('POST', `/deals/${dealId}/rate`, { token: farmer.token, body: { stars: 5, comment: 'Great' } })).status, 201);
  assert.equal((await call('POST', `/deals/${dealId}/rate`, { token: farmer.token, body: { stars: 4 } })).status, 409);
  const me = await call('GET', '/me', { token: op2.token });
  assert.equal(me.data.stats.rating, 5);
  assert.equal(me.data.stats.jobs_done, 1);

  // escrow released on confirmation: operator paid, buyer ledger shows the escrow as released
  const opLedger = await call('GET', '/payments', { token: op2.token });
  assert.equal(opLedger.data.summary.received, 42000);
  assert.equal(opLedger.data.summary.in_escrow, 0);
  const buyerLedger = await call('GET', '/payments', { token: buyer.token });
  assert.equal(buyerLedger.data.items.find((p) => p.kind === 'escrow').status, 'released');
  const done = await call('GET', `/deals/${dealId}/track`, { token: farmer.token });
  assert.equal(done.data.pct, 100);

  const stats = await call('GET', '/stats');
  assert.equal(stats.data.deals_completed, 1);
  assert.equal(stats.data.tonnes_diverted, 25);
});

test('cancelling a requirement reopens the land and closes bids', async () => {
  const farmer = await signup('farmer');
  const buyer = await signup('buyer', { company: 'Cancel Co' });
  const op = await signup('operator', { company: 'Op', equipment: 'baler', capacity_acres_per_day: 5 });
  const l = await call('POST', '/listings', { token: farmer.token, body: { crop: 'wheat', acres: 4, state: 'Punjab', district: 'Ludhiana', clear_by: future(6) } });
  const r = await call('POST', '/requirements', { token: buyer.token, body: { listing_id: l.data.id, budget_total: 20000, needed_by: future(5) } });
  await call('POST', `/requirements/${r.data.id}/bids`, { token: op.token, body: { price_total: 15000, days: 3 } });
  assert.equal((await call('POST', `/requirements/${r.data.id}/cancel`, { token: buyer.token })).status, 200);
  const mine = await call('GET', '/listings/mine', { token: farmer.token });
  assert.equal(mine.data.items[0].status, 'open');
  const bids = await call('GET', '/operator/bids', { token: op.token });
  assert.equal(bids.data.items[0].status, 'rejected');
});

test('cancelling a paid deal before work starts refunds the buyer', async () => {
  const farmer = await signup('farmer');
  const buyer = await signup('buyer', { company: 'Refund Co' });
  const op = await signup('operator', { company: 'Op R', equipment: 'baler', capacity_acres_per_day: 5 });
  const l = await call('POST', '/listings', { token: farmer.token, body: { crop: 'paddy', acres: 5, state: 'Punjab', district: 'Ludhiana', clear_by: future(9), ask_price_per_acre: 400 } });
  const r = await call('POST', '/requirements', { token: buyer.token, body: { listing_id: l.data.id, budget_total: 30000, needed_by: future(8) } });
  await call('POST', `/requirements/${r.data.id}/bids`, { token: op.token, body: { price_total: 25000, days: 4 } });
  const bidId = (await call('GET', `/requirements/${r.data.id}`, { token: buyer.token })).data.bids[0].id;
  const dealId = (await call('POST', `/requirements/${r.data.id}/award`, { token: buyer.token, body: { bid_id: bidId } })).data.deal_id;
  const paid = await call('POST', `/deals/${dealId}/pay`, { token: buyer.token, body: { method: 'netbanking', bank: 'Punjab National Bank' } });
  assert.equal(paid.status, 201);
  assert.equal(paid.data.breakdown.farmer, 2000, 'farmer asking price is part of escrow');
  assert.equal((await call('POST', `/deals/${dealId}/advance`, { token: buyer.token, body: { action: 'cancel' } })).status, 200);
  const ledger = await call('GET', '/payments', { token: buyer.token });
  assert.equal(ledger.data.summary.refunded, paid.data.amount);
  assert.equal(ledger.data.items.find((p) => p.kind === 'escrow').status, 'refunded');
  const tr = await call('GET', `/deals/${dealId}/track`, { token: farmer.token });
  assert.equal(tr.data.current, null);
});

test('auth: role-specific login, validation and access control', async () => {
  const farmer = await signup('farmer');
  const wrongRole = await call('POST', '/auth/login', { body: { email: farmer.email, password: 'secret123', role: 'buyer' } });
  assert.equal(wrongRole.status, 403);
  const ok = await call('POST', '/auth/login', { body: { email: farmer.email, password: 'secret123', role: 'farmer' } });
  assert.equal(ok.status, 200);
  const badPw = await call('POST', '/auth/login', { body: { email: farmer.email, password: 'nope-nope', role: 'farmer' } });
  assert.equal(badPw.status, 401);
  assert.equal((await call('POST', '/auth/register', { body: { role: 'farmer', name: 'x', email: farmer.email, password: 'secret123', phone: randomPhone(), state: 'Punjab', district: 'x' } })).status, 409);
  assert.equal((await call('POST', '/auth/register', { body: { role: 'farmer', name: 'x', email: 'a@b.in', password: 'short', phone: randomPhone(), state: 'Punjab', district: 'x' } })).status, 400);
  assert.equal((await call('GET', '/me')).status, 401);
  assert.equal((await call('GET', '/market/listings', { token: farmer.token })).status, 403);
  assert.equal((await call('POST', '/listings', { token: farmer.token, body: { crop: 'paddy', acres: 5, state: 'Punjab', district: 'x', clear_by: '2020-01-01' } })).status, 400);
});

test('maps: pins outside India are rejected', async () => {
  const farmer = await signup('farmer');
  const base = { crop: 'paddy', acres: 5, state: 'Punjab', district: 'Ludhiana', clear_by: future(6) };
  assert.equal((await call('POST', '/listings', { token: farmer.token, body: { ...base, lat: 51.5, lng: -0.12 } })).status, 400);
  assert.equal((await call('POST', '/listings', { token: farmer.token, body: { ...base, lat: 30.9 } })).status, 400, 'both coordinates needed');
  assert.equal((await call('POST', '/listings', { token: farmer.token, body: base })).status, 201, 'a pin is optional');
});

test('otp: sign-up needs the right code, codes expire after use, resend has a cooldown', async () => {
  const body = { role: 'farmer', name: 'Otp Test', email: `otp.${Date.now()}@test.in`, password: 'secret123',
    phone: randomPhone(), state: 'Punjab', district: 'Ludhiana', otp_channel: 'email' };
  const first = await call('POST', '/auth/register', { body });
  assert.equal(first.status, 202);
  assert.equal(first.data.channel, 'email');
  assert.ok(first.data.sent_to.endsWith('@test.in') && !first.data.sent_to.startsWith('otp.'), 'address is masked');

  const again = await call('POST', '/auth/register', { body });
  assert.equal(again.status, 429, 'resend cooldown');

  const wrong = String((Number(first.data.dev_code) + 1) % 1e6).padStart(6, '0');
  const bad = await call('POST', '/auth/register', { body: { ...body, otp_code: wrong } });
  assert.equal(bad.status, 400);
  assert.match(bad.data.error, /tries left/);

  const ok = await call('POST', '/auth/register', { body: { ...body, otp_code: first.data.dev_code } });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.user.email_verified, true);
  assert.equal(ok.data.user.phone_verified, false);

  // the same code cannot be used twice
  const reuse = await call('POST', '/auth/register', { body: { ...body, email: 'other' + body.email, otp_code: first.data.dev_code } });
  assert.notEqual(reuse.status, 201);
});

test('otp: log in with a code, and verify the other channel from the profile', async () => {
  const op = await signup('operator', { company: 'Otp Ops', equipment: '1 baler', capacity_acres_per_day: 8 });

  // phone was verified at sign-up, so a code can be sent to it
  const sent = await call('POST', '/auth/otp/send', { body: { channel: 'phone', target: op.phone, role: 'operator' } });
  assert.equal(sent.status, 200, JSON.stringify(sent.data));
  const login = await call('POST', '/auth/login/otp', { body: { channel: 'phone', target: op.phone, role: 'operator', code: sent.data.dev_code } });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.id, op.user.id);

  // email is not verified yet, so it cannot be used to log in
  assert.equal((await call('POST', '/auth/otp/send', { body: { channel: 'email', target: op.email } })).status, 404);

  const v = await call('POST', '/me/verify/send', { token: op.token, body: { channel: 'email' } });
  assert.equal(v.status, 200);
  const done = await call('POST', '/me/verify', { token: op.token, body: { channel: 'email', code: v.data.dev_code } });
  assert.equal(done.status, 200);
  assert.equal(done.data.user.email_verified, true);
  assert.equal((await call('POST', '/me/verify/send', { token: op.token, body: { channel: 'email' } })).status, 409);

  // changing the mobile number clears its verification
  const changed = await call('PUT', '/me', { token: op.token, body: { phone: randomPhone() } });
  assert.equal(changed.data.user.phone_verified, false);
});
