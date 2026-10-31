// Google features, tested against a mock Gemini server (no real keys needed).
process.env.DB_PATH = ':memory:';
process.env.DEMO_SEED = '0';
process.env.GEMINI_API_KEY = 'test-key';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../server');

let server, base, mock;
const seen = [];

// Answers like Gemini's generateContent, choosing a reply from the prompt text.
function geminiReply(body) {
  const prompt = body.contents[0].parts.map((p) => p.text || '').join(' ');
  if (prompt.includes('Farmer said')) {
    return { crop: 'paddy', acres: 9.4, village: 'Lehra', district: 'Sangrur', state: 'Punjab', clear_by: '2099-01-01', ask_price_per_acre: 0, notes: '15 bigha at 0.625 acre', reply: 'आपकी 9.5 एकड़ धान की पराली दर्ज की।' };
  }
  if (prompt.includes('Extract the owner names')) {
    return { readable: true, document_type: 'Jamabandi', owner_names: ['गुरप्रीत सिंह'], owner_names_english: ['Gurpreet Singh'], khasra_numbers: ['112//4'], khewat_or_khatauni: '231', area_as_printed: '80 kanal', area_acres: 10, district: 'Ludhiana', state: 'Punjab' };
  }
  if (prompt.includes('proof from a crop-residue')) return { labels: ['Hay', 'Field', 'Bale'], verdict: 'looks_right' };
  return { summary: 'Good straw for the kiln.', tips: ['Bale when dry', 'Keep the road clear', 'Stack off the ground'] };
}

test.before(async () => {
  mock = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = JSON.parse(raw);
      seen.push({ url: req.url, key: req.headers['x-goog-api-key'], body });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(geminiReply(body)) }] } }] }));
    });
  });
  await new Promise((r) => mock.listen(0, r));
  process.env.GEMINI_BASE_URL = `http://127.0.0.1:${mock.address().port}`;
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => { server.close(); mock.close(); });

