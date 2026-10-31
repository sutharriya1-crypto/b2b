// Checks a proof photo (cleared field or stacked bales) with Google Cloud Vision label detection.
// Key: GOOGLE_VISION_API_KEY (an API key with "Cloud Vision API" enabled). If it is not set, Gemini
// looks at the photo instead (when configured).
const { generateJSON, aiReady } = require('./ai');

const env = (k) => (process.env[k] || '').trim();
const visionReady = () => !!env('GOOGLE_VISION_API_KEY');

// Labels that support "the field is cleared" or "the residue was baled".
const GOOD = ['hay', 'straw', 'bale', 'field', 'agriculture', 'soil', 'plain', 'grassland', 'farm', 'harvest', 'plantation', 'crop', 'rural area', 'prairie', 'land lot', 'tractor', 'agricultural machinery'];
const BAD = ['fire', 'smoke', 'flame', 'wildfire', 'ash', 'burn'];

function verdict(labels) {
  const names = labels.map((l) => l.name.toLowerCase());
  const has = (list) => names.some((n) => list.some((w) => n.includes(w)));
  if (has(BAD)) return 'smoke_or_fire';
  if (has(GOOD)) return 'looks_right';
  return 'unclear';
}

async function checkPhoto(base64, mime) {
  if (visionReady()) {
    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(env('GOOGLE_VISION_API_KEY'))}`, {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ image: { content: base64 }, features: [{ type: 'LABEL_DETECTION', maxResults: 12 }, { type: 'SAFE_SEARCH_DETECTION' }] }] }),
    });
    const data = await res.json().catch(() => ({}));
    const r = data.responses?.[0];
    if (!res.ok || r?.error) throw new Error('Vision: ' + (r?.error?.message || data.error?.message || res.status));
    const labels = (r.labelAnnotations || []).map((l) => ({ name: l.description, score: Math.round(l.score * 100) }));
    const unsafe = ['adult', 'violence', 'racy'].some((k) => ['LIKELY', 'VERY_LIKELY'].includes(r.safeSearchAnnotation?.[k]));
    return { labels, verdict: unsafe ? 'rejected' : verdict(labels), source: 'Google Cloud Vision' };
  }
  if (aiReady()) {
    const { data, engine } = await generateJSON({
      images: [{ mime, data: base64 }],
      prompt: 'This photo is proof from a crop-residue baling job in India. List up to 8 short English labels for what you see, ' +
        'and say whether it shows a cleared field or baled straw (looks_right), smoke or fire (smoke_or_fire), or neither (unclear).',
      schema: {
        type: 'object',
        properties: { labels: { type: 'array', items: { type: 'string' } }, verdict: { type: 'string', enum: ['looks_right', 'smoke_or_fire', 'unclear'] } },
        required: ['labels', 'verdict'],
      },
    });
    return { labels: (data.labels || []).slice(0, 8).map((n) => ({ name: String(n), score: null })), verdict: data.verdict || 'unclear', source: engine };
  }
  return null;
}

module.exports = { checkPhoto, visionReady };
