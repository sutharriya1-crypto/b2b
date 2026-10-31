// SQLite via Node's built-in `node:sqlite` (no native build step needed).
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'bale2brick.db');
if (DB_PATH !== ':memory:') fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK (role IN ('farmer','buyer','operator')),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  company TEXT,
  equipment TEXT,
  capacity_acres_per_day REAL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS buyer_prefs (
  buyer_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  states TEXT NOT NULL DEFAULT '[]',
  crops TEXT NOT NULL DEFAULT '[]',
  min_acres REAL NOT NULL DEFAULT 0,
  max_ask_price INTEGER,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farmer_id INTEGER NOT NULL REFERENCES users(id),
  crop TEXT NOT NULL,
  acres REAL NOT NULL,
  est_tonnes REAL NOT NULL,
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  village TEXT,
  address TEXT,
  clear_by TEXT NOT NULL,
  ask_price_per_acre INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','claimed','assigned','completed','cancelled')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS requirements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  buyer_id INTEGER NOT NULL REFERENCES users(id),
  budget_total INTEGER NOT NULL,
  needed_by TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','awarded','cancelled')),
  awarded_bid_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_req_live_listing
  ON requirements(listing_id) WHERE status IN ('open','awarded');

CREATE TABLE IF NOT EXISTS bids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requirement_id INTEGER NOT NULL REFERENCES requirements(id),
  operator_id INTEGER NOT NULL REFERENCES users(id),
  price_total INTEGER NOT NULL,
  days INTEGER NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','accepted','rejected','withdrawn')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (requirement_id, operator_id)
);

CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requirement_id INTEGER NOT NULL UNIQUE REFERENCES requirements(id),
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  farmer_id INTEGER NOT NULL REFERENCES users(id),
  buyer_id INTEGER NOT NULL REFERENCES users(id),
  operator_id INTEGER NOT NULL REFERENCES users(id),
  bid_id INTEGER NOT NULL REFERENCES bids(id),
  price_total INTEGER NOT NULL,
  days INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sealed'
    CHECK (status IN ('sealed','in_progress','awaiting_confirmation','completed','cancelled')),
  sealed_at TEXT NOT NULL,
  started_at TEXT,
  work_done_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT
);

CREATE TABLE IF NOT EXISTS ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES deals(id),
  rater_id INTEGER NOT NULL REFERENCES users(id),
  operator_id INTEGER NOT NULL REFERENCES users(id),
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (deal_id, rater_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL CHECK (channel IN ('email','phone')),
  target TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('register','login','verify')),
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  consumed_at TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_otps_target ON otps(channel, target, purpose);

CREATE INDEX IF NOT EXISTS ix_listings_status ON listings(status, state);
CREATE INDEX IF NOT EXISTS ix_bids_req ON bids(requirement_id, status);
CREATE INDEX IF NOT EXISTS ix_deals_parties ON deals(farmer_id, buyer_id, operator_id);
CREATE INDEX IF NOT EXISTS ix_notif_user ON notifications(user_id, is_read);
`);

// Columns added after the first release. Older databases get them on start-up.
function addColumn(table, column, type) {
  const have = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!have) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}
addColumn('users', 'email_verified_at', 'TEXT');
addColumn('users', 'phone_verified_at', 'TEXT');
addColumn('listings', 'lat', 'REAL'); // exact field pin, private until a deal is sealed
addColumn('listings', 'lng', 'REAL');
addColumn('users', 'base_lat', 'REAL');      // buyer's kiln / operator's machine yard
addColumn('users', 'base_lng', 'REAL');
addColumn('listings', 'doc_json', 'TEXT');   // land record read by Gemini
addColumn('listings', 'sat_json', 'TEXT');   // latest Earth Engine check
addColumn('deals', 'burn_json', 'TEXT');     // zero-burn check for the deal period
addColumn('deals', 'route_json', 'TEXT');    // cached road distances

db.exec(`
CREATE TABLE IF NOT EXISTS land_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farmer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deal_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES deals(id),
  uploader_id INTEGER NOT NULL REFERENCES users(id),
  file TEXT NOT NULL,
  mime TEXT NOT NULL,
  check_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_photos_deal ON deal_photos(deal_id);
`);

// Payments (escrow ledger), order tracking updates and reverse-auction history.
db.exec(`
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES deals(id),
  kind TEXT NOT NULL CHECK (kind IN ('escrow','payout_operator','payout_farmer','refund')),
  from_user INTEGER REFERENCES users(id),
  to_user INTEGER REFERENCES users(id),
  amount INTEGER NOT NULL,
  method TEXT,
  status TEXT NOT NULL CHECK (status IN ('held','released','refunded','paid')),
  ref TEXT NOT NULL UNIQUE,
  meta_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_pay_deal ON payments(deal_id);
CREATE INDEX IF NOT EXISTS ix_pay_users ON payments(from_user, to_user);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pay_escrow ON payments(deal_id) WHERE kind = 'escrow';

CREATE TABLE IF NOT EXISTS deal_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES deals(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  stage TEXT NOT NULL CHECK (stage IN ('on_the_way','baling','loading','in_transit','delivered','note')),
  note TEXT,
  acres_done REAL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_updates_deal ON deal_updates(deal_id);

CREATE TABLE IF NOT EXISTS bid_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requirement_id INTEGER NOT NULL REFERENCES requirements(id),
  operator_id INTEGER NOT NULL REFERENCES users(id),
  price_total INTEGER,
  days INTEGER,
  kind TEXT NOT NULL CHECK (kind IN ('placed','revised','withdrawn')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_bid_events_req ON bid_events(requirement_id, created_at);
`);

// Run `fn` inside one write transaction (do not nest).
function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const UPLOAD_DIR = DB_PATH === ':memory:'
  ? path.join(require('os').tmpdir(), 'b2b-uploads-' + process.pid)
  : path.join(path.dirname(DB_PATH), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

module.exports = { db, tx, DB_PATH, UPLOAD_DIR };
