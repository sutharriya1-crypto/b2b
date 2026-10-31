// Demo data so every screen has something to show. Run with `npm run seed`
// (it also runs automatically on first start when the database is empty).
const bcrypt = require('bcryptjs');
const { db, tx } = require('./db');
const payments = require('./payments');
const { logBid } = require('./auction');

const DEMO_PASSWORD = 'demo1234';
const TZ = Number(process.env.TZ_OFFSET_MIN ?? 330);
const todayStr = () => new Date(Date.now() + TZ * 60000).toISOString().slice(0, 10);
const plus = (n) => {
  const t = new Date(todayStr() + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const ts = (n) => new Date(Date.now() + n * 86400000).toISOString();

function seed() {
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const user = (role, name, email, phone, state, district, company, equipment, cap) =>
    Number(db.prepare(
      `INSERT INTO users (role,name,email,phone,password_hash,state,district,company,equipment,capacity_acres_per_day,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(role, name, email, phone, hash, state, district, company ?? null, equipment ?? null, cap ?? null, ts(-60)).lastInsertRowid);

  // Approximate village centres, so the demo deal pages show a pin on the map.
  const PINS = {
    Dhuri: [30.3726, 75.8687], Nilokheri: [29.8363, 76.9298], Indri: [29.8786, 77.0592], Lehra: [29.9488, 75.8838],
    Mawana: [29.1028, 77.9186], Padampur: [29.7081, 73.6252], Sunam: [30.1281, 75.7999], Bhawanigarh: [30.2667, 76.0333],
  };
  const listing = (f, crop, acres, tonnes, state, district, village, clearBy, ask, notes, status, created) =>
    Number(db.prepare(
      `INSERT INTO listings (farmer_id,crop,acres,est_tonnes,state,district,village,address,clear_by,ask_price_per_acre,notes,status,lat,lng,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(f, crop, acres, tonnes, state, district, village, `${village} village, ${district}`, clearBy, ask, notes, status,
      PINS[village]?.[0] ?? null, PINS[village]?.[1] ?? null, ts(created)).lastInsertRowid);

  const requirement = (lid, bid, budget, by, notes, status, created) =>
    Number(db.prepare(
      'INSERT INTO requirements (listing_id,buyer_id,budget_total,needed_by,notes,status,created_at) VALUES (?,?,?,?,?,?,?)'
    ).run(lid, bid, budget, by, notes, status, ts(created)).lastInsertRowid);

  // `steps` are earlier, higher bids by the same operator, so the auction history shows prices falling.
  const bid = (rid, oid, price, days, note, status, created, steps = []) => {
    steps.forEach(([p, dd, at], i) => logBid(rid, oid, i ? 'revised' : 'placed', p, dd, ts(at)));
    logBid(rid, oid, steps.length ? 'revised' : 'placed', price, days, ts(created));
    return Number(db.prepare(
      'INSERT INTO bids (requirement_id,operator_id,price_total,days,note,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)'
    ).run(rid, oid, price, days, note, status, ts(steps[0]?.[2] ?? created), ts(created)).lastInsertRowid);
  };
  const update = (did, uid, stage, note, acres, at) => db.prepare(
    'INSERT INTO deal_updates (deal_id,user_id,stage,note,acres_done,created_at) VALUES (?,?,?,?,?,?)'
  ).run(did, uid, stage, note, acres, ts(at));

  tx(() => {
    const f1 = user('farmer', 'Gurpreet Singh', 'farmer@demo.in', '9876500001', 'Punjab', 'Sangrur');
    const f2 = user('farmer', 'Ramesh Yadav', 'farmer2@demo.in', '9876500002', 'Haryana', 'Karnal');
    const f3 = user('farmer', 'Sunita Devi', 'farmer3@demo.in', '9876500003', 'Uttar Pradesh', 'Meerut');
    const f4 = user('farmer', 'Mohan Lal', 'farmer4@demo.in', '9876500004', 'Rajasthan', 'Sri Ganganagar');

    const b1 = user('buyer', 'Harjit Kaur', 'buyer@demo.in', '9876510001', 'Punjab', 'Ludhiana', 'Shree Ganesh Bricks Pvt Ltd');
    const b2 = user('buyer', 'Amit Malik', 'buyer2@demo.in', '9876510002', 'Haryana', 'Panipat', 'GreenFuel Biomass Energy');
    db.prepare('INSERT INTO buyer_prefs (buyer_id,states,crops,min_acres,max_ask_price,updated_at) VALUES (?,?,?,?,?,?)')
      .run(b1, JSON.stringify(['Punjab', 'Haryana']), JSON.stringify(['paddy']), 8, 1000, ts(-5));

    const o1 = user('operator', 'Balwinder Sandhu', 'operator@demo.in', '9876520001', 'Punjab', 'Patiala',
      'Kisan Baler Services', '3 balers, 2 rakes, 4 tractor-trolleys', 30);
    const o2 = user('operator', 'Vijay Kumar', 'operator2@demo.in', '9876520002', 'Haryana', 'Karnal',
      'Haryana Agri Machinery', '2 balers, 1 rake, 3 trucks', 22);
    const o3 = user('operator', 'Deepak Sharma', 'operator3@demo.in', '9876520003', 'Rajasthan', 'Jaipur',
      'Rajdhani Baling Co.', '4 balers, 2 rakes, 6 trucks', 40);

    // 1. Completed deal (history + rating)
    const l5 = listing(f1, 'paddy', 25, 62.5, 'Punjab', 'Sangrur', 'Dhuri', plus(-10), 0, 'Flat field, tractor access from the main road.', 'completed', -30);
    const r5 = requirement(l5, b1, 120000, plus(-12), null, 'awarded', -28);
    const bd5 = bid(r5, o1, 96000, 8, 'Two balers on site from day one.', 'accepted', -27.2, [[108000, 9, -27.8]]);
    const d5 = Number(db.prepare(
      `INSERT INTO deals (requirement_id,listing_id,farmer_id,buyer_id,operator_id,bid_id,price_total,days,due_date,status,sealed_at,started_at,work_done_at,completed_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(r5, l5, f1, b1, o1, bd5, 96000, 8, plus(-18), 'completed', ts(-26), ts(-24), ts(-19), ts(-18)).lastInsertRowid);
    db.prepare('INSERT INTO ratings (deal_id,rater_id,operator_id,stars,comment,created_at) VALUES (?,?,?,?,?,?)')
      .run(d5, f1, o1, 5, 'Finished two days early and left the field clean.', ts(-17));
    const deal5 = { id: d5, buyer_id: b1, operator_id: o1, farmer_id: f1, price_total: 96000 };
    const bk5 = payments.breakdown(d5);
    payments.insert({ deal_id: d5, kind: 'escrow', from_user: b1, amount: bk5.total, method: 'upi', status: 'held',
      meta: { ...bk5, gateway: 'Demo gateway (no real money moves)', payer_handle: 'shreeganesh@okhdfc' }, created_at: ts(-25.5) });
    update(d5, o1, 'on_the_way', 'Two balers leaving Patiala yard.', null, -24.2);
    update(d5, o1, 'baling', null, 12, -22);
    update(d5, o1, 'in_transit', '3 trolleys to the kiln today.', 20, -20.5);
    update(d5, o1, 'delivered', '1,250 bales stacked at the kiln yard.', 25, -19.2);
    payments.release(deal5);
    db.prepare("UPDATE payments SET created_at = ?, updated_at = ? WHERE deal_id = ? AND kind != 'escrow'").run(ts(-18), ts(-18), d5);
    db.prepare("UPDATE payments SET updated_at = ? WHERE deal_id = ? AND kind = 'escrow'").run(ts(-18), d5);
    db.prepare('INSERT INTO ratings (deal_id,rater_id,operator_id,stars,comment,created_at) VALUES (?,?,?,?,?,?)')
      .run(d5, b1, o1, 4, 'Good quality bales, one late truck.', ts(-17));

    // 2. Deal in progress
    const l6 = listing(f2, 'paddy', 10, 25, 'Haryana', 'Karnal', 'Nilokheri', plus(7), 0, null, 'assigned', -9);
    const r6 = requirement(l6, b2, 52000, plus(6), 'Bales must be under 25 kg moisture limit.', 'awarded', -8);
    const bd6 = bid(r6, o2, 41000, 5, null, 'accepted', -7.3, [[47000, 6, -7.9]]);
    const d6 = db.prepare(
      `INSERT INTO deals (requirement_id,listing_id,farmer_id,buyer_id,operator_id,bid_id,price_total,days,due_date,status,sealed_at,started_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(r6, l6, f2, b2, o2, bd6, 41000, 5, plus(-2), 'in_progress', ts(-6), ts(-3)).lastInsertRowid;
    const bk6 = payments.breakdown(Number(d6));
    payments.insert({ deal_id: Number(d6), kind: 'escrow', from_user: b2, amount: bk6.total, method: 'netbanking', status: 'held',
      meta: { ...bk6, gateway: 'Demo gateway (no real money moves)', payer_handle: 'State Bank of India' }, created_at: ts(-5.6) });
    update(Number(d6), o2, 'on_the_way', 'Crew reaches the field by 9 am.', null, -3.1);
    update(Number(d6), o2, 'baling', null, 4, -2);
    update(Number(d6), o2, 'baling', 'Second baler running since noon.', 6.5, -0.6);
    // keep due date sensible for the demo
    db.prepare("UPDATE deals SET due_date = ? WHERE requirement_id = ?").run(plus(3), r6);

    // 3. Open for reverse bidding, with competing bids
    const l2 = listing(f2, 'paddy', 20, 50, 'Haryana', 'Karnal', 'Indri', plus(9), 0, 'Two plots next to each other, near the canal road.', 'claimed', -4);
    const r2 = requirement(l2, b2, 90000, plus(8), 'Need loose bales stacked at the roadside for pickup.', 'open', -3);
    bid(r2, o2, 62000, 6, 'Local crew, can start tomorrow.', 'active', -1.6, [[74000, 7, -2.8], [68000, 6, -2.2]]);
    bid(r2, o1, 58000, 7, 'Will bring a third baler if needed.', 'active', -0.6, [[66000, 7, -2.4], [61500, 7, -1.3]]);
    bid(r2, o3, 71000, 5, 'Fastest turnaround; 4 balers available.', 'active', -1);

    // 3b. A live auction for buyer@demo.in too
    const l7 = listing(f1, 'paddy', 18, 45, 'Punjab', 'Sangrur', 'Bhawanigarh', plus(11), 200, 'Field next to the grain market road.', 'claimed', -3);
    const r7 = requirement(l7, b1, 85000, plus(10), 'Square bales preferred, delivered to our Ludhiana kiln.', 'open', -2.5);
    bid(r7, o1, 69000, 6, 'Can deliver straight to Ludhiana with our trolleys.', 'active', -0.4, [[82000, 7, -2.2], [76000, 7, -1.5]]);
    bid(r7, o2, 72500, 5, 'Two balers free from Monday.', 'active', -0.9, [[79000, 5, -1.9]]);

    // 4. Open on the market for buyers to pick
    listing(f1, 'paddy', 12, 30, 'Punjab', 'Sangrur', 'Lehra', plus(12), 0, 'Combine-harvested last week. Residue is dry.', 'open', -2);
    listing(f3, 'paddy', 6, 15, 'Uttar Pradesh', 'Meerut', 'Mawana', plus(15), 500, null, 'open', -1);
    listing(f4, 'cotton', 15, 18, 'Rajasthan', 'Sri Ganganagar', 'Padampur', plus(20), 0, 'Cotton stalks, already uprooted and stacked.', 'open', -1);
    listing(f1, 'wheat', 9, 14.4, 'Punjab', 'Sangrur', 'Sunam', plus(18), 300, null, 'open', 0);

    // Kiln and machine-yard locations, so distance and road routes show in the demo.
    const base = db.prepare('UPDATE users SET base_lat = ?, base_lng = ? WHERE id = ?');
    base.run(30.9010, 75.8573, b1); base.run(29.3909, 76.9635, b2);
    base.run(30.3398, 76.3869, o1); base.run(29.6857, 76.9905, o2); base.run(26.9124, 75.7873, o3);

    // One listing comes with a land record that was read earlier (marked as demo data).
    db.prepare("UPDATE listings SET doc_json = ? WHERE village = 'Lehra'").run(JSON.stringify({
      document_type: 'Jamabandi', owner_names: ['Gurpreet Singh'], khasra_numbers: ['112//4', '112//5'], khewat_or_khatauni: '231',
      village: 'Lehra', district: 'Sangrur', state: 'Punjab', area_as_printed: '96 kanal', area_acres: 12,
      name_match: true, acres_match: true, engine: 'Demo data',
    }));

    // Demo accounts count as verified on both email and mobile.
    db.prepare('UPDATE users SET email_verified_at = ?, phone_verified_at = ?').run(ts(-60), ts(-60));
  });
}

module.exports = { seed, DEMO_PASSWORD };

if (require.main === module) {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) {
    console.log('Database already has users; not seeding. Delete data/bale2brick.db to start fresh.');
  } else {
    seed();
    console.log(`Demo data loaded. All demo accounts use the password "${DEMO_PASSWORD}":
  farmer@demo.in  farmer2@demo.in  farmer3@demo.in  farmer4@demo.in
  buyer@demo.in   buyer2@demo.in
  operator@demo.in  operator2@demo.in  operator3@demo.in`);
  }
}
