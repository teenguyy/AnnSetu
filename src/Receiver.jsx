import React, { useState, useEffect, useRef } from 'react';
import { FiHome, FiSearch, FiInbox, FiMapPin, FiPlusCircle, FiAward, FiUser, FiMessageSquare, FiFlag, FiX, FiNavigation, FiPackage, FiCheckCircle, FiTrash2, FiUsers, FiClock, FiTarget, FiMessageCircle } from 'react-icons/fi';
import { db, CATEGORIES, toLocalInput, fmtDT, tleft } from './lib.js';
import { need, loadReceiver, loadDiscover, subscribe, markAllRead, openConversation } from './data.js';
import { MessagesView } from './messages.jsx';
import { Shell, PageHead, Hero } from './shell.jsx';
import { Btn, AsyncForm, Field, Card, Tag, Empty, Bar, Stat, Skeleton, useToast, useLoader, useHashTab } from './ui.jsx';
import { DiscoverBoard } from './discover.jsx';
import { VerifyBanner, canAct, profileComplete, ChatModal, ReportModal, ImpactView, ProfileView, Checklist, Activity, mapsLink } from './shared.jsx';
import { LiveTrack } from './LiveTrack.jsx';

const TABS = ['overview', 'discover', 'requests', 'pickups', 'needs', 'messages', 'impact', 'profile'];

