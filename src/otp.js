// One-time codes sent to an email address or an Indian mobile number.
//
// Delivery:
//   Email  -> SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM). Works with a Gmail app password.
//   SMS    -> Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM)
//             or Fast2SMS (FAST2SMS_API_KEY). Pick one with SMS_PROVIDER=twilio|fast2sms.
//             or Firebase Authentication (SMS_PROVIDER=firebase): the browser asks Firebase to text the
//             code, and the server checks the Firebase ID token it gets back.
// Demo mode: when a channel has no provider and NODE_ENV is not "production" (or OTP_DEV_MODE=1),
// the code is printed in the server log and returned to the app so the flow can be shown on stage.
const crypto = require('crypto');
const { db } = require('./db');
const { HttpError, SECRET } = require('./auth');
const { verifyIdToken, firebaseReady } = require('./google/firebase');

const TTL_MIN = Number(process.env.OTP_TTL_MIN) || 10;
const MAX_ATTEMPTS = 5;
const RESEND_SEC = Number(process.env.OTP_RESEND_SEC ?? 30);
const MAX_PER_HOUR = 6;
const DEV_ALLOWED = process.env.OTP_DEV_MODE
  ? process.env.OTP_DEV_MODE === '1'
  : process.env.NODE_ENV !== 'production';

const env = (k) => (process.env[k] || '').trim();
const emailConfigured = () => !!(env('SMTP_HOST') && env('SMTP_FROM'));
function smsProvider() {
  const p = env('SMS_PROVIDER').toLowerCase();
  if (p) return p;
  if (env('TWILIO_ACCOUNT_SID')) return 'twilio';
  if (env('FAST2SMS_API_KEY')) return 'fast2sms';
  return null;
}
const configured = (channel) => (channel === 'email' ? emailConfigured()
  : smsProvider() === 'firebase' ? firebaseReady() : !!smsProvider());
const smsAlertsReady = () => ['twilio', 'fast2sms'].includes(smsProvider());

const hashOf = (channel, target, purpose, code) =>
  crypto.createHmac('sha256', SECRET).update(`${channel}|${target}|${purpose}|${code}`).digest('hex');

function mask(channel, target) {
  if (channel === 'phone') return '+91 ' + '•'.repeat(6) + target.slice(-4);
  const [user, domain] = target.split('@');
  return user.slice(0, 2) + '•'.repeat(Math.max(2, user.length - 2)) + '@' + domain;
}

/* ───────── delivery ───────── */

let transporter;
async function sendEmail(to, code) {
  // Loaded lazily so the app still runs if nodemailer has not been installed and email is unused.
  const nodemailer = require('nodemailer');
  if (!transporter) {
    const port = Number(env('SMTP_PORT')) || 587;
    transporter = nodemailer.createTransport({
      host: env('SMTP_HOST'),
      port,
      secure: env('SMTP_SECURE') ? env('SMTP_SECURE') === '1' : port === 465,
      auth: env('SMTP_USER') ? { user: env('SMTP_USER'), pass: env('SMTP_PASS') } : undefined,
    });
  }
  await transporter.sendMail({
    from: env('SMTP_FROM'),
    to,
    subject: `${code} is your Bale to Brick code`,
    text: `Your Bale to Brick verification code is ${code}.\nIt expires in ${TTL_MIN} minutes. Do not share it with anyone.\n\n` +
      `आपका बेल टू ब्रिक कोड ${code} है। यह ${TTL_MIN} मिनट में समाप्त हो जाएगा। इसे किसी के साथ साझा न करें।`,
    html: `<div style="font-family:Arial,sans-serif;font-size:16px;color:#17262b">
      <p>Your Bale to Brick verification code is</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:12px 0">${code}</p>
      <p>It expires in ${TTL_MIN} minutes. Do not share it with anyone.</p>
      <p style="color:#55646a">आपका बेल टू ब्रिक कोड ${code} है। इसे किसी के साथ साझा न करें।</p></div>`,
  });
}

const usesFirebase = (channel) => channel === 'phone' && smsProvider() === 'firebase' && firebaseReady();

async function sendSms(phone, code) {
  return sendText(phone, `${code} is your Bale to Brick code. It expires in ${TTL_MIN} min. Do not share it.`, code);
}

