const express = require('express');
const bcrypt = require('bcryptjs');
const { db, tx } = require('./db');
const { HttpError, signToken, requireAuth, limiter } = require('./auth');
const { CROPS, STATES } = require('./constants');
const { issueOtp, checkOtpOrToken, pruneOtps, configured: otpConfigured, DEV_ALLOWED: OTP_DEMO, sendText, smsAlertsReady } = require('./otp');
const { notify } = require('./notify');
const { pingBoard } = require('./live');
const { publicConfig: firebaseConfig, verifyIdToken, firebaseReady, inboxId, firestoreReady, mirror } = require('./google/firebase');
const { haversineKm } = require('./google/routes');
const { SECRET } = require('./auth');
const payments = require('./payments');
const { logBid, lowestSeries } = require('./auction');

const REQUIRE_OTP = process.env.REQUIRE_OTP !== '0';
const MAPS_KEY = (process.env.GOOGLE_MAPS_API_KEY || '').trim() || null;

const router = express.Router();

/* ───────────────────────── helpers ───────────────────────── */

const bad = (msg) => new HttpError(400, msg);
const route = (fn) => (req, res, next) => {
  try {
    fn(req, res);
  } catch (e) {
    next(e);
  }
};

const TZ_OFFSET_MIN = Number(process.env.TZ_OFFSET_MIN ?? 330); // IST
const now = () => new Date().toISOString();
const today = () => new Date(Date.now() + TZ_OFFSET_MIN * 60000).toISOString().slice(0, 10);
const addDays = (d, n) => {
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const diffDays = (a, b) =>
  Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
const isDate = (s) =>
  typeof s === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

function reqStr(v, name, max = 120) {
  if (typeof v !== 'string' || !v.trim()) throw bad(`${name} is required.`);
  const s = v.trim();
  if (s.length > max) throw bad(`${name} is too long (max ${max} characters).`);
  return s;
}
function optStr(v, max = 500) {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') throw bad('Invalid text value.');
  const s = v.trim();
  if (s.length > max) throw bad(`Text is too long (max ${max} characters).`);
  return s || null;
}
function num(v, name, { min, max, int = false }) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw bad(`${name} must be a number.`);
  if (int && !Number.isInteger(n)) throw bad(`${name} must be a whole number.`);
  if (n < min || n > max) throw bad(`${name} must be between ${min} and ${max}.`);
  return n;
}
function phoneOf(v) {
  const digits = String(v ?? '').replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(digits)) throw bad('Enter a valid 10-digit Indian mobile number.');
  return digits;
}
function emailOf(v) {
  const email = reqStr(v, 'Email', 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw bad('Enter a valid email address.');
  return email;
}
function channelOf(v) {
  if (v !== 'email' && v !== 'phone') throw bad('Choose where to send the code: mobile number or email.');
  return v;
}
// Optional map pin. Both coordinates or neither; must fall inside India's bounding box.
function pinOf(lat, lng) {
  const empty = (v) => v == null || v === '';
  if (empty(lat) && empty(lng)) return [null, null];
  const la = num(lat, 'Latitude', { min: -90, max: 90 });
  const ln = num(lng, 'Longitude', { min: -180, max: 180 });
  if (la < 6 || la > 37.5 || ln < 68 || ln > 97.5) throw bad('The map pin is outside India. Move it onto your field.');
  return [Math.round(la * 1e6) / 1e6, Math.round(ln * 1e6) / 1e6];
}
function stateOf(v, name = 'State') {
  if (!STATES.includes(v)) throw bad(`${name} is not valid.`);
  return v;
}


const fmtD = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
const cropLabel = (k) => (CROPS[k] ? CROPS[k].label : k);

function publicUser(u) {
  return {
    id: u.id, role: u.role, name: u.name, email: u.email, phone: u.phone,
    state: u.state, district: u.district, company: u.company,
    equipment: u.equipment, capacity_acres_per_day: u.capacity_acres_per_day,
    email_verified: !!u.email_verified_at, phone_verified: !!u.phone_verified_at,
    base_lat: u.base_lat, base_lng: u.base_lng,
  };
}

function operatorStats(id) {
  const r = db.prepare('SELECT COUNT(*) AS n, AVG(stars) AS avg FROM ratings WHERE operator_id = ?').get(id);
  const d = db.prepare("SELECT COUNT(*) AS n FROM deals WHERE operator_id = ? AND status = 'completed'").get(id);
  return {
    rating: r.n ? Math.round(r.avg * 10) / 10 : null,
    rating_count: r.n,
    jobs_done: d.n,
  };
}

const BID_STATS_SQL = `
  (SELECT COUNT(*) FROM bids b WHERE b.requirement_id = r.id AND b.status = 'active') AS bid_count,
  (SELECT MIN(b.price_total) FROM bids b WHERE b.requirement_id = r.id AND b.status = 'active') AS lowest_bid`;

// Tell everyone watching a bid board that it changed (buyer, farmer, operators who bid).
function boardChanged(reqId) {
  const r = db.prepare(`SELECT r.id, r.status, r.buyer_id, l.farmer_id, ${BID_STATS_SQL} FROM requirements r JOIN listings l ON l.id = r.listing_id WHERE r.id = ?`).get(reqId);
  if (!r) return;
  const ops = db.prepare('SELECT operator_id FROM bids WHERE requirement_id = ?').all(reqId).map((b) => b.operator_id);
  pingBoard(reqId, [r.buyer_id, r.farmer_id, ...ops], { status: r.status, bid_count: r.bid_count, lowest_bid: r.lowest_bid });
}

// Text the winner and the farmer when a deal is sealed (only with Twilio or Fast2SMS, and SMS_ALERTS=1).
function smsAlert(userId, text) {
  if (process.env.SMS_ALERTS !== '1' || !smsAlertsReady()) return;
  const u = db.prepare('SELECT phone, phone_verified_at FROM users WHERE id = ?').get(userId);
  if (u?.phone_verified_at) sendText(u.phone, text).catch((e) => console.error('SMS alert failed:', e.message));
}

// Public, rounded location (about 5 km) so buyers can see roughly where land is without the exact field.
const roughPin = (l) => (l.lat == null ? {} : { approx_lat: Math.round(l.lat * 20) / 20, approx_lng: Math.round(l.lng * 20) / 20 });

// Short, safe summaries of the Gemini land-record check and the latest satellite check.
function trustInfo(l) {
  const out = {};
  if (l.doc_json) {
    const d = JSON.parse(l.doc_json);
    out.doc = { name_match: d.name_match, area_acres: d.area_acres, acres_match: d.acres_match, engine: d.engine };
  }
  if (l.sat_json) {
    const v = JSON.parse(l.sat_json);
    out.sat = { reading: v.ground?.reading ?? null, fire_days: v.fire?.fire_days?.length ?? null, checked_at: v.checked_at };
  }
  return out;
}

function getPrefs(buyerId) {
  const row = db.prepare('SELECT * FROM buyer_prefs WHERE buyer_id = ?').get(buyerId);
  if (!row) return { states: [], crops: [], min_acres: 0, max_ask_price: null };
  return {
    states: JSON.parse(row.states),
    crops: JSON.parse(row.crops),
    min_acres: row.min_acres,
    max_ask_price: row.max_ask_price,
  };
}

// How well does a listing fit this buyer? 0–100 with human-readable reasons.
function matchScore(l, prefs, buyer) {
  let s = 0;
  const why = [];
  const wantsState = prefs.states.length ? prefs.states.includes(l.state) : l.state === buyer.state;
  if (wantsState) { s += 35; why.push('state'); }
  if (l.district.toLowerCase() === (buyer.district || '').toLowerCase()) { s += 20; why.push('near_plant'); }
  if (prefs.crops.length ? prefs.crops.includes(l.crop) : false) { s += 20; why.push('crop'); }
  else if (!prefs.crops.length) s += 10;
  if (l.acres >= prefs.min_acres) { s += 15; if (prefs.min_acres > 0) why.push('size'); }
  const overBudget = prefs.max_ask_price != null && l.ask_price_per_acre > prefs.max_ask_price;
  if (prefs.max_ask_price == null) s += 5;
  else if (!overBudget) { s += 10; why.push('price'); }
  return { match: Math.min(100, s), reasons: why, over_budget: overBudget };
}

/* ───────────────────────── public ───────────────────────── */

router.get('/health', (req, res) => res.json({ ok: true }));

router.get('/meta', (req, res) => {
  res.json({
    crops: Object.entries(CROPS).map(([key, v]) => ({ key, label: v.label, tpa: v.tpa })),
    states: STATES,
    today: today(),
    maps_key: MAPS_KEY, // browser key: restrict it to your domain in Google Cloud Console
    otp: {
      required: REQUIRE_OTP,
      email: otpConfigured('email') || OTP_DEMO,
      phone: otpConfigured('phone') || OTP_DEMO,
      demo: OTP_DEMO && !(otpConfigured('email') && otpConfigured('phone')),
    },
    firebase: firebaseConfig(),
    demo: !!db.prepare("SELECT 1 FROM users WHERE email = 'farmer@demo.in'").get(),
  });
});

router.get('/stats', route((req, res) => {
  const l = db.prepare(
    "SELECT COUNT(*) AS n, COALESCE(SUM(acres),0) AS acres, COALESCE(SUM(est_tonnes),0) AS t FROM listings WHERE status != 'cancelled'"
  ).get();
  const done = db.prepare(
    `SELECT COUNT(*) AS n, COALESCE(SUM(l.acres),0) AS acres, COALESCE(SUM(l.est_tonnes),0) AS t
     FROM deals d JOIN listings l ON l.id = d.listing_id WHERE d.status = 'completed'`
  ).get();
  const ops = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'operator'").get();
  res.json({
    listings: l.n,
    acres_listed: Math.round(l.acres),
    tonnes_listed: Math.round(l.t),
    deals_completed: done.n,
    acres_cleared: Math.round(done.acres),
    tonnes_diverted: Math.round(done.t),
    operators: ops.n,
  });
}));

/* ───────────────────────── auth ───────────────────────── */

const authLimit = limiter({
  windowMs: 15 * 60 * 1000, max: 30,
  keyFn: (req) => req.ip + '|' + String(req.body?.email || '').toLowerCase(),
  message: 'Too many attempts. Please wait a few minutes and try again.',
});
const registerLimit = limiter({
  windowMs: 60 * 60 * 1000, max: 80, keyFn: (req) => req.ip,
  message: 'Too many sign-ups from this network. Please try again later.',
});

// A phone number can only be the verified login number of one account per role.
function phoneTaken(phone, role, exceptId = 0) {
  return !!db.prepare('SELECT 1 FROM users WHERE phone = ? AND role = ? AND phone_verified_at IS NOT NULL AND id != ?')
    .get(phone, role, exceptId);
}

// Sign-up is two calls to the same endpoint. Without otp_code the details are checked and a code is
// sent (202). With otp_code the code is checked and the account is created (201).
router.post('/auth/register', registerLimit, async (req, res) => {
  const b = req.body || {};
  if (!['farmer', 'buyer', 'operator'].includes(b.role)) throw bad('Choose a role: farmer, buyer or operator.');
  const name = reqStr(b.name, 'Full name', 80);
  const email = emailOf(b.email);
  if (typeof b.password !== 'string' || b.password.length < 8) throw bad('Password must be at least 8 characters.');
  if (b.password.length > 72) throw bad('Password is too long (max 72 characters).');
  const phone = phoneOf(b.phone);
  const state = stateOf(b.state);
  const district = reqStr(b.district, 'District', 60);

  let company = null, equipment = null, capacity = null;
  if (b.role === 'buyer') company = reqStr(b.company, 'Company name', 100);
  if (b.role === 'operator') {
    company = reqStr(b.company, 'Business name', 100);
    equipment = reqStr(b.equipment, 'Equipment', 300);
    capacity = num(b.capacity_acres_per_day, 'Capacity (acres per day)', { min: 1, max: 1000 });
  }

  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    throw new HttpError(409, 'An account with this email already exists. Try logging in instead.');
  }

  let verified = null;
  if (REQUIRE_OTP || b.otp_code || b.firebase_id_token) {
    const channel = channelOf(b.otp_channel || 'phone');
    const target = channel === 'email' ? email : phone;
    if (channel === 'phone' && phoneTaken(phone, b.role)) {
      throw new HttpError(409, `This mobile number is already verified on another ${b.role} account. Log in instead, or verify with your email.`);
    }
    if (!b.otp_code && !b.firebase_id_token) {
      pruneOtps();
      const sent = await issueOtp(channel, target, 'register');
      return res.status(202).json({ otp_required: true, ...sent });
    }
    await checkOtpOrToken(channel, target, 'register', b);
    verified = channel;
  }

  const hash = bcrypt.hashSync(b.password, 10);
  const ts = now();
  const user = tx(() => {
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
      throw new HttpError(409, 'An account with this email already exists. Try logging in instead.');
    }
    const info = db.prepare(
      `INSERT INTO users (role,name,email,phone,password_hash,state,district,company,equipment,capacity_acres_per_day,created_at,
                          email_verified_at, phone_verified_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(b.role, name, email, phone, hash, state, district, company, equipment, capacity, ts,
      verified === 'email' ? ts : null, verified === 'phone' ? ts : null);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
router.post('/auth/login', authLimit, route((req, res) => {
  const { email, password, role } = req.body || {};
  const user = typeof email === 'string'
    ? db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase())
    : null;
  const ok = bcrypt.compareSync(typeof password === 'string' ? password : '', user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Email or password is incorrect.');
  if (role && role !== user.role) {
    throw new HttpError(403, `This account is registered as a ${user.role}. Use the ${user.role} login.`);
  }
  res.json({ token: signToken(user), user: publicUser(user) });
}));

// Log in with a one-time code. Only works for an email or number that the account has already verified.
function findOtpLoginUser(channel, target, role) {
  if (channel === 'email') return db.prepare('SELECT * FROM users WHERE email = ? AND email_verified_at IS NOT NULL').get(target);
  return db.prepare(
    'SELECT * FROM users WHERE phone = ? AND phone_verified_at IS NOT NULL ORDER BY (role = ?) DESC, id ASC LIMIT 1'
  ).get(target, role || '');
}
const otpTarget = (channel, v) => (channel === 'email' ? emailOf(v) : phoneOf(v));
const otpLoginLimit = limiter({
  windowMs: 15 * 60 * 1000, max: 20,
  keyFn: (req) => req.ip + '|otp|' + String(req.body?.target || '').toLowerCase(),
  message: 'Too many attempts. Please wait a few minutes and try again.',
});

router.post('/auth/otp/send', otpLoginLimit, async (req, res) => {
  const b = req.body || {};
  const channel = channelOf(b.channel);
  const target = otpTarget(channel, b.target);
  const user = findOtpLoginUser(channel, target, b.role);
  if (!user) {
    throw new HttpError(404, channel === 'email'
      ? 'No account has verified this email. Log in with your password, then verify it on your Profile page.'
      : 'No account has verified this mobile number. Log in with your password, then verify it on your Profile page.');
  }
  if (b.role && b.role !== user.role) {
    throw new HttpError(403, `This ${channel === 'email' ? 'email' : 'number'} belongs to a ${user.role} account. Use the ${user.role} login.`);
  }
  pruneOtps();
  res.json(await issueOtp(channel, target, 'login'));
});

router.post('/auth/login/otp', otpLoginLimit, async (req, res) => {
  const b = req.body || {};
  const channel = channelOf(b.channel);
  const target = otpTarget(channel, b.target);
  const user = findOtpLoginUser(channel, target, b.role);
  if (!user) throw new HttpError(401, 'The code is not right, or this account has not verified it yet.');
  await checkOtpOrToken(channel, target, 'login', b);
  res.json({ token: signToken(user), user: publicUser(user) });
});

// "Continue with Google" through Firebase Authentication. Logs in an account with the same email;
// if there is none, tells the app to start sign-up with the name and email filled in.
router.post('/auth/google', otpLoginLimit, async (req, res) => {
  if (!firebaseReady()) throw new HttpError(400, 'Google sign-in is not set up on this server.');
  let c;
  try { c = await verifyIdToken(req.body?.id_token); } catch { throw new HttpError(401, 'Google sign-in failed. Please try again.'); }
  if (!c.email || !c.email_verified) throw new HttpError(400, 'Your Google account has no verified email.');
  const email = String(c.email).toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'No account uses this Google email yet.', signup: { name: c.name || '', email } });
  const role = req.body?.role;
  if (role && role !== user.role) throw new HttpError(403, `This account is registered as a ${user.role}. Use the ${user.role} login.`);
  if (!user.email_verified_at) db.prepare('UPDATE users SET email_verified_at = ? WHERE id = ?').run(now(), user.id);
  res.json({ token: signToken(user), user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) });
});

/* ───────────────────────── profile ───────────────────────── */

router.get('/me', requireAuth(), route((req, res) => {
  const u = req.user;
  const out = { user: publicUser(u) };
  if (u.role === 'buyer') out.prefs = getPrefs(u.id);
  if (u.role === 'operator') out.stats = operatorStats(u.id);
  out.unread = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0').get(u.id).n;
  if (firestoreReady()) out.inbox_id = inboxId(u.id, SECRET);
  res.json(out);
}));

router.put('/me', requireAuth(), route((req, res) => {
  const u = req.user, b = req.body || {};
  const name = b.name !== undefined ? reqStr(b.name, 'Full name', 80) : u.name;
  const phone = b.phone !== undefined ? phoneOf(b.phone) : u.phone;
  const state = b.state !== undefined ? stateOf(b.state) : u.state;
  const district = b.district !== undefined ? reqStr(b.district, 'District', 60) : u.district;
  let { company, equipment, capacity_acres_per_day: cap } = u;
  if (u.role !== 'farmer' && b.company !== undefined) company = reqStr(b.company, 'Company name', 100);
  if (u.role === 'operator') {
    if (b.equipment !== undefined) equipment = reqStr(b.equipment, 'Equipment', 300);
    if (b.capacity_acres_per_day !== undefined)
      cap = num(b.capacity_acres_per_day, 'Capacity (acres per day)', { min: 1, max: 1000 });
  }
  const phoneVerified = phone === u.phone ? u.phone_verified_at : null; // a new number must be verified again
  if (b.base_lat !== undefined || b.base_lng !== undefined) {
    const [bl, bg] = pinOf(b.base_lat, b.base_lng);
    db.prepare('UPDATE users SET base_lat = ?, base_lng = ? WHERE id = ?').run(bl, bg, u.id);
  }
  db.prepare(
    'UPDATE users SET name=?, phone=?, state=?, district=?, company=?, equipment=?, capacity_acres_per_day=?, phone_verified_at=? WHERE id=?'
  ).run(name, phone, state, district, company, equipment, cap, phoneVerified, u.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)) });
}));

// Verify the account's own email or mobile number from the Profile page.
router.post('/me/verify/send', requireAuth(), async (req, res) => {
  const u = req.user;
  const channel = channelOf(req.body?.channel);
  if (u[`${channel}_verified_at`]) throw new HttpError(409, `Your ${channel === 'email' ? 'email' : 'mobile number'} is already verified.`);
  if (channel === 'phone' && phoneTaken(u.phone, u.role, u.id)) {
    throw new HttpError(409, `This mobile number is already verified on another ${u.role} account.`);
  }
  pruneOtps();
  res.json(await issueOtp(channel, channel === 'email' ? u.email : u.phone, 'verify'));
});

router.post('/me/verify', requireAuth(), async (req, res) => {
  const u = req.user;
  const channel = channelOf(req.body?.channel);
  await checkOtpOrToken(channel, channel === 'email' ? u.email : u.phone, 'verify', req.body || {});
  db.prepare(`UPDATE users SET ${channel}_verified_at = ? WHERE id = ?`).run(now(), u.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)) });
});

router.put('/me/password', requireAuth(), route((req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!bcrypt.compareSync(String(current_password || ''), req.user.password_hash))
    throw new HttpError(403, 'Current password is incorrect.');
  if (typeof new_password !== 'string' || new_password.length < 8 || new_password.length > 72)
    throw bad('New password must be 8–72 characters.');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(new_password, 10), req.user.id);
  res.json({ ok: true });
}));

router.put('/buyer/prefs', requireAuth('buyer'), route((req, res) => {
  const b = req.body || {};
  const states = Array.isArray(b.states) ? [...new Set(b.states)] : [];
  states.forEach((s) => stateOf(s));
  const crops = Array.isArray(b.crops) ? [...new Set(b.crops)] : [];
  crops.forEach((c) => { if (!CROPS[c]) throw bad('Unknown crop type.'); });
  const minAcres = b.min_acres === '' || b.min_acres == null ? 0 : num(b.min_acres, 'Minimum acres', { min: 0, max: 5000 });
  const maxAsk = b.max_ask_price === '' || b.max_ask_price == null
    ? null : num(b.max_ask_price, 'Maximum price per acre', { min: 0, max: 100000, int: true });
  db.prepare(
    `INSERT INTO buyer_prefs (buyer_id, states, crops, min_acres, max_ask_price, updated_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(buyer_id) DO UPDATE SET states=excluded.states, crops=excluded.crops,
       min_acres=excluded.min_acres, max_ask_price=excluded.max_ask_price, updated_at=excluded.updated_at`
  ).run(req.user.id, JSON.stringify(states), JSON.stringify(crops), minAcres, maxAsk, now());
  res.json({ prefs: getPrefs(req.user.id) });
}));

/* ───────────────────────── notifications ───────────────────────── */

router.get('/notifications', requireAuth(), route((req, res) => {
  const items = db.prepare(
    'SELECT id, text, link, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50'
  ).all(req.user.id);
  const unread = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).n;
  res.json({ items, unread });
}));

router.post('/notifications/read', requireAuth(), route((req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  mirror(`inbox/${inboxId(req.user.id, SECRET)}`, { unread: 0 });
  res.json({ ok: true });
}));

/* ───────────────────────── farmer: listings ───────────────────────── */

router.post('/listings', requireAuth('farmer'), route((req, res) => {
  const b = req.body || {};
  if (!CROPS[b.crop]) throw bad('Choose the crop residue type.');
  const acres = num(b.acres, 'Land area (acres)', { min: 0.5, max: 5000 });
  const state = stateOf(b.state);
  const district = reqStr(b.district, 'District', 60);
  const village = optStr(b.village, 80);
  const address = optStr(b.address, 300);
  if (!isDate(b.clear_by)) throw bad('Choose the date by which the land must be cleared.');
  if (b.clear_by <= today()) throw bad('The clearing date must be after today.');
  if (diffDays(today(), b.clear_by) > 180) throw bad('The clearing date must be within 180 days.');
  const ask = b.ask_price_per_acre === '' || b.ask_price_per_acre == null
    ? 0 : num(b.ask_price_per_acre, 'Asking price per acre', { min: 0, max: 100000, int: true });
  const est = b.est_tonnes === '' || b.est_tonnes == null
    ? Math.round(acres * CROPS[b.crop].tpa * 10) / 10
    : num(b.est_tonnes, 'Estimated tonnes', { min: 0.1, max: 50000 });
  const notes = optStr(b.notes, 500);
  const [lat, lng] = pinOf(b.lat, b.lng);
  let docJson = null;
  if (b.doc_id) {
    const d = db.prepare('SELECT data_json FROM land_docs WHERE id = ? AND farmer_id = ?').get(b.doc_id, req.user.id);
    if (!d) throw bad('That land record scan was not found. Scan it again.');
    const data = JSON.parse(d.data_json);
    data.acres_match = data.area_acres ? Math.abs(data.area_acres - acres) / acres <= 0.15 : null;
    docJson = JSON.stringify(data);
  }
  const info = db.prepare(
    `INSERT INTO listings (farmer_id,crop,acres,est_tonnes,state,district,village,address,clear_by,ask_price_per_acre,notes,lat,lng,doc_json,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(req.user.id, b.crop, acres, est, state, district, village, address, b.clear_by, ask, notes, lat, lng, docJson, now());
  res.status(201).json({ id: Number(info.lastInsertRowid) });
}));

router.get('/listings/mine', requireAuth('farmer'), route((req, res) => {
  const items = db.prepare(
    `SELECT l.*, r.id AS req_id, r.status AS req_status, r.budget_total, r.needed_by,
            bu.company AS buyer_company, ${BID_STATS_SQL},
            d.id AS deal_id, d.status AS deal_status, d.due_date
       FROM listings l
       LEFT JOIN requirements r ON r.listing_id = l.id AND r.status IN ('open','awarded')
       LEFT JOIN users bu ON bu.id = r.buyer_id
       LEFT JOIN deals d ON d.requirement_id = r.id
      WHERE l.farmer_id = ? ORDER BY l.id DESC`
  ).all(req.user.id);
  res.json({ items });
}));

// Cancels an open requirement: bids are closed, listing goes back on the market.
function cancelRequirement(r, reasonForOperators) {
  const bids = db.prepare("SELECT * FROM bids WHERE requirement_id = ? AND status = 'active'").all(r.id);
  db.prepare("UPDATE bids SET status = 'rejected', updated_at = ? WHERE requirement_id = ? AND status = 'active'").run(now(), r.id);
  db.prepare("UPDATE requirements SET status = 'cancelled' WHERE id = ?").run(r.id);
  for (const bid of bids) notify(bid.operator_id, reasonForOperators, '#/bids');
}

router.delete('/listings/:id', requireAuth('farmer'), route((req, res) => {
  const l = db.prepare('SELECT * FROM listings WHERE id = ? AND farmer_id = ?').get(req.params.id, req.user.id);
  if (!l) throw new HttpError(404, 'Listing not found.');
  tx(() => {
    if (l.status === 'open') {
      db.prepare("UPDATE listings SET status = 'cancelled' WHERE id = ?").run(l.id);
    } else if (l.status === 'claimed') {
      const r = db.prepare("SELECT * FROM requirements WHERE listing_id = ? AND status = 'open'").get(l.id);
      if (r) {
        cancelRequirement(r, `The farmer withdrew the ${cropLabel(l.crop)} land in ${l.district}. Your bid was closed.`);
        notify(r.buyer_id, `The farmer withdrew the ${l.acres}-acre listing in ${l.district}.`, '#/buyer');
      }
      db.prepare("UPDATE listings SET status = 'cancelled' WHERE id = ?").run(l.id);
    } else {
      throw new HttpError(409, 'This land already has a sealed deal. Cancel the deal first, or ask the other parties.');
    }
  });
  res.json({ ok: true });
}));

/* ───────────────────────── buyer: find land ───────────────────────── */

router.get('/market/listings', requireAuth('buyer'), route((req, res) => {
  const q = req.query;
  const where = ["l.status = 'open'", 'l.clear_by > ?'];
  const args = [today()];
  if (q.state) { where.push('l.state = ?'); args.push(String(q.state)); }
  if (q.crop && CROPS[q.crop]) { where.push('l.crop = ?'); args.push(q.crop); }
  if (q.min_acres && Number(q.min_acres) > 0) { where.push('l.acres >= ?'); args.push(Number(q.min_acres)); }
  if (q.max_price !== undefined && q.max_price !== '' && Number.isFinite(Number(q.max_price))) {
    where.push('l.ask_price_per_acre <= ?'); args.push(Number(q.max_price));
  }
  if (q.q) {
    where.push('(l.district LIKE ? OR l.village LIKE ?)');
    const like = `%${String(q.q).slice(0, 40)}%`;
    args.push(like, like);
  }
  const rows = db.prepare(
    `SELECT l.id, l.crop, l.acres, l.est_tonnes, l.state, l.district, l.village, l.clear_by,
            l.ask_price_per_acre, l.notes, l.created_at, l.lat, l.lng, l.doc_json, l.sat_json, u.name AS farmer_name
       FROM listings l JOIN users u ON u.id = l.farmer_id
      WHERE ${where.join(' AND ')} LIMIT 300`
  ).all(...args);
  const prefs = getPrefs(req.user.id);
  const base = req.user.base_lat != null ? { lat: req.user.base_lat, lng: req.user.base_lng } : null;
  const items = rows.map(({ lat, lng, doc_json, sat_json, ...l }) => ({
    ...l,
    farmer_name: l.farmer_name.split(' ')[0],
    days_left: diffDays(today(), l.clear_by),
    ...matchScore(l, prefs, req.user),
    ...roughPin({ lat, lng }),
    ...trustInfo({ doc_json, sat_json }),
    // rounded to 5 km so it cannot be used to find the exact field
    distance_km: base && lat != null ? Math.max(5, Math.round((haversineKm(base, { lat, lng }) * 1.3) / 5) * 5) : null,
  }));
  const sort = q.sort || 'match';
  const by = {
    match: (a, b) => b.match - a.match || a.clear_by.localeCompare(b.clear_by),
    deadline: (a, b) => a.clear_by.localeCompare(b.clear_by),
    acres: (a, b) => b.acres - a.acres,
    price: (a, b) => a.ask_price_per_acre - b.ask_price_per_acre,
    distance: (a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9),
  };
  items.sort(by[sort] || by.match);
  res.json({ items, prefs });
}));

/* ───────────────────────── requirements (buyer claims land) ───────────────────────── */

router.post('/requirements', requireAuth('buyer'), route((req, res) => {
  const b = req.body || {};
  const budget = num(b.budget_total, 'Budget (₹)', { min: 1000, max: 100000000, int: true });
  if (!isDate(b.needed_by)) throw bad('Choose the date by which you need the land cleared.');
  const notes = optStr(b.notes, 500);
  const id = tx(() => {
    const l = db.prepare('SELECT * FROM listings WHERE id = ?').get(b.listing_id);
    if (!l) throw new HttpError(404, 'Listing not found.');
    if (l.status !== 'open') throw new HttpError(409, 'Another buyer has already picked this land.');
    if (b.needed_by <= today()) throw bad('Your required date must be after today.');
    if (b.needed_by > l.clear_by) throw bad(`The farmer needs the land cleared by ${fmtD(l.clear_by)}. Choose that date or earlier.`);
    const info = db.prepare(
      'INSERT INTO requirements (listing_id, buyer_id, budget_total, needed_by, notes, created_at) VALUES (?,?,?,?,?,?)'
    ).run(l.id, req.user.id, budget, b.needed_by, notes, now());
    db.prepare("UPDATE listings SET status = 'claimed' WHERE id = ?").run(l.id);
    const rid = Number(info.lastInsertRowid);
    notify(l.farmer_id, `${req.user.company} picked your ${l.acres}-acre ${cropLabel(l.crop)} land. Operators are now bidding to clear it.`, '#/farmer');
    const ops = db.prepare("SELECT id FROM users WHERE role = 'operator' AND state = ?").all(l.state);
    for (const o of ops) {
      notify(o.id, `New job in ${l.district}, ${l.state}: ${l.acres} acres, budget ${inr(budget)}, needed by ${fmtD(b.needed_by)}.`, `#/requirement/${rid}`);
    }
    return rid;
  });
  res.status(201).json({ id });
}));

router.get('/requirements/mine', requireAuth('buyer'), route((req, res) => {
  const items = db.prepare(
    `SELECT r.*, l.crop, l.acres, l.est_tonnes, l.state, l.district, l.village, l.clear_by,
            l.ask_price_per_acre, ${BID_STATS_SQL}, d.id AS deal_id, d.status AS deal_status
       FROM requirements r
       JOIN listings l ON l.id = r.listing_id
       LEFT JOIN deals d ON d.requirement_id = r.id
      WHERE r.buyer_id = ? ORDER BY r.id DESC`
  ).all(req.user.id);
  res.json({ items });
}));

function bidRank(requirementId, bid) {
  return db.prepare(
    `SELECT COUNT(*) + 1 AS rank FROM bids x
      WHERE x.requirement_id = ? AND x.status = 'active'
        AND (x.price_total < ? OR (x.price_total = ? AND x.days < ?))`
  ).get(requirementId, bid.price_total, bid.price_total, bid.days).rank;
}

router.get('/requirements/:id', requireAuth(), route((req, res) => {
  const r = db.prepare(
    `SELECT r.*, ${BID_STATS_SQL} FROM requirements r WHERE r.id = ?`
  ).get(req.params.id);
  if (!r) throw new HttpError(404, 'Requirement not found.');
  const l = db.prepare('SELECT * FROM listings WHERE id = ?').get(r.listing_id);
  const buyer = db.prepare('SELECT company FROM users WHERE id = ?').get(r.buyer_id);
  const deal = db.prepare('SELECT id, status, operator_id FROM deals WHERE requirement_id = ?').get(r.id);
  const u = req.user;
  const base = {
    id: r.id, status: r.status, budget_total: r.budget_total, needed_by: r.needed_by, notes: r.notes,
    created_at: r.created_at, bid_count: r.bid_count, lowest_bid: r.lowest_bid,
    buyer_company: buyer.company, deal_id: deal ? deal.id : null,
    days_left: diffDays(today(), r.needed_by),
  };
  const listingPublic = {
    id: l.id, crop: l.crop, acres: l.acres, est_tonnes: l.est_tonnes, state: l.state,
    district: l.district, village: l.village, clear_by: l.clear_by, notes: l.notes,
    ask_price_per_acre: l.ask_price_per_acre, ...roughPin(l), ...trustInfo(l),
  };

  if (u.role === 'buyer' && r.buyer_id === u.id) {
    const bids = db.prepare(
      `SELECT b.*, u.name AS operator_name, u.company, u.equipment, u.capacity_acres_per_day, u.state, u.district,
              (u.phone_verified_at IS NOT NULL) AS phone_verified
         FROM bids b JOIN users u ON u.id = b.operator_id
        WHERE b.requirement_id = ? AND b.status IN ('active','accepted')
        ORDER BY b.price_total ASC, b.days ASC, b.created_at ASC`
    ).all(r.id).map((b) => ({ ...b, phone_verified: !!b.phone_verified, ...operatorStats(b.operator_id),
      meets_deadline: addDays(today(), b.days) <= r.needed_by }));
    return res.json({ view: 'buyer', requirement: base, listing: listingPublic, bids, history: lowestSeries(r.id) });
  }
  if (u.role === 'operator') {
    if (r.status !== 'open' && !(deal && deal.operator_id === u.id)) throw new HttpError(404, 'This job is no longer open.');
    const mine = db.prepare('SELECT * FROM bids WHERE requirement_id = ? AND operator_id = ?').get(r.id, u.id);
    const my_bid = mine ? { ...mine, rank: mine.status === 'active' ? bidRank(r.id, mine) : null } : null;
    return res.json({ view: 'operator', requirement: base, listing: listingPublic, my_bid });
  }
  if (u.role === 'farmer' && l.farmer_id === u.id) {
    return res.json({ view: 'farmer', requirement: base, listing: listingPublic });
  }
  throw new HttpError(403, 'You do not have access to this job.');
}));

router.post('/requirements/:id/cancel', requireAuth('buyer'), route((req, res) => {
  tx(() => {
    const r = db.prepare('SELECT * FROM requirements WHERE id = ? AND buyer_id = ?').get(req.params.id, req.user.id);
    if (!r) throw new HttpError(404, 'Requirement not found.');
    if (r.status !== 'open') throw new HttpError(409, 'Only jobs that are still open for bidding can be withdrawn. For a sealed deal, cancel the deal.');
    const l = db.prepare('SELECT * FROM listings WHERE id = ?').get(r.listing_id);
    cancelRequirement(r, `${req.user.company} withdrew the job in ${l.district}. Your bid was closed.`);
    db.prepare("UPDATE listings SET status = 'open' WHERE id = ?").run(l.id);
    notify(l.farmer_id, `${req.user.company} withdrew from your ${l.acres}-acre listing. It is open for other buyers again.`, '#/farmer');
  });
  boardChanged(req.params.id);
  res.json({ ok: true });
}));

/* ───────────────────────── operator: reverse bidding ───────────────────────── */

router.get('/operator/jobs', requireAuth('operator'), route((req, res) => {
  const q = req.query;
  const where = ["r.status = 'open'", 'r.needed_by > ?'];
  const args = [req.user.id, today()];
  if (q.state) { where.push('l.state = ?'); args.push(String(q.state)); }
  if (q.crop && CROPS[q.crop]) { where.push('l.crop = ?'); args.push(q.crop); }
  let order = {
    deadline: 'r.needed_by ASC',
    budget: 'r.budget_total DESC',
    acres: 'l.acres DESC',
    newest: 'r.id DESC',
  }[q.sort];
  if (!order) {
    order = '(l.state = ?) DESC, r.needed_by ASC'; // default: jobs in my state first
    args.push(req.user.state);
  }
  const items = db.prepare(
    `SELECT r.id AS req_id, r.budget_total, r.needed_by, r.notes AS req_notes, r.created_at,
            l.id AS listing_id, l.crop, l.acres, l.est_tonnes, l.state, l.district, l.village,
            bu.company AS buyer_company, ${BID_STATS_SQL},
            mb.id AS my_bid_id, mb.price_total AS my_price, mb.days AS my_days, mb.status AS my_status
       FROM requirements r
       JOIN listings l ON l.id = r.listing_id
       JOIN users bu ON bu.id = r.buyer_id
       LEFT JOIN bids mb ON mb.requirement_id = r.id AND mb.operator_id = ?
      WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 200`
  ).all(...args);
  for (const it of items) it.days_left = diffDays(today(), it.needed_by);
  res.json({ items });
}));

router.get('/operator/bids', requireAuth('operator'), route((req, res) => {
  const items = db.prepare(
    `SELECT b.id, b.requirement_id, b.price_total, b.days, b.note, b.status, b.updated_at,
            r.status AS req_status, r.budget_total, r.needed_by,
            l.crop, l.acres, l.state, l.district,
            (SELECT MIN(x.price_total) FROM bids x WHERE x.requirement_id = b.requirement_id AND x.status = 'active') AS lowest_bid,
            (SELECT COUNT(*) FROM bids x WHERE x.requirement_id = b.requirement_id AND x.status = 'active') AS bid_count,
            (SELECT COUNT(*) + 1 FROM bids x WHERE x.requirement_id = b.requirement_id AND x.status = 'active'
               AND (x.price_total < b.price_total OR (x.price_total = b.price_total AND x.days < b.days))) AS rank,
            d.id AS deal_id, d.status AS deal_status
       FROM bids b
       JOIN requirements r ON r.id = b.requirement_id
       JOIN listings l ON l.id = r.listing_id
       LEFT JOIN deals d ON d.requirement_id = r.id AND d.operator_id = b.operator_id
      WHERE b.operator_id = ? ORDER BY b.updated_at DESC`
  ).all(req.user.id);
  res.json({ items });
}));

// Place a bid, or revise it. Revisions must improve: lower price, or same price in fewer days.
router.post('/requirements/:id/bids', requireAuth('operator'), route((req, res) => {
  const b = req.body || {};
  const price = num(b.price_total, 'Your price (₹)', { min: 1, max: 100000000, int: true });
  const days = num(b.days, 'Days to complete', { min: 1, max: 180, int: true });
  const note = optStr(b.note, 400);
  const out = tx(() => {
    const r = db.prepare('SELECT * FROM requirements WHERE id = ?').get(req.params.id);
    if (!r || r.status !== 'open') throw new HttpError(404, 'This job is no longer open for bids.');
    const l = db.prepare('SELECT * FROM listings WHERE id = ?').get(r.listing_id);
    const window = diffDays(today(), r.needed_by);
    if (window < 1) throw new HttpError(409, 'The deadline for this job has passed.');
    if (price > r.budget_total) throw bad(`Your price cannot be above the buyer's budget of ${inr(r.budget_total)}.`);
    if (days > window) throw bad(`The buyer needs this done within ${window} day${window === 1 ? '' : 's'}. Promise ${window} days or fewer.`);

    const prevLowest = db.prepare("SELECT MIN(price_total) AS p FROM bids WHERE requirement_id = ? AND status = 'active'").get(r.id).p;
    const mine = db.prepare('SELECT * FROM bids WHERE requirement_id = ? AND operator_id = ?').get(r.id, req.user.id);
    let revised = false;
    if (mine && mine.status === 'active') {
      const better = price < mine.price_total || (price === mine.price_total && days < mine.days);
      if (!better) throw new HttpError(409, `A revised bid must beat your current bid (${inr(mine.price_total)}, ${mine.days} days): lower the price, or keep the price and promise fewer days.`);
      db.prepare('UPDATE bids SET price_total=?, days=?, note=?, updated_at=? WHERE id=?').run(price, days, note, now(), mine.id);
      revised = true;
      logBid(r.id, req.user.id, 'revised', price, days);
    } else if (mine) {
      db.prepare("UPDATE bids SET price_total=?, days=?, note=?, status='active', updated_at=? WHERE id=?").run(price, days, note, now(), mine.id);
      logBid(r.id, req.user.id, 'placed', price, days);
    } else {
      db.prepare('INSERT INTO bids (requirement_id, operator_id, price_total, days, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
        .run(r.id, req.user.id, price, days, note, now(), now());
      logBid(r.id, req.user.id, 'placed', price, days);
    }
    const bid = db.prepare('SELECT * FROM bids WHERE requirement_id = ? AND operator_id = ?').get(r.id, req.user.id);
    const who = req.user.company || req.user.name;
    notify(r.buyer_id, `${who} ${revised ? 'lowered their bid to' : 'bid'} ${inr(price)} for ${days} days on your ${l.acres}-acre job in ${l.district}.`, `#/requirement/${r.id}`);
    if (prevLowest == null || price < prevLowest) {
      const others = db.prepare("SELECT operator_id FROM bids WHERE requirement_id = ? AND status = 'active' AND operator_id != ?").all(r.id, req.user.id);
      for (const o of others) {
        notify(o.operator_id, `You were undercut on the ${l.acres}-acre job in ${l.district}. The lowest bid is now ${inr(price)}.`, `#/requirement/${r.id}`);
      }
    }
    return { bid: { ...bid, rank: bidRank(r.id, bid) }, revised };
  });
  boardChanged(req.params.id);
  res.status(out.revised ? 200 : 201).json(out);
}));

router.delete('/requirements/:id/bids/mine', requireAuth('operator'), route((req, res) => {
  const r = db.prepare('SELECT * FROM requirements WHERE id = ?').get(req.params.id);
  if (!r || r.status !== 'open') throw new HttpError(409, 'Bids can only be withdrawn while the job is open.');
  const info = db.prepare("UPDATE bids SET status = 'withdrawn', updated_at = ? WHERE requirement_id = ? AND operator_id = ? AND status = 'active'")
    .run(now(), r.id, req.user.id);
  if (!info.changes) throw new HttpError(404, 'You have no active bid on this job.');
  logBid(r.id, req.user.id, 'withdrawn');
  boardChanged(r.id);
  res.json({ ok: true });
}));

/* ───────────────────────── sealing the deal ───────────────────────── */

router.post('/requirements/:id/award', requireAuth('buyer'), route((req, res) => {
  const dealId = tx(() => {
    const r = db.prepare('SELECT * FROM requirements WHERE id = ? AND buyer_id = ?').get(req.params.id, req.user.id);
    if (!r) throw new HttpError(404, 'Requirement not found.');
    if (r.status !== 'open') throw new HttpError(409, 'This job already has a deal or was withdrawn.');
    const bid = db.prepare("SELECT * FROM bids WHERE id = ? AND requirement_id = ? AND status = 'active'").get(req.body?.bid_id, r.id);
    if (!bid) throw new HttpError(404, 'That bid is no longer available.');
    const due = addDays(today(), bid.days);
    if (due > r.needed_by) throw new HttpError(409, `This operator needs ${bid.days} days, which now runs past your ${fmtD(r.needed_by)} deadline. Pick a faster bid.`);
    const l = db.prepare('SELECT * FROM listings WHERE id = ?').get(r.listing_id);

    db.prepare("UPDATE bids SET status = 'accepted', updated_at = ? WHERE id = ?").run(now(), bid.id);
    const losers = db.prepare("SELECT operator_id FROM bids WHERE requirement_id = ? AND status = 'active' AND id != ?").all(r.id, bid.id);
    db.prepare("UPDATE bids SET status = 'rejected', updated_at = ? WHERE requirement_id = ? AND status = 'active' AND id != ?").run(now(), r.id, bid.id);
    db.prepare("UPDATE requirements SET status = 'awarded', awarded_bid_id = ? WHERE id = ?").run(bid.id, r.id);
    db.prepare("UPDATE listings SET status = 'assigned' WHERE id = ?").run(l.id);
    const info = db.prepare(
      `INSERT INTO deals (requirement_id, listing_id, farmer_id, buyer_id, operator_id, bid_id, price_total, days, due_date, sealed_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).run(r.id, l.id, l.farmer_id, r.buyer_id, bid.operator_id, bid.id, bid.price_total, bid.days, due, now());
    const id = Number(info.lastInsertRowid);
    notify(bid.operator_id, `You won the ${l.acres}-acre job in ${l.district} at ${inr(bid.price_total)}. Finish by ${fmtD(due)}.`, `#/deal/${id}`);
    notify(l.farmer_id, `Deal sealed: an operator will clear your ${l.acres} acres by ${fmtD(due)}.`, `#/deal/${id}`);
    for (const o of losers) notify(o.operator_id, `The ${l.acres}-acre job in ${l.district} went to another operator.`, '#/bids');
    smsAlert(bid.operator_id, `Bale to Brick: you won the ${l.acres}-acre job in ${l.district} at ${inr(bid.price_total)}. Finish by ${fmtD(due)}.`);
    smsAlert(l.farmer_id, `Bale to Brick: deal sealed. Your ${l.acres} acres will be cleared by ${fmtD(due)}.`);
    // Read by the Cloud Function in functions/ to text the winner. Firestore rules keep this collection private.
    const vphone = (uid) => db.prepare('SELECT phone FROM users WHERE id = ? AND phone_verified_at IS NOT NULL').get(uid)?.phone || null;
    mirror(`deals/${id}`, { operator_phone: vphone(bid.operator_id), farmer_phone: vphone(l.farmer_id), district: l.district, acres: l.acres, price_total: bid.price_total, due_date: due });
    return id;
  });
  boardChanged(req.params.id);
  res.status(201).json({ deal_id: dealId });
}));

/* ───────────────────────── deals ───────────────────────── */

const DEAL_LIST_SQL = `
  SELECT d.*, l.crop, l.acres, l.est_tonnes, l.state, l.district, l.village,
         fu.name AS farmer_name, bu.company AS buyer_company, ou.company AS operator_company, ou.name AS operator_name
    FROM deals d
    JOIN listings l ON l.id = d.listing_id
    JOIN users fu ON fu.id = d.farmer_id
    JOIN users bu ON bu.id = d.buyer_id
    JOIN users ou ON ou.id = d.operator_id`;

router.get('/deals', requireAuth(), route((req, res) => {
  const col = { farmer: 'd.farmer_id', buyer: 'd.buyer_id', operator: 'd.operator_id' }[req.user.role];
  const items = db.prepare(`${DEAL_LIST_SQL} WHERE ${col} = ? ORDER BY d.id DESC`).all(req.user.id);
  res.json({ items });
}));

function loadDeal(id, user) {
  const d = db.prepare(`${DEAL_LIST_SQL} WHERE d.id = ?`).get(id);
  if (!d || ![d.farmer_id, d.buyer_id, d.operator_id].includes(user.id)) throw new HttpError(404, 'Deal not found.');
  return d;
}

router.get('/deals/:id', requireAuth(), route((req, res) => {
  const d = loadDeal(req.params.id, req.user);
  const l = db.prepare('SELECT * FROM listings WHERE id = ?').get(d.listing_id);
  const r = db.prepare('SELECT * FROM requirements WHERE id = ?').get(d.requirement_id);
  const contact = (id) => {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return {
      name: u.name, company: u.company, phone: u.phone, state: u.state, district: u.district,
      phone_verified: !!u.phone_verified_at, email_verified: !!u.email_verified_at,
    };
  };
  const operator = { ...contact(d.operator_id), ...operatorStats(d.operator_id),
    equipment: db.prepare('SELECT equipment FROM users WHERE id = ?').get(d.operator_id).equipment };
  const ratings = db.prepare('SELECT stars, comment, created_at, rater_id FROM ratings WHERE deal_id = ?').all(d.id);
  res.json({
    deal: {
      id: d.id, status: d.status, price_total: d.price_total, days: d.days, due_date: d.due_date,
      sealed_at: d.sealed_at, started_at: d.started_at, work_done_at: d.work_done_at,
      completed_at: d.completed_at, cancelled_at: d.cancelled_at, requirement_id: d.requirement_id,
    },
    listing: {
      crop: l.crop, acres: l.acres, est_tonnes: l.est_tonnes, state: l.state, district: l.district,
      village: l.village, address: l.address, clear_by: l.clear_by, notes: l.notes,
      lat: l.lat, lng: l.lng, ...trustInfo(l),
    },
    burn_check: d.burn_json ? JSON.parse(d.burn_json) : null,
    photos: db.prepare('SELECT id, uploader_id, check_json, created_at FROM deal_photos WHERE deal_id = ? ORDER BY id').all(d.id)
      .map((p) => ({ id: p.id, mine: p.uploader_id === req.user.id, check: p.check_json ? JSON.parse(p.check_json) : null, created_at: p.created_at,
        by: p.uploader_id === d.operator_id ? 'operator' : p.uploader_id === d.farmer_id ? 'farmer' : 'buyer' })),
    requirement: { budget_total: r.budget_total, needed_by: r.needed_by, notes: r.notes },
    farmer: contact(d.farmer_id), buyer: contact(d.buyer_id), operator,
    my_role: req.user.role,
    ratings: ratings.map((x) => ({ stars: x.stars, comment: x.comment, created_at: x.created_at, mine: x.rater_id === req.user.id })),
    can_rate: d.status === 'completed' && req.user.role !== 'operator' && !ratings.some((x) => x.rater_id === req.user.id),
    payment: payments.summary(d.id),
  });
}));

router.post('/deals/:id/advance', requireAuth(), route((req, res) => {
  const action = req.body?.action;
  const status = tx(() => {
    const d = loadDeal(req.params.id, req.user);
    const l = db.prepare('SELECT * FROM listings WHERE id = ?').get(d.listing_id);
    const role = req.user.role;
    const where = `${l.acres}-acre job in ${l.district}`;
    const set = (cols, vals) => db.prepare(`UPDATE deals SET ${cols} WHERE id = ?`).run(...vals, d.id);

    if (action === 'start') {
      if (role !== 'operator' || d.status !== 'sealed') throw new HttpError(409, 'Only the operator can start a sealed deal.');
      if (payments.escrowOf(d.id)?.status !== 'held') throw new HttpError(409, 'Wait for the buyer to pay into escrow before starting. Your money is safe once it is held.');
      set('status = ?, started_at = ?', ['in_progress', now()]);
      notify(d.farmer_id, `Work has started on your land (${where}).`, `#/deal/${d.id}`);
      notify(d.buyer_id, `Work has started on the ${where}.`, `#/deal/${d.id}`);
      return 'in_progress';
    }
    if (action === 'complete') {
      if (role !== 'operator' || d.status !== 'in_progress') throw new HttpError(409, 'Only the operator can mark work done once it has started.');
      set('status = ?, work_done_at = ?', ['awaiting_confirmation', now()]);
      notify(d.farmer_id, `The operator says your land is cleared (${where}). Please confirm.`, `#/deal/${d.id}`);
      notify(d.buyer_id, `The operator marked the ${where} as done. Waiting for the farmer to confirm.`, `#/deal/${d.id}`);
      return 'awaiting_confirmation';
    }
    if (action === 'confirm') {
      if (role !== 'farmer' || d.status !== 'awaiting_confirmation') throw new HttpError(409, 'The farmer confirms once the operator has marked the work done.');
      set('status = ?, completed_at = ?', ['completed', now()]);
      db.prepare("UPDATE listings SET status = 'completed' WHERE id = ?").run(l.id);
      if (payments.release(d)) {
        notify(d.operator_id, `Escrow released: ${inr(d.price_total)} sent to your bank for the ${where}.`, '#/payments');
        notify(d.buyer_id, `Escrow for the ${where} was released to the operator and the farmer.`, '#/payments');
        const farmerShare = payments.summary(d.id).breakdown.farmer;
        if (farmerShare > 0) notify(d.farmer_id, `${inr(farmerShare)} for your stubble was sent to your bank.`, '#/payments');
      }
      notify(d.operator_id, `The farmer confirmed the ${where}. Deal complete.`, `#/deal/${d.id}`);
      notify(d.buyer_id, `The farmer confirmed the ${where}. Deal complete.`, `#/deal/${d.id}`);
      return 'completed';
    }
    if (action === 'cancel') {
      if (d.status !== 'sealed') throw new HttpError(409, 'A deal can only be cancelled before work starts.');
      set('status = ?, cancelled_at = ?', ['cancelled', now()]);
      if (payments.refund(d)) notify(d.buyer_id, `Your escrow payment for the ${where} was refunded.`, '#/payments');
      db.prepare("UPDATE requirements SET status = 'cancelled' WHERE id = ?").run(d.requirement_id);
      db.prepare("UPDATE listings SET status = 'open' WHERE id = ?").run(l.id);
      const who = req.user.company || req.user.name;
      for (const uid of [d.farmer_id, d.buyer_id, d.operator_id]) {
        if (uid !== req.user.id) notify(uid, `${who} cancelled the deal for the ${where}.`, `#/deal/${d.id}`);
      }
      return 'cancelled';
    }
    throw bad('Unknown action.');
  });
  res.json({ status });
}));

router.post('/deals/:id/rate', requireAuth('farmer', 'buyer'), route((req, res) => {
  const stars = num(req.body?.stars, 'Rating', { min: 1, max: 5, int: true });
  const comment = optStr(req.body?.comment, 300);
  const d = loadDeal(req.params.id, req.user);
  if (d.status !== 'completed') throw new HttpError(409, 'You can rate the operator once the deal is complete.');
  try {
    db.prepare('INSERT INTO ratings (deal_id, rater_id, operator_id, stars, comment, created_at) VALUES (?,?,?,?,?,?)')
      .run(d.id, req.user.id, d.operator_id, stars, comment, now());
  } catch {
    throw new HttpError(409, 'You have already rated this deal.');
  }
  notify(d.operator_id, `You received a ${stars}-star rating.`, `#/deal/${d.id}`);
  res.status(201).json({ ok: true });
}));

module.exports = router;
module.exports.helpers = { num, optStr, reqStr, pinOf, isDate, today, addDays, diffDays, bad, inr, cropLabel, publicUser,
  route, now, fmtD, loadDeal, operatorStats, BID_STATS_SQL, boardChanged };
