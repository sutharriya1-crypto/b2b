const express = require('express');
const path = require('path');
const { db } = require('./src/db');
const api = require('./src/api');
const apiGoogle = require('./src/api-google');
const apiOrders = require('./src/api-orders');
const assistant = require('./src/assistant');

const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  // Google Maps needs its own hosts: iframes (embeds) and, with an API key, the Maps JavaScript API.
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // Maps JS API, Firebase JS SDK (gstatic) and reCAPTCHA for Firebase phone sign-in
      "script-src 'self' https://maps.googleapis.com https://maps.gstatic.com https://www.gstatic.com https://apis.google.com https://www.google.com/recaptcha/ https://www.recaptcha.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      'font-src https://fonts.gstatic.com',
      "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com https://*.googleusercontent.com https://images.unsplash.com https://commons.wikimedia.org https://upload.wikimedia.org",
      "connect-src 'self' https://*.googleapis.com https://*.google.com https://*.gstatic.com wss://*.firebaseio.com data: blob:",
      "frame-src https://www.google.com https://maps.google.com https://*.firebaseapp.com https://*.web.app https://recaptcha.google.com https://www.recaptcha.net",
      'worker-src blob:',
      "frame-ancestors 'none'",
    ].join('; ')
  );
  // Location and microphone are only used when the person taps "Use my location" or the mic button.
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(self), microphone=(self)');
  next();
});

// Photos (land records, proof of work) need bigger bodies; everything else stays small.
const bigJson = express.json({ limit: '6mb' });
const smallJson = express.json({ limit: '100kb' });
app.use((req, res, next) => (/^\/api\/(ai\/read-document|deals\/\d+\/photos)$/.test(req.path) ? bigJson : smallJson)(req, res, next));
app.use('/api', apiGoogle);
app.use('/api', assistant);
app.use('/api', apiOrders);
app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON in request.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message });
});

const PORT = Number(process.env.PORT) || 3000;

if (require.main === module) {
  if (process.env.DEMO_SEED !== '0' && db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
    require('./src/seed').seed();
    console.log('Empty database: loaded demo data (set DEMO_SEED=0 to skip). Demo password for all accounts: demo1234');
  }
    app.listen(PORT, (err) => {
    if (err) {
      console.error(err.code === 'EADDRINUSE'
        ? `Port ${PORT} is already in use. Another copy of Bale to Brick is still running. Close it first.`
        : err);
      process.exit(1);
    }
    console.log(`Bale to Brick running at http://localhost:${PORT}`);
    console.log('Google services: see http://localhost:' + PORT + '/#/tech');
  });
}

module.exports = app;
