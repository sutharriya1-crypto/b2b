// Road distance for a deal: operator's yard -> field -> buyer's kiln.
// Google Routes API (computeRoutes) with GOOGLE_MAPS_SERVER_KEY (a key without website restrictions,
// "Routes API" enabled). Falls back to straight-line distance x 1.3 when no key or no route.
const env = (k) => (process.env[k] || '').trim();
const routesReady = () => !!env('GOOGLE_MAPS_SERVER_KEY');

function haversineKm(a, b) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function googleLeg(a, b) {
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env('GOOGLE_MAPS_SERVER_KEY'),
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: a.lat, longitude: a.lng } } },
      destination: { location: { latLng: { latitude: b.lat, longitude: b.lng } } },
      travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE', regionCode: 'IN',
    }),
  });
  const data = await res.json().catch(() => ({}));
  const r = data.routes?.[0];
  if (!res.ok || !r) throw new Error('Routes: ' + (data.error?.message || 'no route'));
  return { km: r.distanceMeters / 1000, minutes: Math.round(parseInt(r.duration, 10) / 60) };
}

async function leg(a, b) {
  if (routesReady()) {
    try { return { ...(await googleLeg(a, b)), source: 'Google Routes API' }; } catch (e) { console.error(e.message); }
  }
  const km = haversineKm(a, b) * 1.3;
  return { km, minutes: Math.round((km / 35) * 60), source: 'Estimate (straight line x 1.3)' };
}

module.exports = { leg, haversineKm, routesReady };
