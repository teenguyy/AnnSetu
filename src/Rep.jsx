import React, { useState, useEffect } from 'react';
import { FiMapPin, FiClock, FiNavigation, FiMessageSquare, FiPackage, FiCheckCircle, FiUser, FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import { db, fmtDT, tleft, publicUrl } from './lib.js';
import { need, loadNotes, markAllRead, subscribe } from './data.js';
import { Shell, PageHead, Hero } from './shell.jsx';
import { Btn, Card, Tag, Empty, Skeleton, useLoader, useHashTab } from './ui.jsx';
import { ChatModal, TripStatus, LocationShare, CallLink, mapsLink } from './shared.jsx';

const TABS = ['pickups', 'history'];

async function loadRep(uid) {
  const [link, notes] = await Promise.all([db.rpc('link_my_rep'), loadNotes(uid)]);
  const info = link.error ? { linked: false } : link.data || { linked: false };
  if (!info.linked) return { info, notes, pickups: [] };
  const rows = need(await db.rpc('rep_my_pickups')) || [];
  rows.forEach((p) => {
    p.id = p.request_id;
    p.photo = publicUrl('listing-photos', p.photo_path);
    p.donor = { name: p.donor_name, phone: p.donor_phone, address: p.donor_address, lat: p.donor_lat, lng: p.donor_lng };
  });
  return { info, notes, pickups: rows };
}

export default function Rep({ me }) {
  const uid = me.user.id;
  const [tab, setTab] = useHashTab('pickups', TABS);
  const { data, error, refresh, setData } = useLoader(() => loadRep(uid), [uid]);
  const [chat, setChat] = useState(null);
  useEffect(() => subscribe(uid, refresh), [uid]); // eslint-disable-line

  if (error) return <div className="fatal"><h1>Couldn’t load your pickups</h1><p>{error.message}</p><button className="btn primary" onClick={refresh}>Try again</button></div>;
  if (!data) return <div className="boot"><Skeleton /></div>;
  const { info, notes, pickups } = data;
  const active = pickups.filter((p) => p.status === 'accepted');
  const past = pickups.filter((p) => p.status !== 'accepted');
  const readAll = async () => { await markAllRead(uid); setData({ ...data, notes: notes.map((n) => ({ ...n, read: true })) }); };
  const tabs = [
    { id: 'pickups', label: 'My pickups', icon: <FiMapPin />, badge: active.length || null },
    { id: 'history', label: 'History', icon: <FiClock /> },
  ];
  const org = info.linked ? { name: info.name + ' · ' + info.org_name } : null;

  const notLinked = (
    <Card>
      <div className="banner warn"><FiAlertTriangle /><div><b>Your account isn’t linked to an NGO yet</b>
        <span>Ask your NGO to add you under Profile → Pickup representatives using this email: <b>{me.user.email}</b>. Then press “Check again”.</span></div></div>
      <div className="acts"><Btn onClick={refresh}><FiRefreshCw /> Check again</Btn></div>
    </Card>
  );

  const pickupCard = (p, i) => (
    <Card key={p.id} i={i} className="rep-pick">
      <div className="row"><div><h3>{p.listing_title}</h3><span className="m">{p.quantity} {p.unit} · {p.category} · for {p.ngo_name}</span></div><Tag s={p.status}>{p.status === 'accepted' ? 'To collect' : p.status}</Tag></div>
      {p.photo ? <img className="lph" src={p.photo} alt="" loading="lazy" /> : null}
      <div className="rep-grid">
        <div><span className="lab"><FiMapPin /> Pickup from</span><b>{p.donor_name}</b><span>{p.donor_address || 'Address not provided: call the donor'}</span></div>
        <div><span className="lab"><FiClock /> Collect before</span><b>{fmtDT(p.pickup_by)}</b><span>{p.status === 'accepted' ? tleft(p.pickup_by) : ''}</span></div>
        {p.safety_notes ? <div className="wide"><span className="lab"><FiPackage /> Food notes</span><span>{p.safety_notes}</span></div> : null}
      </div>
      {p.status === 'accepted' && (<>
        <div className="acts">
          {mapsLink(p.donor) ? <a className="btn primary sm" href={mapsLink(p.donor)} target="_blank" rel="noopener noreferrer"><FiNavigation /> Directions (Google Maps)</a>
            : <span className="m">No map location saved by the donor.</span>}
          <CallLink phone={p.donor_phone} label="Call donor" />
          <Btn size="sm" kind="ghost" onClick={() => setChat(p)}><FiMessageSquare /> Message</Btn>
        </div>
        <div className="otpbox"><span className="m">Show this OTP to the donor at handover</span><div className="otpv">{p.otp || '····'}</div></div>
        <TripStatus request={p} canUpdate onChanged={refresh} />
        <LocationShare request={p} who="you" />
        <ul className="rep-check">
          <li>Carry clean containers or bags and your ID.</li>
          <li>Check the food looks and smells fresh before you accept it.</li>
          <li>Keep cooked food covered; deliver it quickly.</li>
        </ul>
      </>)}
      {p.status === 'completed' && <p className="m"><FiCheckCircle /> Collected. Thank you!</p>}
    </Card>
  );

  return (
    <Shell roleLabel="Representative" tabs={tabs} tab={tab} setTab={setTab} title={tab === 'pickups' ? 'My pickups' : 'History'} org={org} user={me.user} notes={notes} onReadAll={readAll}>
      {tab === 'pickups' && (<>
        <Hero kicker="Representative" title={info.linked ? `Hi ${info.name}` : 'Welcome'} text={info.linked ? `You collect food for ${info.org_name}. Your active pickups, directions and OTP are below.` : 'Link your account to your NGO to see pickups.'} />
        {!info.linked ? notLinked : active.length ? active.map(pickupCard) : <Empty icon={<FiUser />} title="No pickups assigned right now">When your NGO assigns you a pickup and the donor accepts it, it appears here with directions and the OTP.</Empty>}
      </>)}
      {tab === 'history' && (<>
        <PageHead kicker="Record" title="History" sub="Pickups from the last 30 days." />
        {past.length ? past.map(pickupCard) : <Empty>No completed pickups yet.</Empty>}
      </>)}
      {chat && <ChatModal request={chat} meId={uid} title={`Chat about ${chat.listing_title}`} onClose={() => setChat(null)} />}
    </Shell>
  );
}
