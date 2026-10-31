process.env.DB_PATH = ':memory:';
process.env.DEMO_SEED = '1';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const app = require('../server');

let server, base;
test.before(async () => {
  require('../src/seed').seed();
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server.close());

async function call(method, apiPath, { token, body } = {}) {
  const res = await fetch(base + apiPath, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('email & password login: demo accounts log in successfully without OTP or reCAPTCHA', async () => {
  // Demo farmer
  const farmerRes = await call('POST', '/auth/login', {
    body: { email: 'farmer@demo.in', password: 'demo1234', role: 'farmer' }
  });
  assert.equal(farmerRes.status, 200);
  assert.ok(farmerRes.data.token, 'Should return JWT token');
  assert.equal(farmerRes.data.user.email, 'farmer@demo.in');
  assert.equal(farmerRes.data.user.role, 'farmer');

  // Demo buyer
  const buyerRes = await call('POST', '/auth/login', {
    body: { email: 'buyer@demo.in', password: 'demo1234', role: 'buyer' }
  });
  assert.equal(buyerRes.status, 200);
  assert.ok(buyerRes.data.token);
  assert.equal(buyerRes.data.user.role, 'buyer');

  // Demo operator
  const opRes = await call('POST', '/auth/login', {
    body: { email: 'operator@demo.in', password: 'demo1234', role: 'operator' }
  });
  assert.equal(opRes.status, 200);
  assert.ok(opRes.data.token);
  assert.equal(opRes.data.user.role, 'operator');
});

test('email & password login: rejected on bad credentials or mismatched roles', async () => {
  const wrongPass = await call('POST', '/auth/login', {
    body: { email: 'farmer@demo.in', password: 'wrongpassword', role: 'farmer' }
  });
  assert.equal(wrongPass.status, 401);
  assert.match(wrongPass.data.error, /Email or password is incorrect/i);

  const wrongRole = await call('POST', '/auth/login', {
    body: { email: 'farmer@demo.in', password: 'demo1234', role: 'buyer' }
  });
  assert.equal(wrongRole.status, 403);
  assert.match(wrongRole.data.error, /registered as a farmer/i);
});

test('phone OTP flow: registration and login with OTP verify correctly', async () => {
  const phone = '98765' + Math.floor(10000 + Math.random() * 90000);
  const email = `testuser.${Date.now()}@example.in`;

  // Step 1: Register with phone OTP
  const regReq = await call('POST', '/auth/register', {
    body: {
      role: 'farmer',
      name: 'New Farmer',
      email,
      phone,
      password: 'password123',
      state: 'Punjab',
      district: 'Patiala',
      otp_channel: 'phone'
    }
  });
  assert.equal(regReq.status, 202);
  assert.ok(regReq.data.dev_code, 'Dev code present in demo/test mode');

  // Step 2: Confirm registration with OTP code
  const regConfirm = await call('POST', '/auth/register', {
    body: {
      role: 'farmer',
      name: 'New Farmer',
      email,
      phone,
      password: 'password123',
      state: 'Punjab',
      district: 'Patiala',
      otp_channel: 'phone',
      otp_code: regReq.data.dev_code
    }
  });
  assert.equal(regConfirm.status, 201);
  assert.ok(regConfirm.data.token);
  assert.equal(regConfirm.data.user.phone, phone);
  assert.equal(regConfirm.data.user.phone_verified, true);

  // Step 3: Login via Phone OTP
  const otpSend = await call('POST', '/auth/otp/send', {
    body: { channel: 'phone', target: phone, role: 'farmer' }
  });
  assert.equal(otpSend.status, 200);
  assert.ok(otpSend.data.dev_code);

  const otpLogin = await call('POST', '/auth/login/otp', {
    body: { channel: 'phone', target: phone, role: 'farmer', code: otpSend.data.dev_code }
  });
  assert.equal(otpLogin.status, 200);
  assert.ok(otpLogin.data.token);
  assert.equal(otpLogin.data.user.phone, phone);

  // Step 4: Login via Email and Password for the newly created user works independently
  const pwLogin = await call('POST', '/auth/login', {
    body: { email, password: 'password123', role: 'farmer' }
  });
  assert.equal(pwLogin.status, 200);
  assert.ok(pwLogin.data.token);
  assert.equal(pwLogin.data.user.id, regConfirm.data.user.id);
});

test('frontend app.js architecture: reCAPTCHA initialization strictly isolated to phone OTP', () => {
  const appJs = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

  // Check 1: boot() must NOT create #recaptcha-box
  assert.equal(appJs.includes("document.createElement('div'); r.id = 'recaptcha-box'"), false,
    'boot() should not create or pre-render recaptcha-box');

  // Check 2: submitters.login must not call RecaptchaVerifier or loadFirebase(['auth'])
  const loginSubmitterMatch = appJs.match(/async login\(f\) \{([\s\S]*?)\n\s*\},/);
  assert.ok(loginSubmitterMatch, 'submitters.login should exist');
  const loginBody = loginSubmitterMatch[1];
  assert.equal(loginBody.includes('RecaptchaVerifier'), false, 'login submitter must not use RecaptchaVerifier');
  assert.equal(loginBody.includes('loadFirebase'), false, 'login submitter must not load Firebase auth');
  assert.ok(loginBody.includes('/auth/login'), 'login submitter must call /auth/login directly');
  assert.ok(loginBody.includes('resetRecaptcha()'), 'login submitter resets any stale recaptcha state');

  // Check 3: startOtp must guard that reCAPTCHA is only for phone + firebase
  const startOtpMatch = appJs.match(/async function startOtp\(info, flow\) \{([\s\S]*?)\n\s*await send\(\);/);
  assert.ok(startOtpMatch, 'startOtp should exist');
  const startOtpBody = startOtpMatch[1];
  assert.ok(startOtpBody.includes("info?.channel === 'phone'"), 'startOtp must require channel phone for Firebase reCAPTCHA');
  assert.ok(startOtpBody.includes("info?.provider === 'firebase'"), 'startOtp must require provider firebase for reCAPTCHA');
  assert.ok(startOtpBody.includes('getRecaptchaContainer()'), 'startOtp must create a clean, fresh container to prevent duplicate render error');
});
