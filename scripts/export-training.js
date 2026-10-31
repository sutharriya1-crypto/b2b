// Writes data/training.csv for Vertex AI AutoML (tabular regression, target column: price_total).
// Upload it in the Vertex AI console, train, deploy to an endpoint, then set VERTEX_ENDPOINT_ID.
const fs = require('fs');
const path = require('path');
const { db, DB_PATH } = require('../src/db');

const rows = db.prepare(
  `SELECT l.crop, l.acres, l.est_tonnes, d.days, l.state, d.sealed_at, d.price_total
     FROM deals d JOIN listings l ON l.id = d.listing_id WHERE d.status != 'cancelled'`
).all();
const q = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const lines = ['crop,acres,est_tonnes,days,state,month,price_total'];
for (const r of rows) lines.push([r.crop, r.acres, r.est_tonnes, r.days, r.state, new Date(r.sealed_at).getMonth() + 1, r.price_total].map(q).join(','));
const out = path.join(path.dirname(DB_PATH), 'training.csv');
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(`Wrote ${rows.length} deals to ${out}. Vertex AutoML needs at least 1,000 rows for good results.`);
