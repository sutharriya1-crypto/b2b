// Satellite checks on a field pin.
//
// Google Earth Engine (preferred): a Google Cloud project registered for Earth Engine, with a service
// account that has the "Earth Engine Resource Viewer" role. Set EE_PROJECT and point
// GOOGLE_APPLICATION_CREDENTIALS at the service-account JSON file (or run on Cloud Run with that
// service account attached).
//   fire   : NASA FIRMS active-fire pixels (MODIS/VIIRS) inside 500 m of the pin, in a date range
//   ground : Sentinel-2 median of the last 30 days -> NDVI (green crop) and NDTI (residue / tillage)
// NASA FIRMS direct (fallback for fire only): FIRMS_MAP_KEY from firms.modaps.eosdis.nasa.gov.
const fs = require('fs');

const env = (k, d = '') => (process.env[k] || '').trim() || d;
const eeReady = () => !!env('EE_PROJECT');
const firmsReady = () => !!env('FIRMS_MAP_KEY');

let eePromise = null;
function initEE() {
  if (eePromise) return eePromise;
  const ee = require('@google/earthengine');
  eePromise = new Promise((resolve, reject) => {
    const done = () => ee.initialize(null, null, () => resolve(ee), (e) => { eePromise = null; reject(new Error('Earth Engine: ' + e)); }, null, env('EE_PROJECT'));
    const fail = (e) => { eePromise = null; reject(new Error('Earth Engine auth: ' + e)); };
    const keyFile = env('GOOGLE_APPLICATION_CREDENTIALS');
    if (keyFile && fs.existsSync(keyFile)) {
      ee.data.authenticateViaPrivateKey(JSON.parse(fs.readFileSync(keyFile, 'utf8')), done, fail);
    } else {
      // Application Default Credentials (Cloud Run service account).
      const { GoogleAuth } = require('google-auth-library');
      new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/earthengine', 'https://www.googleapis.com/auth/cloud-platform'] })
        .getAccessToken()
        .then((token) => { ee.data.setAuthToken('', 'Bearer', token, 3600, [], done, false); })
        .catch(fail);
    }
  });
  return eePromise;
}

const evaluate = (obj) => new Promise((resolve, reject) => obj.evaluate((v, err) => (err ? reject(new Error(err)) : resolve(v))));

async function eeFire(lat, lng, from, to) {
  const ee = await initEE();
  const area = ee.Geometry.Point([lng, lat]).buffer(500);
  const days = ee.ImageCollection('FIRMS').filterBounds(area).filterDate(from, to)
    .map((img) => img.set('fire', img.select('T21').reduceRegion({ reducer: ee.Reducer.count(), geometry: area, scale: 375 }).get('T21')))
    .filter(ee.Filter.gt('fire', 0))
    .aggregate_array('system:time_start');
  const list = await evaluate(days);
  return (list || []).map((ms) => new Date(ms).toISOString().slice(0, 10));
}

async function eeGround(lat, lng) {
  const ee = await initEE();
  const pt = ee.Geometry.Point([lng, lat]);
  const area = pt.buffer(60);
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86400000);
  const col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(pt)
    .filterDate(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10))
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 40));
  const img = col.median();
  const ndvi = img.normalizedDifference(['B8', 'B4']).rename('ndvi');
  const ndti = img.normalizedDifference(['B11', 'B12']).rename('ndti');
  const stats = ndvi.addBands(ndti).reduceRegion({ reducer: ee.Reducer.mean(), geometry: area, scale: 10 });
  const [v, count] = await Promise.all([evaluate(stats), evaluate(col.size())]);
  return { ndvi: v?.ndvi ?? null, ndti: v?.ndti ?? null, images: count };
}

async function firmsFire(lat, lng, from, to) {
  // FIRMS area API allows up to 10 days per request; walk the range in 10-day windows.
  const out = new Set();
  const d = 0.005; // about 500 m
  const box = [lng - d, lat - d, lng + d, lat + d].map((n) => n.toFixed(4)).join(',');
  let start = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  while (start <= end) {
    const span = Math.min(10, Math.round((end - start) / 86400000) + 1);
    const day = start.toISOString().slice(0, 10);
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${env('FIRMS_MAP_KEY')}/VIIRS_SNPP_NRT/${box}/${span}/${day}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`FIRMS ${res.status}`);
    const lines = (await res.text()).trim().split('\n');
    const head = lines.shift()?.split(',') || [];
    const i = head.indexOf('acq_date');
    for (const line of lines) { const v = line.split(',')[i]; if (v) out.add(v); }
    start = new Date(start.getTime() + span * 86400000);
  }
  return [...out].sort();
}

// What the numbers mean for a farmer or buyer, in plain words.
function readGround(g) {
  if (g.ndvi == null) return 'no_image';
  if (g.ndvi > 0.45) return 'crop_standing';   // still green: probably not harvested yet
  if (g.ndvi > 0.3) return 'partly_green';
  return 'harvested';
}

async function fireCheck(lat, lng, from, to) {
  if (eeReady()) return { fire_days: await eeFire(lat, lng, from, to), source: 'Google Earth Engine (NASA FIRMS)' };
  if (firmsReady()) return { fire_days: await firmsFire(lat, lng, from, to), source: 'NASA FIRMS' };
  return null;
}

async function groundCheck(lat, lng) {
  if (!eeReady()) return null;
  const g = await eeGround(lat, lng);
  return { ...g, reading: readGround(g), source: 'Google Earth Engine (Sentinel-2)' };
}

module.exports = { fireCheck, groundCheck, eeReady, firmsReady };
