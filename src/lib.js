export const SB_URL = window.ANNSETU_SUPABASE_URL;
export const SB_KEY = window.ANNSETU_SUPABASE_PUBLISHABLE_KEY;
export const configured = !!(window.supabase && SB_URL && SB_KEY);
export const db = configured
  ? window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export const ROUTES = { donor: 'donor.html', ngo: 'receiver.html', admin: 'admin.html' };
export const SIGNIN = 'signin.html';

/* ---------- theme (light by default, remembered) ---------- */
export function initTheme() {
  let t = 'light';
  try { t = localStorage.getItem('annsetu_theme') || 'light'; } catch (e) {}
  document.documentElement.setAttribute('data-theme', t);
  return t;
}
export function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('annsetu_theme', t); } catch (e) {}
}

/* ---------- formatting ---------- */
export const fmtDT = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');
export const fmtD = (d) => (d ? new Date(d).toLocaleDateString([], { dateStyle: 'medium' }) : '');
export function ago(ms) {
  const m = Math.floor((Date.now() - ms) / 6e4);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  if (m < 1440) return Math.floor(m / 60) + 'h ago';
  return Math.floor(m / 1440) + 'd ago';
}
export function tleft(by) {
  const ms = new Date(by) - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 36e5);
  return h >= 24 ? Math.floor(h / 24) + 'd left' : h + 'h ' + Math.floor((ms % 36e5) / 6e4) + 'm left';
}
export const toLocalInput = (d) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};
export const initials = (n) => ((n || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('') || 'A').toUpperCase();
export const safeName = (n) => String(n).replace(/[^a-zA-Z0-9._-]/g, '_');
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function errMsg(e) {
  const m = (e && (e.message || e.error_description || e.msg)) || String(e || 'Something went wrong');
  if (/row-level security|permission denied/i.test(m)) return 'You don’t have permission for that. Is your organisation verified and active?';
  if (/duplicate key|already exists/i.test(m)) return 'That already exists, for example a pending request for the same listing.';
  if (/Invalid login credentials/i.test(m)) return 'Incorrect email or password.';
  if (/Email not confirmed/i.test(m)) return 'Please confirm your email first. Check your inbox for the link.';
  if (/User already registered/i.test(m)) return 'An account with this email already exists. Try signing in.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Network problem. Please check your connection and try again.';
  return m;
}

/* ---------- storage helpers ---------- */
export async function uploadTo(bucket, uid, file, sub = '') {
  const path = `${uid}/${sub}${Date.now()}-${safeName(file.name)}`;
  const { error } = await db.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
  if (error) throw error;
  return path;
}
export const publicUrl = (bucket, path) => (path ? db.storage.from(bucket).getPublicUrl(path).data.publicUrl : '');

export const CATEGORIES = ['Cooked meals', 'Bakery', 'Packaged food', 'Fruits & vegetables', 'Dairy'];
export const DONOR_TYPES = ['Restaurant', 'Hotel', 'Canteen', 'Event organiser', 'Food business', 'Community kitchen'];
export const NGO_TYPES = ['NGO', 'Shelter', 'Community kitchen', 'Orphanage', 'Old-age home', 'Community group'];
export const DOC_TYPES = [['registration', 'Organisation registration'], ['fssai', 'FSSAI licence'], ['tax', '12A / 80G certificate'], ['id', 'Authorised person ID'], ['other', 'Other proof']];
