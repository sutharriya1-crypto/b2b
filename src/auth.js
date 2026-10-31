const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db, DB_PATH } = require('./db');

// JWT secret: from env, else generated once and kept next to the database.
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (DB_PATH === ':memory:') return crypto.randomBytes(32).toString('hex');
  const file = path.join(path.dirname(DB_PATH), '.jwt_secret');
  try {
    const saved = fs.readFileSync(file, 'utf8').trim();
    if (saved.length >= 32) return saved; // an empty or truncated file falls through and is replaced
  } catch { /* not created yet */ }
  const s = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(file, s, { mode: 0o600 });
  return s;
}
const SECRET = loadSecret();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, SECRET, { expiresIn: '7d' });
}

// Require a valid token; optionally restrict to certain roles.
function requireAuth(...roles) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return next(new HttpError(401, 'Please log in to continue.'));
    let payload;
    try {
      payload = jwt.verify(token, SECRET);
    } catch {
      return next(new HttpError(401, 'Your session has expired. Please log in again.'));
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user) return next(new HttpError(401, 'Account not found. Please log in again.'));
    if (roles.length && !roles.includes(user.role)) {
      return next(new HttpError(403, `This action is for ${roles.join(' / ')} accounts.`));
    }
    req.user = user;
    next();
  };
}

// Small in-memory attempt limiter (per key, fixed window).
function limiter({ windowMs, max, keyFn, message }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = keyFn(req);
    let h = hits.get(key);
    if (!h || h.reset < now) h = { count: 0, reset: now + windowMs };
    h.count += 1;
    hits.set(key, h);
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    if (h.count > max) return next(new HttpError(429, message));
    next();
  };
}

module.exports = { HttpError, signToken, requireAuth, limiter, SECRET };