// Plain SMS (deal alerts). `code` switches Fast2SMS to its OTP route.
async function sendText(phone, body, code = null) {
  const provider = smsProvider();
  const signal = AbortSignal.timeout(10000);
  if (provider === 'twilio') {
    const sid = env('TWILIO_ACCOUNT_SID');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      signal,
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${env('TWILIO_AUTH_TOKEN')}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: '+91' + phone, From: env('TWILIO_FROM'), Body: body }),
    });
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
    return;
  }
  if (provider === 'fast2sms') {
    const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      signal,
      headers: { authorization: env('FAST2SMS_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify(code ? { route: 'otp', variables_values: code, numbers: phone } : { route: 'q', message: body, numbers: phone }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.return === false) throw new Error(`Fast2SMS ${res.status}: ${JSON.stringify(data)}`);
    return;
  }
  throw new Error(`Unknown SMS_PROVIDER "${provider}"`);
}

/* ───────── issue & check ───────── */

// Creates a code and sends it. Returns { sent_to, expires_in_min, dev_code? }.
async function issueOtp(channel, target, purpose) {
  if (usesFirebase(channel)) {
    // Firebase sends the SMS from the browser (with reCAPTCHA); nothing to store here.
    return { channel, provider: 'firebase', phone_e164: '+91' + target, sent_to: mask(channel, target), expires_in_min: 5 };
  }
  const now = Date.now();
  const last = db.prepare('SELECT created_at FROM otps WHERE channel = ? AND target = ? AND purpose = ? ORDER BY id DESC LIMIT 1')
    .get(channel, target, purpose);
  if (last && now - last.created_at < RESEND_SEC * 1000) {
    const wait = Math.ceil((RESEND_SEC * 1000 - (now - last.created_at)) / 1000);
    throw new HttpError(429, `Please wait ${wait} seconds before asking for a new code.`);
  }
  const recent = db.prepare('SELECT COUNT(*) AS n FROM otps WHERE channel = ? AND target = ? AND created_at > ?')
    .get(channel, target, now - 3600000).n;
  if (recent >= MAX_PER_HOUR) throw new HttpError(429, 'Too many codes requested. Please try again in an hour.');

  const live = configured(channel);
  if (!live && !DEV_ALLOWED) {
    throw new HttpError(503, channel === 'email'
      ? 'Email codes are not set up on this server yet. Use your mobile number instead.'
      : 'SMS codes are not set up on this server yet. Use your email instead.');
  }

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  db.prepare("UPDATE otps SET consumed_at = 'superseded' WHERE channel = ? AND target = ? AND purpose = ? AND consumed_at IS NULL")
    .run(channel, target, purpose);
  const info = db.prepare('INSERT INTO otps (channel, target, purpose, code_hash, expires_at, created_at) VALUES (?,?,?,?,?,?)')
    .run(channel, target, purpose, hashOf(channel, target, purpose, code), now + TTL_MIN * 60000, now);

  const out = { channel, sent_to: mask(channel, target), expires_in_min: TTL_MIN };
  if (live) {
    try {
      if (channel === 'email') await sendEmail(target, code);
      else await sendSms(target, code);
    } catch (err) {
      console.error('OTP delivery failed:', err.message);
      db.prepare('DELETE FROM otps WHERE id = ?').run(info.lastInsertRowid);
      throw new HttpError(502, channel === 'email'
        ? 'We could not send the email. Check the address and try again.'
        : 'We could not send the SMS. Check the number and try again.');
    }
  } else {
    console.log(`[demo OTP] ${channel} ${target} (${purpose}): ${code}`);
    out.dev_code = code;
  }
  return out;
}

// Throws if the code is wrong or expired; marks it used when it matches.
function checkOtp(channel, target, purpose, code) {
  const c = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) throw new HttpError(400, 'Enter the 6-digit code.');
  const row = db.prepare(
    'SELECT * FROM otps WHERE channel = ? AND target = ? AND purpose = ? AND consumed_at IS NULL ORDER BY id DESC LIMIT 1'
  ).get(channel, target, purpose);
  if (!row || row.expires_at < Date.now()) throw new HttpError(400, 'This code has expired. Ask for a new one.');
  if (row.attempts >= MAX_ATTEMPTS) throw new HttpError(429, 'Too many wrong tries. Ask for a new code.');
  const ok = crypto.timingSafeEqual(Buffer.from(row.code_hash, 'hex'), Buffer.from(hashOf(channel, target, purpose, c), 'hex'));
  if (!ok) {
    db.prepare('UPDATE otps SET attempts = attempts + 1 WHERE id = ?').run(row.id);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw new HttpError(400, left > 0
      ? `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.`
      : 'That code is not right. Ask for a new code.');
  }
  db.prepare('UPDATE otps SET consumed_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
}

// Accepts either our own 6-digit code or a Firebase ID token that proves the same phone/email.
async function checkOtpOrToken(channel, target, purpose, { code, otp_code, firebase_id_token: tok }) {
  if (!tok) return checkOtp(channel, target, purpose, code ?? otp_code);
  if (!firebaseReady()) throw new HttpError(400, 'Firebase sign-in is not set up on this server.');
  let claims;
  try { claims = await verifyIdToken(tok); } catch { throw new HttpError(400, 'The Firebase sign-in has expired. Please try again.'); }
  const ok = channel === 'phone' ? claims.phone_number === '+91' + target : claims.email_verified && String(claims.email).toLowerCase() === target;
  if (!ok) throw new HttpError(400, channel === 'phone' ? 'That code was for a different mobile number.' : 'That Google account uses a different email.');
}

// Old codes are useless after a day; keep the table small.
function pruneOtps() {
  db.prepare('DELETE FROM otps WHERE created_at < ?').run(Date.now() - 86400000);
}

module.exports = { issueOtp, checkOtp, checkOtpOrToken, pruneOtps, configured, DEV_ALLOWED, sendText, smsAlertsReady };
