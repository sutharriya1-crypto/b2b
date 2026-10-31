// Voice assistant (built-in engine, no AI key) and the landing-page showcase, on seeded demo data.
process.env.DB_PATH = ':memory:';
process.env.DEMO_SEED = '0';
delete process.env.GEMINI_API_KEY;
delete process.env.OLLAMA_URL;

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');
require('../src/seed').seed();

let server, base;
test.before(async () => { await new Promise((r) => { server = app.listen(0, r); }); base = `http://127.0.0.1:${server.address().port}/api`; });
test.after(() => server.close());

async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
const login = async (email, role) => (await call('POST', '/auth/login', { body: { email, password: 'demo1234', role } })).data.token;

test('showcase lists completed deals and live auctions', async () => {
  const s = await call('GET', '/showcase');
  assert.equal(s.status, 200);
  assert.equal(s.data.deals.length, 5);
  assert.ok(s.data.deals.every((d) => d.price_total < d.budget_total && d.bid_count >= 2));
  assert.ok(s.data.live.length >= 3);
});

test('assistant: visitor, buyer, operator and farmer, English and Hindi', async () => {
  const v = await call('POST', '/assistant', { body: { text: 'How does it work?' } });
  assert.equal(v.status, 200);
  assert.match(v.data.reply, /reverse auction/);
  assert.equal(v.data.engine, 'Built-in assistant');

  const buyer = await login('buyer@demo.in', 'buyer');
  const b = await call('POST', '/assistant', { token: buyer, body: { text: 'What is my lowest bid?' } });
  assert.match(b.data.reply, /live auction/);
  assert.match(b.data.reply, /₹69,000/);
  assert.equal(b.data.navigate, '#/buyer/auctions');
  const due = await call('POST', '/assistant', { token: buyer, body: { text: 'do I have payments due' } });
  assert.match(due.data.reply, /waiting for your payment/);

  const op = await login('operator@demo.in', 'operator');
  const o = await call('POST', '/assistant', { token: op, body: { text: 'मेरी बोली की रैंक क्या है', lang: 'hi' } });
  assert.match(o.data.reply, /नंबर/);

  const farmer = await login('farmer@demo.in', 'farmer');
  const f = await call('POST', '/assistant', { token: farmer, body: { text: 'where is my order' } });
  assert.match(f.data.reply, /waiting for the farmer to confirm/);
  assert.match(f.data.navigate, /^#\/track\/\d+$/);

  assert.equal((await call('POST', '/assistant', { body: { text: '' } })).status, 400);
});
