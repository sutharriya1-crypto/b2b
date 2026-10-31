// Cloud Function: when the app seals a deal it writes deals/{id} to Firestore; this texts the
// winning operator and the farmer. Deploy with `firebase deploy --only functions`.
// Secrets: firebase functions:secrets:set FAST2SMS_API_KEY  (or the three TWILIO_* secrets).
// Use this OR the server's SMS_ALERTS=1, not both, or people get two texts.
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');

const FAST2SMS_API_KEY = defineSecret('FAST2SMS_API_KEY');
const TWILIO_ACCOUNT_SID = defineSecret('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = defineSecret('TWILIO_AUTH_TOKEN');
const TWILIO_FROM = defineSecret('TWILIO_FROM');

async function sms(phone, text) {
  if (FAST2SMS_API_KEY.value()) {
    const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: { authorization: FAST2SMS_API_KEY.value(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'q', message: text, numbers: phone }),
    });
    if (!res.ok) throw new Error('Fast2SMS ' + res.status);
    return;
  }
  const sid = TWILIO_ACCOUNT_SID.value();
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${TWILIO_AUTH_TOKEN.value()}`).toString('base64') },
    body: new URLSearchParams({ To: '+91' + phone, From: TWILIO_FROM.value(), Body: text }),
  });
  if (!res.ok) throw new Error('Twilio ' + res.status);
}

exports.textOnDealSealed = onDocumentCreated(
  { document: 'deals/{dealId}', region: 'asia-south1', secrets: [FAST2SMS_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM] },
  async (event) => {
    const d = event.data?.data();
    if (!d) return;
    const price = '₹' + Number(d.price_total).toLocaleString('en-IN');
    const jobs = [];
    if (d.operator_phone) jobs.push(sms(d.operator_phone, `Bale to Brick: you won the ${d.acres}-acre job in ${d.district} at ${price}. Finish by ${d.due_date}.`));
    if (d.farmer_phone) jobs.push(sms(d.farmer_phone, `Bale to Brick: deal sealed. Your ${d.acres} acres will be cleared by ${d.due_date}.`));
    const results = await Promise.allSettled(jobs);
    results.filter((r) => r.status === 'rejected').forEach((r) => logger.error('SMS failed', r.reason?.message));
  }
);
