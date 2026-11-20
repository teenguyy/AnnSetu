import { db, publicUrl } from './lib.js';

export const need = (r) => { if (r.error) throw r.error; return r.data; };

export async function loadMe() {
  const s = await db.auth.getSession();
  const session = s.data && s.data.session;
  if (!session) return null;
  const user = session.user;
  const profile = need(await db.from('profiles').select('id,role,full_name').eq('id', user.id).maybeSingle());
  return { user, profile };
}

export const myOrg = async (uid) => {
  const o = need(await db.from('organizations').select('*').eq('owner_id', uid).maybeSingle());
  if (o) o.logo = publicUrl('org-logos', o.logo_path);
  return o;
};
export const loadNotes = async (uid) =>
  need(await db.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(30)) || [];
export const markAllRead = async (uid) => need(await db.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false));

export async function orgMap(ids) {
  ids = [...new Set((ids || []).filter(Boolean))];
  if (!ids.length) return {};
  const rows = need(await db.from('organizations').select('id,name,org_type,phone,address,lat,lng,logo_path,verification').in('id', ids)) || [];
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}
export const orgDocs = async (orgId) =>
  need(await db.from('verification_documents').select('*').eq('org_id', orgId).order('created_at', { ascending: false })) || [];

export async function saveOrg(uid, role, existing, v) {
  const row = {
    org_type: v.type, name: v.name, phone: v.phone || null, address: v.address || null, about: v.about || null,
    area_served: role === 'ngo' ? v.area || null : null,
    lat: v.lat === '' || v.lat == null ? null : Number(v.lat),
    lng: v.lng === '' || v.lng == null ? null : Number(v.lng),
  };
  if (v.logo_path) row.logo_path = v.logo_path;
  if (existing) return need(await db.from('organizations').update(row).eq('id', existing.id).select('*').single());
  return need(await db.from('organizations').insert({ owner_id: uid, kind: role, ...row }).select('*').single());
}

/* ---------- donor ---------- */
export async function loadDonor(uid) {
  const [org, notes] = await Promise.all([myOrg(uid), loadNotes(uid)]);
  const base = { org, notes, listings: [], requests: [], docs: [], locs: {} };
  if (!org) return base;
  const listings = need(await db.from('food_listings').select('*').eq('donor_org_id', org.id).order('created_at', { ascending: false })) || [];
  listings.forEach((l) => { l.photo = publicUrl('listing-photos', l.photo_path); });
  const ids = listings.map((l) => l.id);
  const reqs = ids.length ? need(await db.from('food_requests').select('*').in('listing_id', ids).order('created_at', { ascending: false })) || [] : [];
  const names = await orgMap(reqs.map((r) => r.ngo_org_id));
  const byId = Object.fromEntries(listings.map((l) => [l.id, l]));
  reqs.forEach((r) => { r.listing = byId[r.listing_id]; r.ngo = names[r.ngo_org_id] || { name: 'Receiver' }; });
  const acc = reqs.filter((r) => r.status === 'accepted').map((r) => r.id);
  const locRows = acc.length ? need(await db.from('rep_locations').select('*').in('request_id', acc)) || [] : [];
  const locs = Object.fromEntries(locRows.map((x) => [x.request_id, x]));
  return { ...base, listings, requests: reqs, docs: await orgDocs(org.id), locs };
}

/* ---------- receiver ---------- */
export async function loadReceiver(uid) {
  const [org, notes] = await Promise.all([myOrg(uid), loadNotes(uid)]);
  const base = { org, notes, reps: [], requests: [], needs: [], docs: [], otps: {} };
  if (!org) return base;
  const reps = need(await db.from('representatives').select('*').eq('org_id', org.id).order('name')) || [];
  const reqs = need(await db.from('food_requests').select('*').eq('ngo_org_id', org.id).order('created_at', { ascending: false })) || [];
  const lids = [...new Set(reqs.map((r) => r.listing_id))];
  const listings = lids.length ? need(await db.from('food_listings').select('*').in('id', lids)) || [] : [];
  const donors = await orgMap(listings.map((l) => l.donor_org_id));
  const byId = Object.fromEntries(listings.map((l) => [l.id, l]));
  reqs.forEach((r) => { r.listing = byId[r.listing_id]; r.donor = r.listing ? donors[r.listing.donor_org_id] : null; });
  const accIds = reqs.filter((r) => r.status === 'accepted').map((r) => r.id);
  const otpRows = accIds.length ? need(await db.from('pickup_otps').select('request_id,otp,expires_at').in('request_id', accIds)) || [] : [];
  const needs = need(await db.from('requirements').select('*').eq('ngo_org_id', org.id).order('created_at', { ascending: false })) || [];
  return { ...base, reps, requests: reqs, needs, docs: await orgDocs(org.id), otps: Object.fromEntries(otpRows.map((o) => [o.request_id, o])) };
}

export async function loadDiscover({ lat, lng, radius, category }) {
  let rows;
  if (lat != null && lng != null) {
    rows = need(await db.rpc('nearby_listings', { p_lat: lat, p_lng: lng, p_radius_km: radius, p_category: category || null })) || [];
    rows = rows.map((r) => ({ ...r, donor_org_id: r.donor_org_id, distance: r.distance_km }));
  } else {
    let q = db.from('food_listings').select('*').eq('status', 'active').gt('pickup_by', new Date().toISOString()).order('pickup_by', { ascending: true }).limit(100);
    if (category) q = q.eq('category', category);
    rows = (need(await q) || []).filter((l) => l.qty_reserved < l.quantity);
    const names = await orgMap(rows.map((l) => l.donor_org_id));
    rows = rows.map((l) => ({ ...l, donor_name: (names[l.donor_org_id] || {}).name || 'Donor', donor_address: (names[l.donor_org_id] || {}).address || null, distance: null }));
  }
  return rows.map((l) => ({ ...l, photo: publicUrl('listing-photos', l.photo_path) }));
}

/* ---------- impact, badges, certificates ---------- */
export async function loadImpact(orgId, kind) {
  const [defs, earned, certs, board] = await Promise.all([
    db.from('badge_definitions').select('*').eq('applies_to', kind).order('threshold'),
    db.from('org_badges').select('*').eq('org_id', orgId),
    db.from('certificates').select('*').eq('org_id', orgId).order('issued_at', { ascending: false }),
    db.rpc('public_leaderboard', { p_kind: kind }),
  ]);
  return { defs: need(defs) || [], earned: new Set((need(earned) || []).map((b) => b.badge_code)), certs: need(certs) || [], board: need(board) || [] };
}

/* ---------- chat + reports ---------- */
export const loadMessages = async (reqId, thread = 'donor_ngo') =>
  need(await db.from('messages').select('*').eq('request_id', reqId).eq('thread', thread).order('created_at', { ascending: true }).limit(300)) || [];
export const sendMessage = async (reqId, body, thread = 'donor_ngo') => need(await db.from('messages').insert({ request_id: reqId, body, thread }));
export const fileReport = async (r) => need(await db.from('reports').insert(r));

/* ---------- live updates ---------- */
export function subscribe(uid, onChange) {
  let t;
  const fire = () => { clearTimeout(t); t = setTimeout(onChange, 500); };
  let ch = null;
  try {
    ch = db.channel('annsetu-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + uid }, fire)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_requests' }, fire)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_listings' }, fire)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rep_locations' }, fire)
      .subscribe();
  } catch (e) { /* realtime is optional */ }
  const poll = setInterval(onChange, 45000);
  return () => { clearInterval(poll); clearTimeout(t); if (ch) db.removeChannel(ch); };
}
