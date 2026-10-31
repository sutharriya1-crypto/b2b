// Price suggestion for clearing a plot (total ₹ for baling and hauling).
//
// Vertex AI: train an AutoML tabular regression model on the CSV from `npm run export-training`,
// deploy it to an endpoint, then set VERTEX_PROJECT, VERTEX_LOCATION (default asia-south1) and
// VERTEX_ENDPOINT_ID. Auth uses Google Application Default Credentials (automatic on Cloud Run).
// Without Vertex, a small local model learns from this platform's own past deals.
const { db } = require('../db');

const env = (k, d = '') => (process.env[k] || '').trim() || d;
const vertexReady = () => !!(env('VERTEX_PROJECT') && env('VERTEX_ENDPOINT_ID'));

// Starting rates (₹ per acre) used until enough deals exist. Edit to match your region.
const BASE_PER_ACRE = { paddy: 3500, wheat: 2800, sugarcane: 4200, cotton: 3000, maize: 3200, mustard: 2800, other: 3000 };

function features({ crop, acres, est_tonnes, days, state, month }) {
  return {
    crop: String(crop), acres: String(acres), est_tonnes: String(est_tonnes ?? ''),
    days: String(days ?? ''), state: String(state ?? ''), month: String(month ?? new Date().getMonth() + 1),
  };
}

let auth;
async function vertexPredict(f) {
  const { GoogleAuth } = require('google-auth-library');
  auth ||= new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const token = await auth.getAccessToken();
  const loc = env('VERTEX_LOCATION', 'asia-south1');
  const url = `https://${loc}-aiplatform.googleapis.com/v1/projects/${env('VERTEX_PROJECT')}/locations/${loc}/endpoints/${env('VERTEX_ENDPOINT_ID')}:predict`;
  const res = await fetch(url, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instances: [features(f)] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Vertex ${res.status}: ${data.error?.message || ''}`);
  const p = data.predictions?.[0];
  const value = Number(typeof p === 'object' ? p.value : p);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Vertex returned no usable value');
  return {
    total: Math.round(value),
    low: Math.round(Number(p?.lower_bound) || value * 0.85),
    high: Math.round(Number(p?.upper_bound) || value * 1.15),
  };
}

// Weighted nearest-neighbour over past deals: same crop counts more, similar size counts more,
// rush jobs (fewer days per acre) cost a little more.
function localPredict({ crop, acres, days }) {
  const rows = db.prepare(
    `SELECT d.price_total, d.days, l.acres, l.crop FROM deals d JOIN listings l ON l.id = d.listing_id
      WHERE d.status != 'cancelled' ORDER BY d.id DESC LIMIT 500`
  ).all();
  const base = BASE_PER_ACRE[crop] || BASE_PER_ACRE.other;
  let wSum = 0, ratioSum = 0;
  for (const r of rows) {
    const w = (r.crop === crop ? 1 : 0.3) / (1 + Math.abs(Math.log(r.acres / acres)));
    const rBase = BASE_PER_ACRE[r.crop] || BASE_PER_ACRE.other;
    ratioSum += w * (r.price_total / r.acres / rBase); // how far real prices sit from the starting rate
    wSum += w;
  }
  // Shrink towards the starting rate when there is little history.
  const ratio = (ratioSum + 2 * 1) / (wSum + 2);
  let perAcre = base * ratio;
  if (days && acres / days > 8) perAcre *= 1.08; // more than 8 acres a day needs extra machines
  const total = Math.round((perAcre * acres) / 100) * 100;
  return { total, low: Math.round(total * 0.85 / 100) * 100, high: Math.round(total * 1.15 / 100) * 100, deals_used: rows.length };
}

async function suggestPrice(f) {
  if (vertexReady()) {
    try { return { ...(await vertexPredict(f)), source: 'Vertex AI' }; } catch (e) { console.error(e.message); }
  }
  const p = localPredict(f);
  return { ...p, source: p.deals_used ? `Local model (${p.deals_used} past deals)` : 'Starting rates' };
}

module.exports = { suggestPrice, vertexReady, features, BASE_PER_ACRE };
