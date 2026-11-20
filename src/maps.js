/* Free, card-free maps: Leaflet + OpenStreetMap tiles, OSRM routing, Nominatim reverse geocoding.
   No API keys. Please keep the "© OpenStreetMap contributors" attribution visible (it is required).
   OSRM's public server and Nominatim are meant for light use; if AnnSetu grows, point ROUTER / GEOCODER
   at your own instance or a free-tier provider (e.g. OpenRouteService) without changing anything else. */

export const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
const ROUTER = 'https://router.project-osrm.org/route/v1/driving/';
const GEOCODER = 'https://nominatim.openstreetmap.org/reverse';

let leaflet = null;
export function loadLeaflet() {
  if (!leaflet) leaflet = import('leaflet').then((m) => m.default || m);
  return leaflet;
}

export const hasPoint = (o) => o && o.lat != null && o.lng != null && !isNaN(+o.lat) && !isNaN(+o.lng);
export const pt = (o) => ({ lat: +o.lat, lng: +o.lng });

/* Straight-line distance in km (fallback when routing is unavailable). */
export function km(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/* Road route + travel time between two points. Returns { path: [[lat,lng]...], mins, km, rough } */
export async function route(from, to) {
  try {
    const r = await fetch(`${ROUTER}${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`);
    const j = await r.json();
    const best = j && j.code === 'Ok' && j.routes && j.routes[0];
    if (!best) throw new Error('no route');
    return { path: best.geometry.coordinates.map(([lng, lat]) => [lat, lng]), mins: Math.max(1, Math.round(best.duration / 60)), km: best.distance / 1000, rough: false };
  } catch (e) {
    const d = km(from, to); // ~22 km/h city average
    return { path: [[from.lat, from.lng], [to.lat, to.lng]], mins: Math.max(1, Math.round((d / 22) * 60)), km: d, rough: true };
  }
}

/* Reverse-geocode a point to a readable address (used by "Use my location"). */
export async function addressFor(lat, lng) {
  const r = await fetch(`${GEOCODER}?format=jsonv2&zoom=18&addressdetails=0&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': 'en' } });
  if (!r.ok) return '';
  const j = await r.json();
  return (j && j.display_name) || '';
}
