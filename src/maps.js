/* Google Maps loader. The browser key is served by the AnnSetu API (/api/config) from the
   GOOGLE_MAPS_API_KEY environment variable, so it never has to be committed to the repo.
   Restrict that key to your website domains in Google Cloud Console. */
import { API_URL } from './lib.js';

let loading = null;

export function loadGoogleMaps() {
  if (window.google && window.google.maps) return Promise.resolve(window.google.maps);
  if (loading) return loading;
  loading = (async () => {
    if (!API_URL) throw new Error('Maps are not connected yet.');
    const r = await fetch(API_URL + '/config');
    const cfg = r.ok ? await r.json() : {};
    if (!cfg.maps_key) throw new Error('Google Maps key is not configured yet.');
    await new Promise((res, rej) => {
      const cb = '__annsetuMaps' + Date.now();
      window[cb] = () => { delete window[cb]; res(); };
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(cfg.maps_key)}&v=weekly&callback=${cb}&loading=async`;
      s.async = true;
      s.onerror = () => rej(new Error('Google Maps failed to load.'));
      document.head.appendChild(s);
    });
    return window.google.maps;
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

/* Reverse-geocode a point to a readable address (used by "Use my location"). */
export async function addressFor(lat, lng) {
  const maps = await loadGoogleMaps();
  const geo = new maps.Geocoder();
  const { results } = await geo.geocode({ location: { lat, lng } });
  return results && results[0] ? results[0].formatted_address : '';
}

export const hasPoint = (o) => o && o.lat != null && o.lng != null && !isNaN(+o.lat) && !isNaN(+o.lng);
export const pt = (o) => ({ lat: +o.lat, lng: +o.lng });

/* Straight-line distance in km (fallback when directions are unavailable). */
export function km(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