async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, data };
}
const future = (n) => { const d = new Date(Date.now() + 330 * 60000); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const phone = () => '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
async function signup(role, extra = {}) {
  const n = Math.random().toString(36).slice(2, 8);
  const body = { role, name: `${role} ${n}`, email: `${role}.${n}@t.in`, password: 'secret123', phone: phone(), state: 'Punjab', district: 'Ludhiana', ...extra };
  const first = await call('POST', '/auth/register', { body });
  const r = await call('POST', '/auth/register', { body: { ...body, otp_code: first.data.dev_code } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return { token: r.data.token, user: r.data.user };
}
const fakePhoto = () => ({ mime: 'image/jpeg', image: Buffer.from(Array.from({ length: 4000 }, (_, i) => i % 251)).toString('base64') });

test('integrations status reflects configuration', async () => {
  const r = await call('GET', '/integrations');
  assert.equal(r.data.gemini, true);
  assert.equal(r.data.earth_engine, false);
  assert.equal(r.data.vertex, false);
});

test('Gemini fills a listing from Hindi speech, and bad values are dropped', async () => {
  const farmer = await signup('farmer');
  const r = await call('POST', '/ai/parse-listing', { token: farmer.token, body: { text: 'Mere paas 15 bigha dhan ki parali hai Lehra mein' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.crop, 'paddy');
  assert.equal(r.data.acres, 9.5, 'rounded to the half acre');
  assert.equal(r.data.state, 'Punjab');
  assert.equal(r.data.clear_by, undefined, 'a date more than 180 days away is dropped');
  assert.match(r.data.reply, /धान/);
  const call0 = seen.find((x) => JSON.stringify(x.body).includes('Farmer said'));
  assert.equal(call0.key, 'test-key');
  assert.equal(call0.body.generationConfig.responseMimeType, 'application/json');
  assert.equal(call0.body.generationConfig.responseSchema.type, 'OBJECT', 'schema converted to Gemini format');
  assert.equal((await call('POST', '/ai/parse-listing', { token: (await signup('buyer', { company: 'B' })).token, body: { text: 'x' } })).status, 403);
});

test('Gemini reads a land record; buyers see the check but never the photo', async () => {
  const farmer = await signup('farmer', { name: 'Gurpreet Singh' });
  const doc = await call('POST', '/ai/read-document', { token: farmer.token, body: fakePhoto() });
  assert.equal(doc.status, 200, JSON.stringify(doc.data));
  assert.equal(doc.data.name_match, true);
  assert.equal(doc.data.area_acres, 10);
  assert.ok(seen.some((x) => x.body.contents[0].parts.some((p) => p.inline_data?.mime_type === 'image/jpeg')), 'image sent inline');

  const l = await call('POST', '/listings', { token: farmer.token, body: { crop: 'paddy', acres: 10, state: 'Punjab', district: 'Ludhiana', clear_by: future(9), doc_id: doc.data.id, lat: 30.9, lng: 75.85 } });
  assert.equal(l.status, 201);
  const buyer = await signup('buyer', { company: 'Kiln Co' });
  await call('PUT', '/me', { token: buyer.token, body: { base_lat: 30.95, base_lng: 75.9 } });
  const m = await call('GET', '/market/listings?sort=distance', { token: buyer.token });
  const item = m.data.items.find((x) => x.id === l.data.id);
  assert.deepEqual(item.doc, { name_match: true, area_acres: 10, acres_match: true, engine: 'Gemini (gemini-flash-latest)' });
  assert.equal(item.lat, undefined);
  assert.equal(item.approx_lat, 30.9);
  assert.equal(item.distance_km, 10, 'distance rounded to 5 km steps');

  const other = await signup('farmer');
  assert.equal((await call('POST', '/listings', { token: other.token, body: { crop: 'paddy', acres: 4, state: 'Punjab', district: 'x', clear_by: future(5), doc_id: doc.data.id } })).status, 400, 'cannot reuse another farmer\'s scan');
});

test('estimate, price suggestion, and satellite without Earth Engine', async () => {
  const farmer = await signup('farmer');
  const e = await call('POST', '/ai/estimate', { token: farmer.token, body: { crop: 'paddy', acres: 10 } });
  assert.equal(e.data.tonnes, 25);
  assert.equal(e.data.co2_avoided_t, 36.5);
  assert.equal(e.data.advice.tips.length, 3);

  const l = await call('POST', '/listings', { token: farmer.token, body: { crop: 'wheat', acres: 8, state: 'Punjab', district: 'Ludhiana', clear_by: future(7), lat: 30.7, lng: 75.6 } });
  const buyer = await signup('buyer', { company: 'P' });
  const p = await call('POST', '/ai/price', { token: buyer.token, body: { listing_id: l.data.id } });
  assert.equal(p.status, 200);
  assert.ok(p.data.low < p.data.total && p.data.total < p.data.high);
  assert.match(p.data.source, /Local model|Starting rates/);

  const sat = await call('POST', `/listings/${l.data.id}/satellite`, { token: farmer.token });
  assert.equal(sat.status, 503);
});

test('deal: route, proof photo checked by AI, live events', async () => {
  const farmer = await signup('farmer');
  const buyer = await signup('buyer', { company: 'Route Bricks' });
  const op = await signup('operator', { company: 'Route Ops', equipment: '1 baler', capacity_acres_per_day: 10 });
  const op2 = await signup('operator', { company: 'Rival', equipment: '1 baler', capacity_acres_per_day: 10 });
  await call('PUT', '/me', { token: buyer.token, body: { base_lat: 30.95, base_lng: 75.85 } });
  await call('PUT', '/me', { token: op.token, body: { base_lat: 30.34, base_lng: 76.38 } });
  const l = await call('POST', '/listings', { token: farmer.token, body: { crop: 'paddy', acres: 6, state: 'Punjab', district: 'Ludhiana', clear_by: future(8), lat: 30.65, lng: 75.6 } });
  const r = await call('POST', '/requirements', { token: buyer.token, body: { listing_id: l.data.id, budget_total: 40000, needed_by: future(7) } });
  await call('POST', `/requirements/${r.data.id}/bids`, { token: op.token, body: { price_total: 30000, days: 4 } });

  // op is listening; a rival undercuts -> op gets a live event
  const ctrl = new AbortController();
  const es = await fetch(`${base}/events?token=${op.token}`, { signal: ctrl.signal });
  const reader = es.body.getReader();
  const got = (async () => { let txt = ''; while (!txt.includes('"notify"')) { const { value } = await reader.read(); txt += Buffer.from(value).toString(); } return txt; })();
  await call('POST', `/requirements/${r.data.id}/bids`, { token: op2.token, body: { price_total: 29000, days: 5 } });
  const txt = await Promise.race([got, new Promise((_, rej) => setTimeout(() => rej(new Error('no live event')), 3000))]);
  assert.match(txt, /"type":"notify"/);
  ctrl.abort();

  const award = await call('POST', `/requirements/${r.data.id}/award`, { token: buyer.token, body: { bid_id: (await call('GET', `/requirements/${r.data.id}`, { token: buyer.token })).data.bids.find((b) => b.price_total === 30000).id } });
  const dealId = award.data.deal_id;

  const route = await call('GET', `/deals/${dealId}/route`, { token: farmer.token });
  assert.equal(route.data.ready, true);
  assert.ok(route.data.legs.yard_to_field.km > 50 && route.data.legs.field_to_kiln.km > 30, JSON.stringify(route.data));
  assert.match(route.data.legs.field_to_kiln.source, /Estimate/);
  assert.ok(route.data.haul_cost > 0);

  assert.equal((await call('POST', `/deals/${dealId}/photos`, { token: op.token, body: fakePhoto() })).status, 409, 'photos only after work starts');
  await call('POST', `/deals/${dealId}/pay`, { token: buyer.token, body: { method: 'card', card_last4: '4242' } });
  await call('POST', `/deals/${dealId}/advance`, { token: op.token, body: { action: 'start' } });
  const ph = await call('POST', `/deals/${dealId}/photos`, { token: op.token, body: fakePhoto() });
  assert.equal(ph.status, 201, JSON.stringify(ph.data));
  assert.equal(ph.data.check.verdict, 'looks_right');
  const img = await call('GET', `/deals/${dealId}/photos/${ph.data.id}`, { token: buyer.token });
  assert.equal(img.status, 200);
  assert.equal(img.data.length, 4000);
  assert.equal((await call('GET', `/deals/${dealId}/photos/${ph.data.id}`, { token: op2.token })).status, 404, 'strangers cannot see photos');
  const deal = await call('GET', `/deals/${dealId}`, { token: farmer.token });
  assert.equal(deal.data.photos.length, 1);
  assert.equal((await call('POST', `/deals/${dealId}/burn-check`, { token: farmer.token })).status, 503);
});
