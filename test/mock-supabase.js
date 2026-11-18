/* In-memory Supabase mock for UI testing only. State persists in localStorage across page loads. */
(function () {
  const K = '__mockdb', SK = '__mocksess';
  const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); });
  const T = ['profiles','organizations','representatives','food_listings','food_requests','pickup_otps','requirements','notifications','messages','reports','badge_definitions','org_badges','certificates','verification_documents','contact_messages','faqs','testimonials','audit_log','rep_locations','users'];
  let db = JSON.parse(localStorage.getItem(K) || 'null');
  if (!db) {
    db = {}; T.forEach((t) => (db[t] = []));
    db.badge_definitions = [
      { code: 'first_donation', applies_to: 'donor', name: 'First donation', metric: 'donations', threshold: 1 },
      { code: 'regular_giver', applies_to: 'donor', name: 'Regular giver', metric: 'donations', threshold: 5 },
      { code: 'first_pickup', applies_to: 'ngo', name: 'First pickup', metric: 'donations', threshold: 1 }];
  }
  const save = () => localStorage.setItem(K, JSON.stringify(db));
  const uid = () => localStorage.getItem(SK);
  const me = () => db.users.find((u) => u.id === uid());
  const prof = () => db.profiles.find((p) => p.id === uid());
  const org = (id) => db.organizations.find((o) => o.id === id);
  const myOrg = () => db.organizations.find((o) => o.owner_id === uid());
  const now = () => new Date().toISOString();
  const notify = (orgId, title, body) => { const o = org(orgId); if (o) db.notifications.push({ id: uuid(), user_id: o.owner_id, title, body: body || null, read: false, created_at: now() }); };
  const err = (m) => ({ data: null, error: { message: m } });
  const award = (orgId) => {
    const o = org(orgId); if (!o) return;
    const done = db.food_requests.filter((r) => r.status === 'completed').filter((r) => { const l = db.food_listings.find((x) => x.id === r.listing_id); return r.ngo_org_id === orgId || l.donor_org_id === orgId; });
    const units = done.reduce((a, r) => a + r.quantity, 0);
    db.badge_definitions.filter((b) => b.applies_to === o.kind).forEach((b) => {
      const v = b.metric === 'donations' ? done.length : units;
      if (v >= b.threshold && !db.org_badges.find((x) => x.org_id === orgId && x.badge_code === b.code)) {
        db.org_badges.push({ org_id: orgId, badge_code: b.code, earned_at: now() });
        db.certificates.push({ id: uuid(), org_id: orgId, badge_code: b.code, title: b.name, serial: 'AS-' + Math.random().toString(36).slice(2, 12).toUpperCase(), issued_at: now() });
        notify(orgId, 'New badge earned', b.name);
      }
    });
  };
  const rpcs = {
    create_request(a) {
      const o = myOrg(); if (!o || o.kind !== 'ngo' || o.verification !== 'approved' || o.suspended) return err('Only verified, active NGOs can request food');
      const rep = db.representatives.find((r) => r.id === a.p_rep && r.org_id === o.id); if (!rep) return err('Choose one of your own representatives');
      const l = db.food_listings.find((x) => x.id === a.p_listing);
      if (!l || l.status !== 'active' || new Date(l.pickup_by) <= new Date()) return err('This listing is no longer available');
      if (a.p_qty < 1 || a.p_qty > l.quantity - l.qty_reserved) return err('Quantity exceeds what is available');
      if (db.food_requests.find((r) => r.listing_id === l.id && r.ngo_org_id === o.id && r.status === 'pending')) return err('duplicate key value violates unique constraint');
      const r = { id: uuid(), listing_id: l.id, ngo_org_id: o.id, rep_id: rep.id, rep_name: rep.name, rep_phone: rep.phone, quantity: a.p_qty, status: 'pending', created_at: now() };
      db.food_requests.push(r); notify(l.donor_org_id, 'New food request', a.p_qty + ' ' + l.unit + ' of ' + l.title); return { data: r.id, error: null };
    },
    respond_request(a) {
      const r = db.food_requests.find((x) => x.id === a.p_request), l = db.food_listings.find((x) => x.id === r.listing_id);
      if (org(l.donor_org_id).owner_id !== uid()) return err('Not your listing'); if (r.status !== 'pending') return err('Request already handled');
      if (a.p_accept) {
        if (l.status !== 'active') return err('Listing is no longer active'); if (r.quantity > l.quantity - l.qty_reserved) return err('Not enough quantity left');
        l.qty_reserved += r.quantity; if (l.qty_reserved === l.quantity) l.status = 'reserved'; r.status = 'accepted';
        db.pickup_otps.push({ request_id: r.id, ngo_org_id: r.ngo_org_id, otp: String(1000 + Math.floor(Math.random() * 9000)), attempts: 0, expires_at: new Date(Date.now() + 864e5).toISOString() });
        notify(r.ngo_org_id, 'Request accepted', 'Collect ' + l.title);
      } else { r.status = 'rejected'; notify(r.ngo_org_id, 'Request rejected', l.title); }
      return { data: null, error: null };
    },
    cancel_request(a) {
      const r = db.food_requests.find((x) => x.id === a.p_request);
      if (r.status === 'accepted') { const l = db.food_listings.find((x) => x.id === r.listing_id); l.qty_reserved -= r.quantity; if (l.status === 'reserved') l.status = 'active'; db.pickup_otps = db.pickup_otps.filter((o) => o.request_id !== r.id); }
      r.status = 'cancelled'; return { data: null, error: null };
    },
    confirm_pickup(a) {
      const r = db.food_requests.find((x) => x.id === a.p_request), l = db.food_listings.find((x) => x.id === r.listing_id), o = db.pickup_otps.find((x) => x.request_id === r.id);
      if (!o) return err('No active OTP for this request'); if (o.otp !== a.p_otp) { o.attempts++; return { data: false, error: null }; }
      r.status = 'completed'; r.completed_at = now(); db.pickup_otps = db.pickup_otps.filter((x) => x.request_id !== r.id);
      if (l.qty_reserved === l.quantity) l.status = 'completed'; award(l.donor_org_id); award(r.ngo_org_id); notify(r.ngo_org_id, 'Pickup confirmed', l.title); return { data: true, error: null };
    },
    review_org(a) {
      if (prof().role !== 'admin') return err('Admins only');
      if (a.p_approve && !db.verification_documents.find((d) => d.org_id === a.p_org && d.status === 'approved')) return err('Approve at least one verification document first');
      if (!a.p_approve && !(a.p_note || '').trim()) return err('A note is required when rejecting');
      const o = org(a.p_org); o.verification = a.p_approve ? 'approved' : 'rejected'; o.verification_note = a.p_note;
      db.audit_log.push({ id: uuid(), action: a.p_approve ? 'org_approved' : 'org_rejected', target_table: 'organizations', details: { note: a.p_note }, created_at: now() });
      notify(o.id, a.p_approve ? 'Organisation verified' : 'Verification rejected', a.p_note); return { data: null, error: null };
    },
    review_document(a) { const d = db.verification_documents.find((x) => x.id === a.p_doc); d.status = a.p_status; d.reviewer_note = a.p_note; db.audit_log.push({ id: uuid(), action: 'document_' + a.p_status, target_table: 'verification_documents', details: {}, created_at: now() }); return { data: null, error: null }; },
    suspend_org(a) { const o = org(a.p_org); o.suspended = a.p_suspend; o.suspended_reason = a.p_reason; return { data: null, error: null }; },
    admin_withdraw_listing(a) { db.food_listings.find((l) => l.id === a.p_listing).status = 'withdrawn'; return { data: null, error: null }; },
    resolve_report(a) { const r = db.reports.find((x) => x.id === a.p_report); r.status = a.p_status; r.admin_note = a.p_note; return { data: null, error: null }; },
    update_location(a) { db.rep_locations = db.rep_locations.filter((x) => x.request_id !== a.p_request); db.rep_locations.push({ request_id: a.p_request, lat: a.p_lat, lng: a.p_lng, updated_at: now() }); return { data: null, error: null }; },
    nearby_listings() { return { data: db.food_listings.filter((l) => l.status === 'active').map((l) => ({ ...l, donor_name: org(l.donor_org_id).name, distance_km: 2.4 })), error: null }; },
    get_leaderboard() { return { data: [], error: null }; },
    public_impact() { const d = db.food_requests.filter((r) => r.status === 'completed'); const ok = (k) => db.organizations.filter((o) => o.kind === k && o.verification === 'approved' && !o.suspended).length; return { data: [{ donations: d.length, units: d.reduce((x, r) => x + r.quantity, 0), donors: ok('donor'), ngos: ok('ngo') }], error: null }; },
    verify_certificate(a) { const c = db.certificates.find((x) => x.serial === String(a.p_serial || '').trim().toUpperCase()); return { data: c ? [{ org_name: org(c.org_id).name, title: c.title, issued_at: c.issued_at }] : [], error: null }; },
    set_my_role(a) { if (myOrg()) return err('Role can\'t be changed'); prof().role = a.p_role; return { data: null, error: null }; },
  };
  const filt = (rows, fs) => rows.filter((r) => fs.every((f) => f(r)));
  function from(t) {
    const st = { op: 'select', fs: [], ord: null, lim: null, one: null, payload: null, ret: false };
    const b = {
      select() { st.ret = true; return b; }, insert(p) { st.op = 'insert'; st.payload = p; return b; }, update(p) { st.op = 'update'; st.payload = p; return b; }, delete() { st.op = 'delete'; return b; },
      eq(k, v) { st.fs.push((r) => r[k] === v); return b; }, neq(k, v) { st.fs.push((r) => r[k] !== v); return b; }, in(k, v) { st.fs.push((r) => v.includes(r[k])); return b; },
      gt(k, v) { st.fs.push((r) => r[k] > v); return b; }, order(k, o) { st.ord = [k, !(o && o.ascending === false)]; return b; }, limit(n) { st.lim = n; return b; },
      single() { st.one = 'single'; return b; }, maybeSingle() { st.one = 'maybe'; return b; },
      then(res, rej) { return Promise.resolve().then(run).then(res, rej); },
    };
    function run() {
      let rows = db[t]; let out;
      if (st.op === 'insert') {
        const arr = (Array.isArray(st.payload) ? st.payload : [st.payload]).map((p) => ({ id: uuid(), created_at: now(), ...p }));
        if (t === 'organizations') arr.forEach((o) => { Object.assign(o, { verification: 'pending', suspended: false }); db.profiles.filter((p) => p.role === 'admin').forEach((a) => db.notifications.push({ id: uuid(), user_id: a.id, title: 'New registration', body: o.name, read: false, created_at: now() })); });
        if (t === 'food_listings') arr.forEach((l) => Object.assign(l, { qty_reserved: 0, status: 'active' }));
        if (t === 'verification_documents') arr.forEach((d) => Object.assign(d, { status: 'pending' }));
        if (t === 'messages') arr.forEach((m) => (m.sender_id = uid()));
        if (t === 'requirements') arr.forEach((n) => (n.status = 'open'));
        if (t === 'reports') arr.forEach((r) => (r.status = 'open'));
        if (t === 'contact_messages') arr.forEach((c) => (c.status = 'new'));
        db[t].push(...arr); out = arr;
      } else if (st.op === 'update') { out = filt(rows, st.fs); out.forEach((r) => Object.assign(r, st.payload)); }
      else if (st.op === 'delete') { const del = filt(rows, st.fs); db[t] = rows.filter((r) => !del.includes(r)); out = del; }
      else { out = filt(rows, st.fs).slice(); if (st.ord) out.sort((a, b) => (a[st.ord[0]] > b[st.ord[0]] ? 1 : -1) * (st.ord[1] ? 1 : -1)); if (st.lim) out = out.slice(0, st.lim); }
      save();
      out = JSON.parse(JSON.stringify(out));
      if (st.one) { if (out.length > 1 && st.one === 'single') return err('multiple rows'); if (!out.length) return st.one === 'single' ? err('no rows') : { data: null, error: null }; return { data: out[0], error: null }; }
      return { data: out, error: null };
    }
    return b;
  }
  const listeners = [];
  const auth = {
    async getSession() { const u = me(); return { data: { session: u ? { user: { id: u.id, email: u.email } } : null }, error: null }; },
    onAuthStateChange(cb) { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
    async signInWithPassword({ email, password }) { const u = db.users.find((x) => x.email === email && x.password === password); if (!u) return { data: null, error: { message: 'Invalid login credentials' } }; localStorage.setItem(SK, u.id); return { data: { user: u }, error: null }; },
    async signUp({ email, password, options }) {
      if (db.users.find((x) => x.email === email)) return { data: { user: { identities: [] }, session: null }, error: null };
      const u = { id: uuid(), email, password }; db.users.push(u); db.profiles.push({ id: u.id, role: (options.data.role || 'donor'), full_name: options.data.full_name }); save();
      if (window.__AUTOCONFIRM) { localStorage.setItem(SK, u.id); return { data: { user: u, session: { user: u } }, error: null }; }
      return { data: { user: { ...u, identities: [{}] }, session: null }, error: null };
    },
    async signOut() { localStorage.removeItem(SK); return { error: null }; },
    async updateUser({ password }) { me().password = password; save(); return { data: {}, error: null }; },
    async resetPasswordForEmail() { return { data: {}, error: null }; },
    async signInWithOAuth() { return { data: {}, error: null }; },
  };
  const chan = () => { const c = { on() { return c; }, subscribe() { return c; } }; return c; };
  window.supabase = {
    createClient() {
      return {
        auth, from, rpc: async (n, a) => { const f = rpcs[n]; if (!f) return err('unknown rpc ' + n); const r = f(a || {}); save(); return r; },
        channel: chan, removeChannel() {},
        storage: { from: (bk) => ({ upload: async (p) => ({ data: { path: p }, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' } }), createSignedUrl: async (p) => ({ data: { signedUrl: 'data:text/plain,doc' }, error: null }) }) },
      };
    },
  };
  window.__mock = { get db() { return db; }, reset() { localStorage.removeItem(K); localStorage.removeItem(SK); }, setAdmin(email) { const u = db.users.find((x) => x.email === email); db.profiles.find((p) => p.id === u.id).role = 'admin'; save(); } };
})();
