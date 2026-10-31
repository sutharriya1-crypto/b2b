// One function for structured AI answers: generateJSON({ prompt, schema, images }).
//
// 1. Gemini API (Google AI Studio key): GEMINI_API_KEY, GEMINI_MODEL (default gemini-flash-latest,
//    an alias Google keeps pointed at the current Flash model; GEMINI_FALLBACK_MODEL is tried on 404).
// 2. Gemma, Google's open model, run locally with Ollama (OLLAMA_URL, GEMMA_MODEL, default gemma3:4b).
//    This is the offline path: it runs on a laptop or field office server with no internet.
// If neither is configured, callers fall back to their own rules and say so.
const { HttpError } = require('../auth');

const env = (k, d = '') => (process.env[k] || '').trim() || d;
const geminiReady = () => !!env('GEMINI_API_KEY');
const gemmaReady = () => !!env('OLLAMA_URL');
const aiReady = () => geminiReady() || gemmaReady();

// Gemini wants an OpenAPI-style schema with upper-case types; Ollama wants JSON Schema. We write
// JSON Schema once and convert.
function toGeminiSchema(s) {
  if (Array.isArray(s)) return s.map(toGeminiSchema);
  if (!s || typeof s !== 'object') return s;
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'type') out.type = String(v).toUpperCase();
    else if (k === 'additionalProperties') continue;
    else if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, toGeminiSchema(pv)]));
    else if (k === 'items') out.items = toGeminiSchema(v);
    else out[k] = v;
  }
  return out;
}

function parseJSON(text) {
  const clean = String(text || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { return JSON.parse(clean); } catch { throw new Error('The AI reply was not valid JSON.'); }
}

async function callGemini(model, { prompt, schema, images, system }) {
  const parts = [...(images || []).map((im) => ({ inline_data: { mime_type: im.mime, data: im.data } })), { text: prompt }];
  const base = env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com'); // overridable for tests
  const res = await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    signal: AbortSignal.timeout(45000),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env('GEMINI_API_KEY') },
    body: JSON.stringify({
      ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json', ...(schema ? { responseSchema: toGeminiSchema(schema) } : {}) },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Gemini ${res.status}: ${data.error?.message || 'request failed'}`);
    err.status = res.status;
    throw err;
  }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('');
  if (!text) throw new Error('Gemini returned no answer (it may have been blocked).');
  return parseJSON(text);
}

async function callGemma({ prompt, schema, images, system }) {
  const res = await fetch(env('OLLAMA_URL').replace(/\/$/, '') + '/api/chat', {
    method: 'POST',
    signal: AbortSignal.timeout(120000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env('GEMMA_MODEL', 'gemma3:4b'),
      stream: false,
      format: schema || 'json',
      options: { temperature: 0.2 },
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt, ...(images?.length ? { images: images.map((i) => i.data) } : {}) },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemma/Ollama ${res.status}: ${data.error || 'request failed'}`);
  return parseJSON(data.message?.content);
}

// Returns { data, engine } where engine names the model that answered.
async function generateJSON(opts) {
  const errors = [];
  if (geminiReady()) {
    const models = [env('GEMINI_MODEL', 'gemini-flash-latest'), env('GEMINI_FALLBACK_MODEL', 'gemini-3.1-flash-lite')];
    for (const m of [...new Set(models)]) {
      try { return { data: await callGemini(m, opts), engine: `Gemini (${m})` }; } catch (e) {
        errors.push(e.message);
        if (e.status && e.status !== 404 && e.status < 500) break; // bad key or bad request: no point retrying
      }
    }
  }
  if (gemmaReady()) {
    try { return { data: await callGemma(opts), engine: `Gemma (${env('GEMMA_MODEL', 'gemma3:4b')}, offline)` }; } catch (e) { errors.push(e.message); }
  }
  if (!errors.length) throw new HttpError(503, 'AI is not set up on this server. Add GEMINI_API_KEY (or run Gemma with Ollama).');
  console.error('AI failed:', errors.join(' | '));
  throw new HttpError(502, 'The AI service did not answer. Please try again in a minute.');
}

module.exports = { generateJSON, aiReady, geminiReady, gemmaReady };
