import React, { useState, useEffect, useMemo } from 'react';
import { FiHome, FiList, FiInbox, FiMapPin, FiAward, FiUser, FiPlus, FiMessageSquare, FiFlag, FiCheck, FiX, FiBox, FiClock, FiHeart, FiNavigation, FiTrendingUp } from 'react-icons/fi';
import { db, CATEGORIES, uploadTo, toLocalInput, fmtDT, tleft, ago } from './lib.js';
import { need, loadDonor, subscribe, markAllRead } from './data.js';
import { Shell, PageHead, Hero } from './shell.jsx';
import { Btn, AsyncForm, Field, Card, Tag, Empty, Bar, Stat, Skeleton, useToast, useLoader, useHashTab, confetti } from './ui.jsx';
import { VerifyBanner, canAct, ChatModal, ReportModal, ImpactView, ProfileView, Checklist, Activity } from './shared.jsx';

const TABS = ['overview', 'listings', 'requests', 'pickups', 'impact', 'profile'];
const lstatus = (l) => (l.status === 'active' && new Date(l.pickup_by) < new Date() ? 'expired' : l.status);

export default function Donor({ me }) {
  const uid = me.user.id;
  const toast = useToast();
  const [tab, setTab] = useHashTab('overview', TABS);
  const { data, error, refresh, setData } = useLoader(() => loadDonor(uid), [uid]);
  const [chat, setChat] = useState(null);
  const [report, setReport] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [flt, setFlt] = useState('all');
  useEffect(() => subscribe(uid, refresh), [uid]); // eslint-disable-line

  if (error) return <div className="fatal"><h1>Couldn’t load your dashboard</h1><p>{error.message}</p><button className="btn primary" onClick={refresh}>Try again</button></div>;
  if (!data) return <div className="boot"><Skeleton /></div>;
  const { org, listings, requests, notes, docs, locs } = data;
  const ok = canAct(org);
  const done = requests.filter((r) => r.status === 'completed');
  const pending = requests.filter((r) => r.status === 'pending');
  const accepted = requests.filter((r) => r.status === 'accepted');
  const stats = { donations: done.length, units: done.reduce((a, r) => a + r.quantity, 0), partners: new Set(done.map((r) => r.ngo_org_id)).size };
  const active = listings.filter((l) => lstatus(l) === 'active');
  const events = [
    ...listings.map((l) => ({ t: <>You listed <b>{l.title}</b> ({l.quantity} {l.unit})</>, at: l.created_at })),
    ...requests.map((r) => ({ t: <>{r.ngo.name} · request for <b>{r.listing?.title}</b>: {r.status}</>, at: r.created_at })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <FiHome /> },
    { id: 'listings', label: 'Listings', icon: <FiList /> },
    { id: 'requests', label: 'Requests', icon: <FiInbox />, badge: pending.length || null },
    { id: 'pickups', label: 'Pickups', icon: <FiMapPin />, badge: accepted.length || null },
    { id: 'impact', label: 'Impact', icon: <FiAward /> },
    { id: 'profile', label: 'Profile', icon: <FiUser /> },
  ];
  const titles = Object.fromEntries(tabs.map((t) => [t.id, t.label]));
  const view = org ? tab : 'profile'; // no organisation yet: send them to the profile form
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const readAll = async () => {
    if (!notes.some((n) => !n.read)) return;
    try { await markAllRead(uid); setData((d) => ({ ...d, notes: d.notes.map((n) => ({ ...n, read: true })) })); } catch (e) {}
  };

  const respond = (r, accept) => async () => {
    need(await db.rpc('respond_request', { p_request: r.id, p_accept: accept }));
    toast(accept ? 'Request accepted. Quantity is reserved for pickup.' : 'Request rejected.');
    await refresh();
  };
  const confirm = (r, getOtp) => async () => {
    const otp = getOtp().trim();
    if (!/^\d{4}$/.test(otp)) throw new Error('Enter the 4-digit OTP shown to the receiver.');
    const good = need(await db.rpc('confirm_pickup', { p_request: r.id, p_otp: otp }));
    if (!good) { toast('Incorrect OTP. Ask the representative to check their Pickups tab.', 'bad'); return; }
    confetti();
    toast('Pickup confirmed. Thank you for feeding someone today!');
    await refresh();
  };
  const withdraw = (l) => async () => {
    need(await db.from('food_listings').update({ status: 'withdrawn' }).eq('id', l.id));
    toast('Listing withdrawn.');
    await refresh();
  };

  /* ---------- views ---------- */
  const overview = (<>
    <Hero kicker={greet} title={org?.name || 'Welcome, donor'} text="Every listing you publish is a meal that doesn’t go to waste."
      action={<Btn onClick={() => { setShowForm(true); setTab('listings'); }} disabled={!ok}><FiPlus /> List surplus food</Btn>} />
    <div className="grid">
      <Stat i={0} n={active.length} label="Active listings" icon={<FiBox />} />
      <Stat i={1} n={pending.length} label="Pending requests" icon={<FiInbox />} />
      <Stat i={2} n={stats.donations} label="Completed donations" icon={<FiHeart />} />
      <Stat i={3} n={stats.units} label="Units donated" icon={<FiTrendingUp />} />
    </div>
    <Checklist items={[['Complete your organisation profile', !!(org && org.name && org.address)], ['Upload verification documents', docs.length > 0], ['Get verified by an admin', ok], ['Publish your first listing', listings.length > 0], ['Complete your first donation', done.length > 0]]} />
    {pending.length > 0 && <Card i={3} className="row"><div><h3>{pending.length} request{pending.length > 1 ? 's' : ''} waiting</h3><span className="m">Review them before the pickup window closes.</span></div><Btn onClick={() => setTab('requests')}>Review</Btn></Card>}
    <Activity events={events} />
  </>);

  const newListing = async (fd, form) => {
    const title = String(fd.get('title')).trim(), qty = Math.floor(+fd.get('qty')), by = new Date(fd.get('by')), prep = new Date(fd.get('prep'));
    if (title.length < 2) throw new Error('Please name the food item.');
    if (!(qty >= 1)) throw new Error('Quantity must be at least 1.');
    if (isNaN(prep) || prep > new Date()) throw new Error('Preparation time can’t be in the future.');
    if (isNaN(by) || by <= new Date()) throw new Error('Pickup time must be in the future.');
    if (by <= prep) throw new Error('Pickup time must be after preparation.');
    const photo = fd.get('photo');
    let photo_path = null;
    if (photo && photo.size) {
      if (photo.size > 2 * 1024 * 1024) throw new Error('Photo must be 2 MB or smaller.');
      if (!/^image\/(jpeg|png|webp)$/.test(photo.type)) throw new Error('Photo must be JPG, PNG or WebP.');
      photo_path = await uploadTo('listing-photos', uid, photo);
    }
    need(await db.from('food_listings').insert({ donor_org_id: org.id, title, category: fd.get('cat'), quantity: qty, unit: fd.get('unit'), prepared_at: prep.toISOString(), pickup_by: by.toISOString(), safety_notes: String(fd.get('notes') || '').trim() || null, photo_path }));
    toast('Listing published. Verified NGOs nearby can now request it.');
    setShowForm(false);
    await refresh();
  };

  const listingsView = (<>
    <PageHead kicker="Your food" title="Listings" sub="Only active, unexpired food is visible to NGOs." action={<Btn onClick={() => setShowForm(!showForm)} disabled={!ok}><FiPlus /> {showForm ? 'Close' : 'New listing'}</Btn>} />
    {!ok && <Empty>Your organisation must be verified before you can publish food.</Empty>}
    {showForm && ok && (
      <Card>
        <h3>Publish surplus food</h3>
        <AsyncForm onSubmit={newListing} className="mt">
          {({ busy }) => (<>
            <Field label="Food item" wide><input name="title" maxLength={80} placeholder="e.g. Vegetable biryani" required /></Field>
            <Field label="Category"><select name="cat">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Quantity"><input name="qty" type="number" min="1" max="10000" required /></Field>
            <Field label="Unit"><select name="unit"><option>portions</option><option>kg</option><option>packs</option></select></Field>
            <Field label="Prepared at"><input name="prep" type="datetime-local" defaultValue={toLocalInput(Date.now() - 30 * 6e4)} required /></Field>
            <Field label="Pickup by"><input name="by" type="datetime-local" defaultValue={toLocalInput(Date.now() + 3 * 36e5)} required /></Field>
            <Field label="Photo (optional, 2 MB max)" wide><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></Field>
            <Field label="Safety & storage notes" wide><textarea name="notes" rows={2} maxLength={300} placeholder="Allergens, veg/non-veg, storage temperature…" /></Field>
            <div className="wide row-l"><Btn type="submit" busy={busy}>Publish listing</Btn><Btn kind="ghost" onClick={() => setShowForm(false)}>Cancel</Btn></div>
          </>)}
        </AsyncForm>
      </Card>
    )}
    <div className="fl">{['all', 'active', 'reserved', 'expired', 'completed', 'withdrawn'].map((k) => <button key={k} className={'chip' + (flt === k ? ' on' : '')} onClick={() => setFlt(k)}>{k}</button>)}</div>
    {(() => {
      const list = listings.filter((l) => flt === 'all' || lstatus(l) === flt);
      if (!list.length) return <Empty>{listings.length ? 'No listings match this filter.' : 'No listings yet.'}</Empty>;
      return list.map((l, i) => {
        const s = lstatus(l);
        const hasPending = requests.some((r) => r.listing_id === l.id && r.status === 'pending');
        return (
          <Card key={l.id} i={i} className="lcard">
            {l.photo ? <img className="lph" src={l.photo} alt="" loading="lazy" /> : null}
            <div className="lbody">
              <div className="row"><div><h3>{l.title}</h3><span className="m">{l.category} · pickup by {fmtDT(l.pickup_by)}</span></div><Tag s={s} /></div>
              <div className="m" style={{ marginTop: 8 }}>{l.quantity - l.qty_reserved} of {l.quantity} {l.unit} available{s === 'active' ? ' · ' + tleft(l.pickup_by) : ''}{l.safety_notes ? ' · ' + l.safety_notes : ''}</div>
              <Bar pct={(l.qty_reserved / l.quantity) * 100} />
              {s === 'active' && l.qty_reserved === 0 && <div style={{ marginTop: 12 }}><Btn kind="danger" size="sm" onClick={withdraw(l)} title={hasPending ? 'Pending requests will no longer be acceptable' : ''}>Withdraw listing</Btn></div>}
            </div>
          </Card>
        );
      });
    })()}
  </>);

  const requestsView = (<>
    <PageHead kicker="Incoming" title="Requests" sub="Accepting reserves the quantity so it can’t be over-allocated." />
    {!requests.length ? <Empty>No requests yet. They appear here when verified NGOs ask for your food.</Empty> :
      requests.map((r, i) => (
        <Card key={r.id} i={i}>
          <div className="row"><div><h3>{r.ngo.name}</h3><span className="m">wants {r.quantity} {r.listing?.unit} of “{r.listing?.title}” · rep: {r.rep_name || '—'}{r.rep_phone ? ` (${r.rep_phone})` : ''}</span></div><Tag s={r.status} /></div>
          <div className="acts">
            {r.status === 'pending' && <><Btn size="sm" kind="ok" onClick={respond(r, true)}><FiCheck /> Accept</Btn><Btn size="sm" kind="danger" onClick={respond(r, false)}><FiX /> Reject</Btn></>}
            {['pending', 'accepted', 'completed'].includes(r.status) && <Btn size="sm" kind="ghost" onClick={() => setChat(r)}><FiMessageSquare /> Message</Btn>}
            <Btn size="sm" kind="ghost" onClick={() => setReport(r)}><FiFlag /> Report</Btn>
          </div>
        </Card>
      ))}
  </>);

  const pickupsView = (<>
    <PageHead kicker="Handover" title="Pickups" sub="Confirm each handover with the OTP shown to the receiver." />
    {!accepted.length ? <Empty>No accepted pickups waiting.</Empty> : accepted.map((r, i) => <PickupCard key={r.id} r={r} i={i} loc={locs[r.id]} onConfirm={confirm} onChat={() => setChat(r)} />)}
  </>);

  return (
    <Shell roleLabel="Donor" tabs={tabs} tab={view} setTab={setTab} title={titles[view]} org={org} user={me.user} notes={notes} onReadAll={readAll}
      banner={view !== 'profile' ? <VerifyBanner org={org} goProfile={() => setTab('profile')} /> : null}>
      {<>
        {view === 'overview' && overview}
        {view === 'listings' && listingsView}
        {view === 'requests' && requestsView}
        {view === 'pickups' && pickupsView}
        {view === 'impact' && org && <ImpactView org={org} kind="donor" stats={stats} />}
        {view === 'profile' && <><PageHead kicker="Organisation" title="Profile" sub="Your organisation, verification and documents." /><ProfileView role="donor" user={me.user} org={org} docs={docs} onChanged={async () => { if (!org) setTab('profile'); await refresh(); }} /></>}
      </>}
            {chat && <ChatModal request={chat} meId={uid} title={`Chat with ${chat.ngo.name}`} onClose={() => setChat(null)} />}
      {report && <ReportModal reporterOrg={org.id} reportedOrg={report.ngo_org_id} requestId={report.id} reportedName={report.ngo.name} onClose={() => setReport(null)} />}
    </Shell>
  );
}

function PickupCard({ r, i, loc, onConfirm, onChat }) {
  const [otp, setOtp] = useState('');
  return (
    <Card i={i}>
      <div className="row"><div><h3>{r.ngo.name}</h3><span className="m">{r.quantity} × {r.listing?.title} · rep: {r.rep_name || '—'}{r.rep_phone ? ` (${r.rep_phone})` : ''}</span></div><Tag s="accepted" /></div>
      {loc && (
        <div className="loc"><FiNavigation /><span>Representative location updated {ago(new Date(loc.updated_at).getTime())}</span>
          <a className="lk" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=16/${loc.lat}/${loc.lng}`}>Open map</a></div>
      )}
      <div className="acts">
        <input className="otp" value={otp} inputMode="numeric" maxLength={4} placeholder="4-digit OTP" aria-label="Pickup OTP" onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
        <Btn size="sm" onClick={onConfirm(r, () => otp)}>Confirm collection</Btn>
        <Btn size="sm" kind="ghost" onClick={onChat}><FiMessageSquare /> Message</Btn>
      </div>
    </Card>
  );
}
