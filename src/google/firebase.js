// Firebase: Authentication (phone OTP and Google sign-in, verified on the server) and Cloud Firestore
// (live bid boards and notification pings that the browser listens to).
//
// Web app config (shown to the browser): FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
// FIREBASE_APP_ID. Firestore writes need server credentials: GOOGLE_APPLICATION_CREDENTIALS locally,
// automatic on Cloud Run. Set FIRESTORE_LIVE=1 to turn on the live mirror.
const crypto = require('crypto');

const env = (k) => (process.env[k] || '').trim();
const firebaseReady = () => !!(env('FIREBASE_API_KEY') && env('FIREBASE_PROJECT_ID'));
const firestoreReady = () => firebaseReady() && env('FIRESTORE_LIVE') === '1';

let app;
function getApp() {
  if (app) return app;
  const { initializeApp, getApps, applicationDefault } = require('firebase-admin/app');
  const opts = { projectId: env('FIREBASE_PROJECT_ID') };
  if (env('GOOGLE_APPLICATION_CREDENTIALS') || process.env.K_SERVICE) opts.credential = applicationDefault();
  app = getApps()[0] || initializeApp(opts);
  return app;
}

function publicConfig() {
  if (!firebaseReady()) return null;
  return {
    apiKey: env('FIREBASE_API_KEY'), authDomain: env('FIREBASE_AUTH_DOMAIN') || `${env('FIREBASE_PROJECT_ID')}.firebaseapp.com`,
    projectId: env('FIREBASE_PROJECT_ID'), appId: env('FIREBASE_APP_ID'),
    phone_auth: (env('SMS_PROVIDER') || '').toLowerCase() === 'firebase',
    google_signin: env('FIREBASE_GOOGLE_SIGNIN') !== '0',
    live: firestoreReady(),
  };
}

// Verifies a Firebase ID token from the browser and returns its claims.
async function verifyIdToken(token) {
  const { getAuth } = require('firebase-admin/auth');
  return getAuth(getApp()).verifyIdToken(String(token || ''));
}

// Unguessable document id for a user's notification ping.
const inboxId = (userId, secret) => crypto.createHmac('sha256', secret).update('inbox:' + userId).digest('hex').slice(0, 32);

let fsdb;
function firestore() {
  const { getFirestore } = require('firebase-admin/firestore');
  return (fsdb ||= getFirestore(getApp()));
}
// Fire-and-forget writes: the app never waits on Firestore.
function mirror(path, data) {
  if (!firestoreReady()) return;
  firestore().doc(path).set({ ...data, at: Date.now() }, { merge: true }).catch((e) => console.error('Firestore:', e.message));
}

module.exports = { firebaseReady, firestoreReady, publicConfig, verifyIdToken, inboxId, mirror };