export default function Receiver({ me }) {
  const uid = me.user.id;
  const toast = useToast();
  const [tab, setTab] = useHashTab('overview', TABS);
  const { data, error, refresh, setData } = useLoader(() => loadReceiver(uid), [uid]);
  const [chat, setChat] = useState(null);
  const [report, setReport] = useState(null);
  const [convOpen, setConvOpen] = useState(null);
  useEffect(() => subscribe(uid, refresh), [uid]); // eslint-disable-line

  if (error) return <div className="fatal"><h1>Couldn’t load your dashboard</h1><p>{error.message}</p><button className="btn primary" onClick={refresh}>Try again</button></div>;
  if (!data) return <div className="boot"><Skeleton /></div>;
  const { org, reps, requests, needs, notes, docs, otps } = data;
  const ok = canAct(org);
  const done = requests.filter((r) => r.status === 'completed');
  const pending = requests.filter((r) => r.status === 'pending');
  const accepted = requests.filter((r) => r.status === 'accepted');
  const onWay = requests.filter((r) => r.status === 'completed' && r.trip_status === 'collected');
  const stats = { donations: done.length, units: done.reduce((a, r) => a + r.quantity, 0), partners: new Set(done.map((r) => r.listing?.donor_org_id)).size };
  const openNeeds = needs.filter((n) => n.status === 'open');
  const tabs = [
    { id: 'overview', label: 'Overview', icon: <FiHome /> },
    { id: 'discover', label: 'Discover', icon: <FiSearch /> },
    { id: 'requests', label: 'Requests', icon: <FiInbox />, badge: pending.length || null },
    { id: 'pickups', label: 'Pickups', icon: <FiMapPin />, badge: accepted.length || null },
    { id: 'needs', label: 'Needs', icon: <FiPlusCircle /> },
    { id: 'messages', label: 'Messages', icon: <FiMessageCircle /> },
    { id: 'impact', label: 'Impact', icon: <FiAward /> },
    { id: 'profile', label: 'Profile', icon: <FiUser /> },
  ];
  const locked = !profileComplete(org, 'ngo');
  tabs.forEach((t) => { if (locked && t.id !== 'profile') t.disabled = true; });
  const titles = Object.fromEntries(tabs.map((t) => [t.id, t.label]));
  const view = profileComplete(org, 'ngo') ? tab : 'profile'; // profile completion is compulsory (documents can come later)
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const events = requests.map((r) => ({ t: <>Request for <b>{r.quantity}</b> of {r.listing?.title || 'food'}: {r.status}</>, at: r.created_at }));

  const readAll = async () => {
    if (!notes.some((n) => !n.read)) return;
    try { await markAllRead(uid); setData((d) => ({ ...d, notes: d.notes.map((n) => ({ ...n, read: true })) })); } catch (e) {}
  };
  const cancel = (r) => async () => {
    need(await db.rpc('cancel_request', { p_request: r.id }));
    toast('Request cancelled.');
    await refresh();
  };

  const overview = (<>
    <Hero kicker={greet} title={org?.name || 'Welcome'} text="Find fresh surplus food nearby and bring it to the people who need it."
      action={<Btn onClick={() => setTab('discover')} disabled={!ok}><FiSearch /> Find available food</Btn>} />
    <div className="grid">
      <Stat i={0} n={pending.length} label="Pending requests" icon={<FiClock />} />
      <Stat i={1} n={accepted.length} label="Pickups to collect" icon={<FiPackage />} />
      <Stat i={2} n={stats.units} label="Units received" icon={<FiCheckCircle />} />
      <Stat i={3} n={openNeeds.length} label="Open needs" icon={<FiTarget />} />
    </div>
    <Checklist items={[['Complete your organisation profile', !!(org && org.name && org.address)], ['Upload verification documents', docs.length > 0], ['Get verified by an admin', ok], ['Add a pickup representative', reps.length > 0], ['Send your first food request', requests.length > 0], ['Collect your first donation', done.length > 0]]} />
    <Activity events={events} />
  </>);

  const requestsView = (<>
    <PageHead kicker="Outgoing" title="Requests" sub="Track every request you have sent." />
    {!requests.length ? <Empty>You haven’t sent any requests yet. Browse Discover to find food.</Empty> : requests.map((r, i) => (
      <Card key={r.id} i={i}>
        <div className="row"><div><h3>{r.listing?.title || 'Listing'}</h3><span className="m">{r.donor?.name || 'Donor'} · {r.quantity} requested · rep: {r.rep_name || '—'}</span></div><Tag s={r.status} /></div>
        <div className="acts">
          {['pending', 'accepted'].includes(r.status) && <Btn size="sm" kind="danger" onClick={cancel(r)}><FiX /> Cancel request</Btn>}
          {['pending', 'accepted', 'completed'].includes(r.status) && <Btn size="sm" kind="ghost" onClick={() => setChat(r)}><FiMessageSquare /> Message</Btn>}
          {r.listing && <Btn size="sm" kind="ghost" onClick={() => setReport(r)}><FiFlag /> Report</Btn>}
        </div>
      </Card>
    ))}
  </>);

  const pickupsView = (<>
    <PageHead kicker="Handover" title="Pickups" sub="Your representative collects the food and shows the OTP to the donor." />
    {!accepted.length ? <Empty>No accepted pickups waiting.</Empty> : accepted.map((r, i) => (
      <Card key={r.id} i={i}>
        <div className="row"><div><h3>{r.listing?.title}</h3><span className="m">{r.donor?.name} · {r.donor?.address || 'address on request'} · collect {r.quantity} · rep: {r.rep_name}</span></div><Tag s="accepted" /></div>
        <div className="otpbox"><span className="m">Pickup OTP, show it to the donor</span><div className="otpv">{otps[r.id]?.otp || '····'}</div>{otps[r.id] && <small className="m">Valid until {fmtDT(otps[r.id].expires_at)}</small>}</div>
        <LiveTrack request={r} donor={r.donor} ngo={org} viewer="ngo" onChat={() => setChat(r)} />
        <div className="acts">{mapsLink(r.donor) && <a className="btn ghost sm" href={mapsLink(r.donor)} target="_blank" rel="noopener noreferrer"><FiNavigation /> Donor on Google Maps</a>}<Btn size="sm" kind="danger" onClick={cancel(r)}>Cancel pickup</Btn></div>
      </Card>
    ))}
    {onWay.length > 0 && <h3 className="sec">Coming to you</h3>}
    {onWay.map((r, i) => <Card key={r.id} i={i}><div className="row"><div><h3>{r.listing?.title}</h3><span className="m">{r.donor?.name} · {r.quantity} units</span></div><Tag s="approved">collected</Tag></div>
      <LiveTrack request={r} donor={r.donor} ngo={org} viewer="ngo" onChat={() => setChat(r)} /></Card>)}
  </>);

  const addNeed = async (fd, form) => {
    const title = String(fd.get('title')).trim(), q = Math.floor(+fd.get('qty')), by = new Date(fd.get('by'));
    if (title.length < 2) throw new Error('Describe what you need.');
    if (!(q >= 1)) throw new Error('Quantity must be at least 1.');
    if (isNaN(by) || by <= new Date()) throw new Error('Needed-by time must be in the future.');
    need(await db.from('requirements').insert({ ngo_org_id: org.id, title, quantity: q, needed_by: by.toISOString() }));
    form.reset();
    toast('Requirement published. Donors can now see it.');
    await refresh();
  };
  const needsView = (<>
    <PageHead kicker="Community" title="Needs" sub="Tell donors what your community needs." />
    <Card>
      <h3>Publish a requirement</h3>
      <AsyncForm onSubmit={addNeed} className="mt">
        {({ busy }) => (<>
          <Field label="What do you need?" wide><input name="title" maxLength={80} placeholder="e.g. Cooked meals for 80 people" required /></Field>
          <Field label="Quantity"><input name="qty" type="number" min="1" required /></Field>
          <Field label="Needed by"><input name="by" type="datetime-local" defaultValue={toLocalInput(Date.now() + 24 * 36e5)} required /></Field>
          <div className="wide"><Btn type="submit" busy={busy} disabled={!ok}>Publish need</Btn>{!ok && <small className="m"> Verification is required.</small>}</div>
        </>)}
      </AsyncForm>
    </Card>
    {needs.length ? needs.map((n, i) => (
      <Card key={n.id} i={i}>
        <div className="row"><div><h3>{n.title}</h3><span className="m">{n.quantity} needed by {fmtDT(n.needed_by)}</span></div><Tag s={n.status === 'pledged' ? 'accepted' : n.status}>{n.status}</Tag></div>
        {n.status === 'pledged' && <p className="note"><b>{n.pledger}</b> pledged food for this need, only for you. Choose a representative in Discover. The pickup is confirmed automatically.</p>}
        <div className="acts">
          {n.status === 'pledged' && <Btn size="sm" onClick={() => setTab('discover')}>Collect it</Btn>}
          {n.pledged_by && <Btn size="sm" kind="ghost" onClick={async () => { try { setConvOpen(await openConversation(n.pledged_by)); setTab('messages'); } catch (e) { toast(e.message, 'bad'); } }}>Message {n.pledger}</Btn>}
          {n.status === 'open' && <Btn size="sm" kind="ghost" onClick={async () => { need(await db.from('requirements').update({ status: 'fulfilled' }).eq('id', n.id)); await refresh(); }}>Mark fulfilled</Btn>}
          <Btn size="sm" kind="danger" onClick={async () => { need(await db.from('requirements').delete().eq('id', n.id)); await refresh(); }}><FiTrash2 /> Delete</Btn>
        </div>
      </Card>
    )) : <Empty>No requirements published yet.</Empty>}
  </>);

  const repsCard = (
    <Card i={5}>
      <h3><FiUsers style={{ verticalAlign: '-2px' }} /> Pickup representatives</h3>
      <p className="m">Your own people collect food. AnnSetu does not provide delivery.</p>
      {reps.map((r) => (
        <div key={r.id} className="ck rep-row"><span style={{ flex: 1 }}><b>{r.name}</b> <span className="m">{r.phone}{r.email ? ' · ' + r.email : ''}</span>
          {r.email ? <Tag s={r.user_id ? 'approved' : 'pending'}>{r.user_id ? 'Account linked' : 'Can sign up as representative'}</Tag> : null}
          <small className="m"> · {requests.filter((q) => q.rep_id === r.id && q.status === 'completed').length} pickups done</small></span>
          <Btn size="sm" kind="danger" onClick={async () => { need(await db.from('representatives').delete().eq('id', r.id)); toast('Representative removed.'); await refresh(); }}>Remove</Btn></div>
      ))}
      {!reps.length && <div className="m" style={{ margin: '10px 0' }}>No representatives yet.</div>}
      <AsyncForm className="mt" onSubmit={async (fd, form) => {
        const name = String(fd.get('name')).trim(), phone = String(fd.get('phone')).trim(), email = String(fd.get('email') || '').trim().toLowerCase();
        if (name.length < 2 || phone.length < 6) throw new Error('Enter the representative’s name and phone.');
        if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email, or leave it empty.');
        if (!org) throw new Error('Save your organisation profile first.');
        need(await db.from('representatives').insert({ org_id: org.id, name, phone, email: email || null }));
        form.reset(); toast('Representative added.'); await refresh();
      }}>
        {({ busy }) => (<>
          <Field label="Name"><input name="name" maxLength={60} /></Field>
          <Field label="Phone"><input name="phone" maxLength={20} inputMode="tel" /></Field>
          <Field label="Email (optional)" wide hint="With an email, your representative can create a Representative account and see their pickups, directions and the OTP."><input name="email" type="email" maxLength={120} placeholder="rep@example.com" /></Field>
          <div className="wide"><Btn type="submit" busy={busy}>Add representative</Btn></div>
        </>)}
      </AsyncForm>
    </Card>
  );

  return (
    <Shell roleLabel="Receiver" tabs={tabs} tab={view} setTab={setTab} title={titles[view]} org={org} user={me.user} notes={notes} onReadAll={readAll}
      banner={view !== 'profile' ? <VerifyBanner org={org} goProfile={() => setTab('profile')} /> : null}>
      {<>
        {view === 'overview' && overview}
        {view === 'discover' && <Discover org={org} reps={reps} ok={ok} onRequested={refresh} setTab={setTab} />}
        {view === 'requests' && requestsView}
        {view === 'pickups' && pickupsView}
        {view === 'needs' && needsView}
        {view === 'messages' && <MessagesView meId={uid} kind="ngo" openId={convOpen} onOpened={() => setConvOpen(null)} />}
        {view === 'impact' && org && <ImpactView org={org} kind="ngo" stats={stats} />}
        {view === 'profile' && <><PageHead kicker="Organisation" title="Profile" sub="Your organisation, representatives and documents." /><ProfileView role="ngo" user={me.user} org={org} docs={docs} onChanged={async () => { if (!org) setTab('profile'); await refresh(); }} extra={org ? repsCard : null} /></>}
      </>}
      {chat && <ChatModal request={chat} meId={uid} side="ngo" names={{ donor: chat.donor?.name || 'Donor', rep: chat.rep_name ? chat.rep_name + ' (representative)' : 'Representative' }} onClose={() => setChat(null)} />}
      {report && <ReportModal reporterOrg={org.id} reportedOrg={report.listing.donor_org_id} requestId={report.id} reportedName={report.donor?.name} onClose={() => setReport(null)} />}
    </Shell>
  );
}

