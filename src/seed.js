// Demo data so every screen has something to show. Run with `npm run seed`
// (it also runs automatically on first start when the database is empty).
//
// What the demo contains, so you know where to look:
//  • 7 farmers, 4 buyers, 6 operators (all password demo1234)
//  • 6 live reverse auctions with competing bids and a price history (one has no bids yet)
//  • 5 completed deals with escrow released, payouts, ratings and field updates (landing page showcase)
//  • 2 deals in progress (crew on the field), 1 waiting for the farmer to confirm,
//    1 sealed and waiting for the buyer's payment, 1 cancelled with the escrow refunded
//  • open land on the marketplace for buyers to pick
const bcrypt = require('bcryptjs');
const { db, tx } = require('./db');
const payments = require('./payments');
const { logBid } = require('./auction');
const { CROPS } = require('./constants');

const DEMO_PASSWORD = 'demo1234';
const TZ = Number(process.env.TZ_OFFSET_MIN ?? 330);
const todayStr = () => new Date(Date.now() + TZ * 60000).toISOString().slice(0, 10);
const plus = (n) => {
  const t = new Date(todayStr() + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + Math.round(n));
  return t.toISOString().slice(0, 10);
};
const ts = (n) => new Date(Date.now() + n * 86400000).toISOString();
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');

// Approximate village centres, so deal pages show a pin on the map.
const PINS = {
  Dhuri: [30.3726, 75.8687], Nilokheri: [29.8363, 76.9298], Indri: [29.8786, 77.0592], Lehra: [29.9488, 75.8838],
  Mawana: [29.1028, 77.9186], Padampur: [29.7081, 73.6252], Sunam: [30.1281, 75.7999], Bhawanigarh: [30.2667, 76.0333],
  Raikot: [30.6514, 75.6011], Jagraon: [30.7877, 75.4730], Gharsana: [29.3920, 73.3150], Kalayat: [29.6731, 76.2630],
  Sardhana: [29.1450, 77.6150], Assandh: [29.5216, 76.6032], Raisinghnagar: [29.5360, 73.4480], Pundri: [29.7606, 76.5620],
  Pilibanga: [29.4497, 74.0867], Kithore: [28.8722, 77.9450], Khanna: [30.7050, 76.2220], Cheeka: [30.0500, 76.3400],
  Rawatsar: [29.2820, 74.4050],
};