/* ---------- discover (nearby search + drag-to-request board) ---------- */
function Discover({ org, reps, ok, onRequested, setTab }) {
  const toast = useToast();
  const [pos, setPos] = useState(org && org.lat != null && org.lng != null ? { lat: Number(org.lat), lng: Number(org.lng) } : null);
  const [radius, setRadius] = useState(50);
  const { data, error, refresh } = useLoader(() => loadDiscover({ lat: pos?.lat, lng: pos?.lng, radius, category: '' }), [pos?.lat, pos?.lng, radius]);
  const locate = () => new Promise((res) => {
    if (!navigator.geolocation) { toast('Your browser can’t share location.', 'bad'); return res(); }
    navigator.geolocation.getCurrentPosition((p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); res(); },
      () => { toast('Couldn’t read your location. Allow location access and try again.', 'bad'); res(); }, { timeout: 12000 });
  });
  const controls = (
    <div className="geo-f">
      <Btn size="sm" kind="ghost" onClick={locate}><FiNavigation /> {pos ? 'Update location' : 'Use my location'}</Btn>
      {pos && <select className="mini" value={radius} onChange={(e) => setRadius(+e.target.value)} aria-label="Search radius">{[5, 15, 30, 50, 100, 0].map((r) => <option key={r} value={r}>{r ? r + ' km' : 'Any distance'}</option>)}</select>}
      {pos && <Btn size="sm" kind="ghost" onClick={() => setPos(null)}>Clear location</Btn>}
    </div>
  );
  return (<>
    <PageHead kicker="Food discovery" title="Discover food" sub={pos ? (radius ? `Fresh listings within ${radius} km, nearest first.` : 'Fresh listings at any distance, nearest first.') : 'Fresh listings from verified donors. Share your location to sort by distance.'} />
    {!reps.length && ok && <div className="banner warn rise"><FiUsers /><div><b>Add a pickup representative first</b><span>You choose who collects each pickup.</span></div><Btn size="sm" kind="ghost" onClick={() => setTab('profile')}>Add</Btn></div>}
    <DiscoverBoard listings={data} error={error} reps={reps} ok={ok}
      lockReason="Your organisation must be verified and active before you can request food."
      controls={controls} onRequested={async () => { await onRequested(); await refresh(); }} />
  </>);
}