function seed() {
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const user = (role, name, email, phone, state, district, company, equipment, cap, base) => {
    const id = Number(db.prepare(
      `INSERT INTO users (role,name,email,phone,password_hash,state,district,company,equipment,capacity_acres_per_day,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(role, name, email, phone, hash, state, district, company ?? null, equipment ?? null, cap ?? null, ts(-90)).lastInsertRowid);
    if (base) db.prepare('UPDATE users SET base_lat = ?, base_lng = ? WHERE id = ?').run(base[0], base[1], id);
    return id;
  };
  const listing = (f, crop, acres, state, district, village, clearBy, ask, notes, status, created) =>
    Number(db.prepare(
      `INSERT INTO listings (farmer_id,crop,acres,est_tonnes,state,district,village,address,clear_by,ask_price_per_acre,notes,status,lat,lng,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(f, crop, acres, Math.round(acres * CROPS[crop].tpa * 10) / 10, state, district, village, `${village} village, ${district}`,
      clearBy, ask, notes, status, PINS[village]?.[0] ?? null, PINS[village]?.[1] ?? null, ts(created)).lastInsertRowid);
  const requirement = (lid, b, budget, by, notes, status, created) =>
    Number(db.prepare('INSERT INTO requirements (listing_id,buyer_id,budget_total,needed_by,notes,status,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(lid, b, budget, by, notes, status, ts(created)).lastInsertRowid);
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
  const rate = (did, rater, op, stars, comment, at) => db.prepare(
    'INSERT INTO ratings (deal_id,rater_id,operator_id,stars,comment,created_at) VALUES (?,?,?,?,?,?)'
  ).run(did, rater, op, stars, comment, ts(at));
  const note = (uid, text, link, at, read = 0) => db.prepare(
    'INSERT INTO notifications (user_id,text,link,is_read,created_at) VALUES (?,?,?,?,?)'
  ).run(uid, text, link, read, ts(at));

  // A whole job in one call: listing → requirement → bids → deal → escrow → updates → payout.
  function job(o) {
    const lStatus = { completed: 'completed', cancelled: 'open' }[o.status] || 'assigned';
    const l = listing(o.f, o.crop, o.acres, o.state, o.district, o.village, o.clearBy || plus(o.sealed + o.days + 4), o.ask || 0, o.lnotes || null, lStatus, o.sealed - 4);
    const r = requirement(l, o.b, o.budget, plus(o.sealed + o.days + 2), o.notes || null, o.status === 'cancelled' ? 'cancelled' : 'awarded', o.sealed - 3);
    const [wop, wprice, wdays, wnote, wsteps] = o.winner;
    (o.losers || []).forEach(([op, p, d, n, st], i) => bid(r, op, p, d, n || null, 'rejected', o.sealed - 1 - i * 0.3, st || []));
    const win = bid(r, wop, wprice, wdays, wnote || null, 'accepted', o.sealed - 0.5, wsteps || []);
    db.prepare('UPDATE requirements SET awarded_bid_id = ? WHERE id = ?').run(win, r);
    const id = Number(db.prepare(
      `INSERT INTO deals (requirement_id,listing_id,farmer_id,buyer_id,operator_id,bid_id,price_total,days,due_date,status,sealed_at,started_at,work_done_at,completed_at,cancelled_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(r, l, o.f, o.b, wop, win, wprice, wdays, plus(o.sealed + wdays), o.status, ts(o.sealed),
      o.started != null ? ts(o.started) : null, o.workDone != null ? ts(o.workDone) : null,
      o.completed != null ? ts(o.completed) : null, o.cancelled != null ? ts(o.cancelled) : null).lastInsertRowid);
    if (o.pay) {
      const bk = payments.breakdown(id);
      payments.insert({ deal_id: id, kind: 'escrow', from_user: o.b, amount: bk.total, method: o.pay[0], status: 'held',
        meta: { ...bk, gateway: 'Demo gateway (no real money moves)', payer_handle: o.pay[1] }, created_at: ts(o.pay[2]) });
    }
    for (const u of o.updates || []) update(id, wop, ...u);
    const deal = { id, buyer_id: o.b, operator_id: wop, farmer_id: o.f, price_total: wprice };
    if (o.status === 'completed' && o.pay) {
      payments.release(deal);
      db.prepare("UPDATE payments SET created_at = ?, updated_at = ? WHERE deal_id = ? AND kind != 'escrow'").run(ts(o.completed), ts(o.completed), id);
      db.prepare("UPDATE payments SET updated_at = ? WHERE deal_id = ? AND kind = 'escrow'").run(ts(o.completed), id);
    }
    if (o.status === 'cancelled' && o.pay) {
      payments.refund(deal);
      db.prepare("UPDATE payments SET created_at = ?, updated_at = ? WHERE deal_id = ? AND kind = 'refund'").run(ts(o.cancelled), ts(o.cancelled), id);
      db.prepare("UPDATE payments SET updated_at = ? WHERE deal_id = ? AND kind = 'escrow'").run(ts(o.cancelled), id);
    }
    return { id, r, l };
  }
  // A live reverse auction: land picked by a buyer, operators bidding.
  function auction(o) {
    const l = listing(o.f, o.crop, o.acres, o.state, o.district, o.village, plus(o.neededIn + 2), o.ask || 0, o.lnotes || null, 'claimed', o.created - 1);
    const r = requirement(l, o.b, o.budget, plus(o.neededIn), o.notes || null, 'open', o.created);
    for (const [op, p, d, n, at, st] of o.bids || []) bid(r, op, p, d, n || null, 'active', at, st || []);
    return r;
  }

  tx(() => {
    /* ── people ── */
    const f1 = user('farmer', 'Gurpreet Singh', 'farmer@demo.in', '9876500001', 'Punjab', 'Sangrur');
    const f2 = user('farmer', 'Ramesh Yadav', 'farmer2@demo.in', '9876500002', 'Haryana', 'Karnal');
    const f3 = user('farmer', 'Sunita Devi', 'farmer3@demo.in', '9876500003', 'Uttar Pradesh', 'Meerut');
    const f4 = user('farmer', 'Mohan Lal', 'farmer4@demo.in', '9876500004', 'Rajasthan', 'Sri Ganganagar');
    const f5 = user('farmer', 'Harbhajan Singh', 'farmer5@demo.in', '9876500005', 'Punjab', 'Ludhiana');
    const f6 = user('farmer', 'Rajesh Chaudhary', 'farmer6@demo.in', '9876500006', 'Haryana', 'Kaithal');
    const f7 = user('farmer', 'Kuldeep Godara', 'farmer7@demo.in', '9876500007', 'Rajasthan', 'Hanumangarh');

    const b1 = user('buyer', 'Harjit Kaur', 'buyer@demo.in', '9876510001', 'Punjab', 'Ludhiana', 'Shree Ganesh Bricks Pvt Ltd', null, null, [30.9010, 75.8573]);
    const b2 = user('buyer', 'Amit Malik', 'buyer2@demo.in', '9876510002', 'Haryana', 'Panipat', 'GreenFuel Biomass Energy', null, null, [29.3909, 76.9635]);
    const b3 = user('buyer', 'Vikram Rathore', 'buyer3@demo.in', '9876510003', 'Rajasthan', 'Jaipur', 'Marudhar Bricks & Tiles', null, null, [26.8500, 75.7000]);
    const b4 = user('buyer', 'Neha Tyagi', 'buyer4@demo.in', '9876510004', 'Uttar Pradesh', 'Meerut', 'Ganga Bio-Power Ltd', null, null, [28.9845, 77.7064]);
    const pref = db.prepare('INSERT INTO buyer_prefs (buyer_id,states,crops,min_acres,max_ask_price,updated_at) VALUES (?,?,?,?,?,?)');
    pref.run(b1, JSON.stringify(['Punjab', 'Haryana']), JSON.stringify(['paddy']), 8, 1000, ts(-5));
    pref.run(b3, JSON.stringify(['Rajasthan']), JSON.stringify(['cotton', 'mustard', 'wheat']), 5, 600, ts(-5));

    const o1 = user('operator', 'Balwinder Sandhu', 'operator@demo.in', '9876520001', 'Punjab', 'Patiala', 'Kisan Baler Services', '3 balers, 2 rakes, 4 tractor-trolleys', 30, [30.3398, 76.3869]);
    const o2 = user('operator', 'Vijay Kumar', 'operator2@demo.in', '9876520002', 'Haryana', 'Karnal', 'Haryana Agri Machinery', '2 balers, 1 rake, 3 trucks', 22, [29.6857, 76.9905]);
    const o3 = user('operator', 'Deepak Sharma', 'operator3@demo.in', '9876520003', 'Rajasthan', 'Jaipur', 'Rajdhani Baling Co.', '4 balers, 2 rakes, 6 trucks', 40, [26.9124, 75.7873]);
    const o4 = user('operator', 'Manpreet Gill', 'operator4@demo.in', '9876520004', 'Punjab', 'Ludhiana', 'Punjab Agro Balers', '2 square balers, 1 round baler, 3 trolleys', 25, [30.9000, 75.8500]);
    const o5 = user('operator', 'Sukhdev Bains', 'operator5@demo.in', '9876520005', 'Punjab', 'Jalandhar', 'Doaba Straw Logistics', '2 balers, 5 trucks', 20, [31.3260, 75.5762]);
    const o6 = user('operator', 'Sandeep Dhull', 'operator6@demo.in', '9876520006', 'Haryana', 'Kaithal', 'Kisan Shakti Balers', '3 balers, 2 rakes, 2 trucks', 28, [29.8015, 76.3998]);

    /* ── completed deals (shown on the landing page) ── */
    const c1 = job({ f: f1, b: b1, crop: 'paddy', acres: 25, state: 'Punjab', district: 'Sangrur', village: 'Dhuri', budget: 120000,
      lnotes: 'Flat field, tractor access from the main road.', sealed: -26, days: 8, status: 'completed',
      winner: [o1, 96000, 8, 'Two balers on site from day one.', [[108000, 9, -27.8]]],
      losers: [[o4, 104000, 7, null, [[112000, 7, -28]]], [o5, 110000, 9]],
      pay: ['upi', 'shreeganesh@okhdfc', -25.5], started: -24, workDone: -19.2, completed: -18,
      updates: [['on_the_way', 'Two balers leaving Patiala yard.', null, -24.2], ['baling', null, 12, -22], ['in_transit', '3 trolleys to the kiln today.', 20, -20.5], ['delivered', '1,250 bales stacked at the kiln yard.', 25, -19.3]] });
    rate(c1.id, f1, o1, 5, 'Finished two days early and left the field clean.', -17);
    rate(c1.id, b1, o1, 4, 'Good quality bales, one late truck.', -17);

    const c2 = job({ f: f5, b: b1, crop: 'paddy', acres: 30, state: 'Punjab', district: 'Ludhiana', village: 'Jagraon', ask: 300, budget: 140000,
      sealed: -16, days: 9, status: 'completed',
      winner: [o4, 118000, 9, 'Square bales, sized for your kiln feeder.', [[132000, 9, -17.6], [124000, 9, -17]]],
      losers: [[o1, 125000, 8], [o5, 121000, 10, null, [[129000, 10, -17.4]]]],
      pay: ['netbanking', 'HDFC Bank', -15.6], started: -15, workDone: -8.4, completed: -8,
      updates: [['baling', null, 14, -12], ['in_transit', null, 24, -10], ['delivered', '1,500 bales delivered to Ludhiana kiln.', 30, -8.5]] });
    rate(c2.id, b1, o4, 5, 'Bales came straight to our kiln. Not a single smoke complaint from the village this season.', -7.5);
    rate(c2.id, f5, o4, 5, 'Got paid for my parali for the first time.', -7.4);

    const c3 = job({ f: f4, b: b3, crop: 'cotton', acres: 15, state: 'Rajasthan', district: 'Sri Ganganagar', village: 'Gharsana', budget: 60000,
      sealed: -20, days: 5, status: 'completed',
      winner: [o3, 47000, 5, null, [[52000, 6, -21.2]]], losers: [[o4, 55000, 6]],
      pay: ['upi', 'marudhar@oksbi', -19.6], started: -19, workDone: -14.6, completed: -14,
      updates: [['baling', 'Stalks uprooted and stacked.', 8, -17], ['delivered', null, 15, -14.7]] });
    rate(c3.id, f4, o3, 5, 'Field was ready for sowing on time.', -13);

    const c4 = job({ f: f6, b: b2, crop: 'paddy', acres: 22, state: 'Haryana', district: 'Kaithal', village: 'Kalayat', ask: 200, budget: 100000,
      sealed: -11, days: 6, status: 'completed',
      winner: [o6, 79000, 6, 'Local crew, 15 km from your field.', [[86000, 6, -12.4], [84000, 6, -12]]],
      losers: [[o2, 88000, 6], [o1, 86000, 7]],
      pay: ['card', '•••• 4417', -10.5], started: -10, workDone: -5.3, completed: -5,
      updates: [['on_the_way', null, null, -10], ['baling', null, 11, -8], ['in_transit', null, 18, -6.5], ['delivered', null, 22, -5.5]] });
    rate(c4.id, b2, o6, 4, 'Moisture within limits and the crew was punctual.', -4.5);

    const c5 = job({ f: f3, b: b4, crop: 'sugarcane', acres: 10, state: 'Uttar Pradesh', district: 'Meerut', village: 'Sardhana', budget: 48000,
      sealed: -22, days: 5, status: 'completed',
      winner: [o6, 39500, 5, null, [[44000, 5, -23]]], losers: [[o2, 42000, 5]],
      pay: ['upi', 'gangabio@okicici', -21.5], started: -21, workDone: -16.4, completed: -16,
      updates: [['baling', null, 6, -19], ['delivered', null, 10, -16.5]] });
    rate(c5.id, f3, o6, 5, 'No burning this year. Crew was respectful and fast.', -15);

    /* ── deals still running ── */
    // In progress for GreenFuel (buyer2), Haryana Agri Machinery on the field
    const p1 = job({ f: f2, b: b2, crop: 'paddy', acres: 10, state: 'Haryana', district: 'Karnal', village: 'Nilokheri', budget: 52000,
      notes: 'Bales must be under 25% moisture.', sealed: -6, days: 9, status: 'in_progress',
      winner: [o2, 41000, 9, null, [[47000, 9, -7.9]]], losers: [[o6, 44500, 8]],
      pay: ['netbanking', 'State Bank of India', -5.6], started: -3,
      updates: [['on_the_way', 'Crew reaches the field by 9 am.', null, -3.1], ['baling', null, 4, -2], ['baling', 'Second baler running since noon.', 6.5, -0.6]] });
    // In progress for Shree Ganesh (buyer1); operator@demo.in can post updates
    const p2 = job({ f: f5, b: b1, crop: 'paddy', acres: 16, state: 'Punjab', district: 'Ludhiana', village: 'Raikot', ask: 250, budget: 78000,
      sealed: -4, days: 8, status: 'in_progress',
      winner: [o1, 64000, 8, 'Will deliver to Ludhiana kiln directly.', [[71000, 8, -5]]], losers: [[o4, 66500, 7], [o5, 69000, 8]],
      pay: ['upi', 'shreeganesh@okhdfc', -3.7], started: -2,
      updates: [['on_the_way', 'Two balers and a rake on the way.', null, -2.1], ['baling', null, 7, -0.8]] });
    // Work done, waiting for farmer@demo.in to confirm (confirming releases escrow)
    const p3 = job({ f: f1, b: b2, crop: 'wheat', acres: 9, state: 'Punjab', district: 'Sangrur', village: 'Sunam', ask: 300, budget: 45000,
      sealed: -7, days: 6, status: 'awaiting_confirmation',
      winner: [o5, 38000, 8, null, [[41500, 8, -8]]], losers: [[o1, 39500, 5]],
      pay: ['card', '•••• 9021', -6.6], started: -5, workDone: -0.4,
      updates: [['baling', null, 5, -3], ['in_transit', 'Last 2 trolleys left at 4 pm.', 9, -0.7], ['delivered', 'All bales at the Panipat plant.', 9, -0.45]] });
    // Sealed, buyer@demo.in has not paid yet ("Pay now")
    const s1 = job({ f: f2, b: b1, crop: 'paddy', acres: 14, state: 'Haryana', district: 'Karnal', village: 'Assandh', budget: 68000,
      sealed: -0.3, days: 5, status: 'sealed',
      winner: [o4, 59000, 5, 'Crew free from tomorrow.', [[63000, 5, -1.2]]], losers: [[o2, 61000, 5], [o6, 60500, 6]], pay: null });
    // Cancelled after payment: escrow refunded to Marudhar (buyer3)
    job({ f: f4, b: b3, crop: 'cotton', acres: 8, state: 'Rajasthan', district: 'Sri Ganganagar', village: 'Raisinghnagar', budget: 34000,
      clearBy: plus(14), sealed: -8, days: 4, status: 'cancelled',
      winner: [o3, 30000, 4], losers: [[o4, 32000, 4]], pay: ['upi', 'marudhar@oksbi', -7.7], cancelled: -6.5 });

    /* ── live reverse auctions ── */
    const a1 = auction({ f: f2, b: b2, crop: 'paddy', acres: 20, state: 'Haryana', district: 'Karnal', village: 'Indri', budget: 90000, neededIn: 8, created: -3,
      lnotes: 'Two plots next to each other, near the canal road.', notes: 'Need loose bales stacked at the roadside for pickup.',
      bids: [[o2, 62000, 6, 'Local crew, can start tomorrow.', -1.6, [[74000, 7, -2.8], [68000, 6, -2.2]]],
        [o1, 58000, 7, 'Will bring a third baler if needed.', -0.6, [[66000, 7, -2.4], [61500, 7, -1.3]]],
        [o3, 71000, 5, 'Fastest turnaround; 4 balers available.', -1],
        [o6, 63500, 6, null, -0.9, [[69000, 6, -2]]]] });
    const a2 = auction({ f: f1, b: b1, crop: 'paddy', acres: 18, state: 'Punjab', district: 'Sangrur', village: 'Bhawanigarh', ask: 200, budget: 85000, neededIn: 10, created: -2.5,
      lnotes: 'Field next to the grain market road.', notes: 'Square bales preferred, delivered to our Ludhiana kiln.',
      bids: [[o1, 69000, 6, 'Can deliver straight to Ludhiana with our trolleys.', -0.4, [[82000, 7, -2.2], [76000, 7, -1.5]]],
        [o2, 72500, 5, 'Two balers free from Monday.', -0.9, [[79000, 5, -1.9]]],
        [o4, 70500, 5, null, -0.7, [[78000, 6, -2]]],
        [o5, 74000, 7, null, -1.2]] });
    const a3 = auction({ f: f6, b: b1, crop: 'paddy', acres: 26, state: 'Haryana', district: 'Kaithal', village: 'Pundri', budget: 115000, neededIn: 9, created: -2,
      bids: [[o6, 91000, 7, 'Our yard is 12 km away.', -0.3, [[98000, 7, -1.7], [94500, 7, -1]]],
        [o1, 93500, 6, null, -0.8, [[101000, 7, -1.5]]],
        [o2, 99000, 6, null, -1.2]] });
    auction({ f: f7, b: b3, crop: 'mustard', acres: 24, state: 'Rajasthan', district: 'Hanumangarh', village: 'Pilibanga', budget: 70000, neededIn: 11, created: -2,
      bids: [[o3, 57500, 6, 'Rajasthan crew, trucks to Jaipur weekly.', -0.5, [[61000, 6, -1.6]]], [o4, 63000, 7, null, -1.1]] });
    auction({ f: f3, b: b4, crop: 'paddy', acres: 12, state: 'Uttar Pradesh', district: 'Meerut', village: 'Kithore', budget: 55000, neededIn: 7, created: -1,
      bids: [[o6, 49000, 5, null, -0.5]] });
    auction({ f: f5, b: b2, crop: 'wheat', acres: 11, state: 'Punjab', district: 'Ludhiana', village: 'Khanna', budget: 42000, neededIn: 12, created: -0.2,
      notes: 'Fresh job: be the first to bid.' });

    /* ── open land on the marketplace ── */
    listing(f1, 'paddy', 12, 'Punjab', 'Sangrur', 'Lehra', plus(12), 0, 'Combine-harvested last week. Residue is dry.', 'open', -2);
    listing(f3, 'paddy', 6, 'Uttar Pradesh', 'Meerut', 'Mawana', plus(15), 500, null, 'open', -1);
    listing(f4, 'cotton', 15, 'Rajasthan', 'Sri Ganganagar', 'Padampur', plus(20), 0, 'Cotton stalks, already uprooted and stacked.', 'open', -1);
    listing(f6, 'paddy', 20, 'Haryana', 'Kaithal', 'Cheeka', plus(16), 150, 'Basmati straw, good for fodder too.', 'open', -0.5);
    listing(f7, 'mustard', 14, 'Rajasthan', 'Hanumangarh', 'Rawatsar', plus(19), 0, null, 'open', 0);

    // One listing comes with a land record that was read earlier (marked as demo data).
    db.prepare("UPDATE listings SET doc_json = ? WHERE village = 'Lehra'").run(JSON.stringify({
      document_type: 'Jamabandi', owner_names: ['Gurpreet Singh'], khasra_numbers: ['112//4', '112//5'], khewat_or_khatauni: '231',
      village: 'Lehra', district: 'Sangrur', state: 'Punjab', area_as_printed: '96 kanal', area_acres: 12,
      name_match: true, acres_match: true, engine: 'Demo data',
    }));

    /* ── notifications so the bell has something in it ── */
    note(b1, `Kisan Baler Services lowered their bid to ${inr(69000)} on your 18-acre job in Sangrur.`, `#/requirement/${a2}`, -0.4);
    note(b1, `Deal sealed with Punjab Agro Balers. Pay ${inr(payments.breakdown(s1.id).total)} into escrow so the crew can start.`, `#/deal/${s1.id}`, -0.3);
    note(b1, 'Baling in the field (7 of 16 acres): 16-acre job in Ludhiana.', `#/track/${p2.id}`, -0.8, 1);
    note(b2, 'Bales delivered at the kiln: 9-acre job in Sangrur. Waiting for the farmer to confirm.', `#/track/${p3.id}`, -0.45);
    note(b2, `Kisan Shakti Balers bid ${inr(63500)} for 6 days on your 20-acre job in Karnal.`, `#/requirement/${a1}`, -0.9);
    note(f1, 'The operator says your land in Sunam is cleared. Please confirm.', `#/track/${p3.id}`, -0.4);
    note(f1, 'Shree Ganesh Bricks picked your 18-acre land in Bhawanigarh. Operators are bidding.', '#/farmer', -2.5, 1);
    note(o1, `You are the lowest bidder on the 20-acre job in Karnal at ${inr(58000)}.`, `#/requirement/${a1}`, -0.6);
    note(o1, `You were undercut on the 26-acre job in Kaithal. The lowest bid is now ${inr(91000)}.`, `#/requirement/${a3}`, -0.3);
    note(o4, `You won the 14-acre job in Karnal at ${inr(59000)}. Waiting for the buyer's escrow payment.`, `#/deal/${s1.id}`, -0.3);
    note(o2, 'Escrow is held for the 10-acre job in Karnal. Post updates as you go.', `#/track/${p1.id}`, -3);
    note(b3, 'Your escrow payment for the 8-acre job in Sri Ganganagar was refunded.', '#/payments', -6.5, 1);

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
  farmers:   farmer@demo.in … farmer7@demo.in
  buyers:    buyer@demo.in  buyer2@demo.in  buyer3@demo.in  buyer4@demo.in
  operators: operator@demo.in … operator6@demo.in`);
  }
}
