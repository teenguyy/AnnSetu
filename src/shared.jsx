import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiMapPin, FiUploadCloud, FiTrash2, FiAward, FiPrinter, FiShield, FiAlertTriangle, FiCheckCircle, FiClock, FiFileText, FiNavigation, FiTruck, FiPhone, FiExternalLink } from 'react-icons/fi';
import { db, DONOR_TYPES, NGO_TYPES, DOC_TYPES, uploadTo, ago, fmtD, fmtDT } from './lib.js';
import { need, saveOrg, orgDocs, loadMessages, sendMessage, fileReport, loadImpact } from './data.js';
import { Btn, AsyncForm, Field, Card, Tag, Empty, Modal, Ring, Bar, Stat, useToast, useLoader, Skeleton } from './ui.jsx';
import { PageHead } from './shell.jsx';
import { api, apiReady } from './api.js';
import { addressFor } from './maps.js';

export const canAct = (org) => !!org && org.verification === 'approved' && !org.suspended;

/* Profile completion is compulsory before the dashboard opens (documents can come later). */
export function missingProfile(org, role) {
  if (!org) return ['organisation details'];
  const m = [];
  if (!org.name || org.name.trim().length < 2) m.push('organisation name');
  if (!org.phone || String(org.phone).replace(/\D/g, '').length < 7) m.push('phone');
  if (!org.address || org.address.trim().length < 8) m.push('full address');
  if (!org.about || org.about.trim().length < 20) m.push('about (20+ characters)');
  if (org.lat == null || org.lng == null) m.push('location');
  if (role === 'ngo' && (!org.area_served || org.area_served.trim().length < 2)) m.push('area served');
  return m;
}
export const profileComplete = (org, role) => missingProfile(org, role).length === 0;
export const NO_CERT_TYPES = ['NGO', 'Community group', 'Community kitchen'];

export function VerifyBanner({ org, goProfile }) {
  if (!org) return (
    <div className="banner warn rise"><FiAlertTriangle /><div><b>Set up your organisation profile</b><span>Add your details and verification documents to get started.</span></div><Btn size="sm" kind="ghost" onClick={goProfile}>Open profile</Btn></div>
  );
  if (org.suspended) return (
    <div className="banner bad rise"><FiAlertTriangle /><div><b>Your account is suspended</b><span>{org.suspended_reason || 'Please contact AnnSetu support.'}</span></div></div>
  );
  if (org.verification === 'pending') return (
    <div className="banner warn rise"><FiClock /><div><b>Verification pending</b><span>An admin is reviewing your organisation. Make sure you have uploaded your documents.</span></div><Btn size="sm" kind="ghost" onClick={goProfile}>Documents</Btn></div>
  );
  if (org.verification === 'rejected') return (
    <div className="banner bad rise"><FiAlertTriangle /><div><b>Verification was rejected</b><span>{org.verification_note || 'Please review your documents and contact support.'}</span></div><Btn size="sm" kind="ghost" onClick={goProfile}>Fix documents</Btn></div>
  );
  return null;
}

/* ---------------- chat ---------------- */
/* Private conversations per pickup: each thread is visible only to its two parties (enforced by the database). */
const THREADS = {
  donor: [['donor_ngo', 'ngo'], ['donor_rep', 'rep']],
  ngo: [['donor_ngo', 'donor'], ['ngo_rep', 'rep']],
  rep: [['donor_rep', 'donor'], ['ngo_rep', 'ngo']],
};
export function ChatModal({ request, meId, side = 'donor', names = {}, onClose }) {
  const threads = THREADS[side] || THREADS.donor;
  const [thread, setThread] = useState(threads[0][0]);
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const box = useRef();
  const toast = useToast();
  const label = (who) => names[who] || (who === 'ngo' ? 'Receiver' : who === 'rep' ? 'Representative' : 'Donor');
  const other = threads.find((t) => t[0] === thread)[1];
  const load = async () => { try { setMsgs(await loadMessages(request.id, thread)); } catch (e) { toast(e.message, 'bad'); } };
  useEffect(() => {
    setMsgs(null); load();
    let ch = null;
    try {
      ch = db.channel('msg-' + request.id + '-' + thread)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'request_id=eq.' + request.id }, load).subscribe();
    } catch (e) {}
    const poll = setInterval(load, 8000);
    return () => { clearInterval(poll); if (ch) db.removeChannel(ch); };
  }, [request.id, thread]); // eslint-disable-line
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs]);
  const send = async (e) => {
    e.preventDefault();
    const b = text.trim();
    if (!b) return;
    setText('');
    try { await sendMessage(request.id, b, thread); await load(); } catch (x) { setText(b); toast(x.message, 'bad'); }
  };
  return (
    <Modal title="Messages" onClose={onClose}>
      <div className="chat-tabs" role="tablist" aria-label="Conversations">
        {threads.map(([t, who]) => (
          <button key={t} role="tab" aria-selected={thread === t} className={thread === t ? 'on' : ''} onClick={() => setThread(t)}>{label(who)}</button>
        ))}
      </div>
      <p className="chat-private"><FiShield /> Private: only you and {label(other)} can see this chat.</p>
      <div className="chat" ref={box}>
        {msgs === null ? <div className="m">Loading…</div> : msgs.length === 0 ? <div className="m center">No messages yet. Say hello to {label(other)}.</div> :
          msgs.map((m, i) => {
            const mine = m.sender_id === meId;
            const prev = msgs[i - 1];
            const grouped = prev && prev.sender_id === m.sender_id && new Date(m.created_at) - new Date(prev.created_at) < 120000;
            return (
              <div key={m.id} className={'bub' + (mine ? ' me' : '') + (grouped ? ' grp' : '')}>
                <p>{m.body}</p><small>{new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>
              </div>
            );
          })}
      </div>
      <form className="chatf" onSubmit={send}>
        <input value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder={`Message ${label(other)}…`} aria-label="Message" />
        <button className="btn primary" type="submit" aria-label="Send"><FiSend /></button>
      </form>
    </Modal>
  );
}

/* ---------------- report ---------------- */
const REASONS = [['unsafe_food', 'Unsafe or spoiled food'], ['no_show', 'No-show at pickup'], ['misconduct', 'Misconduct'], ['fake_organisation', 'Looks like a fake organisation'], ['other', 'Something else']];
export function ReportModal({ reporterOrg, reportedOrg, requestId, reportedName, onClose }) {
  const toast = useToast();
  return (
    <Modal title={`Report ${reportedName || 'organisation'}`} onClose={onClose}>
      <p className="m">Reports go to AnnSetu admins. Please share only what you directly experienced.</p>
      <AsyncForm onSubmit={async (fd) => {
        try {
          await fileReport({ reporter_org: reporterOrg, reported_org: reportedOrg, request_id: requestId || null, reason: fd.get('reason'), details: String(fd.get('details') || '').trim() || null });
        } catch (e) {
          if (/duplicate|one_open_report/i.test(e.message || '')) throw new Error('You already have an open report for this reason.');
          throw e;
        }
        toast('Report sent to the admins. Thank you.');
        onClose();
      }}>
        {({ busy }) => (<>
          <Field label="Reason"><select name="reason" defaultValue="unsafe_food">{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="What happened?" wide><textarea name="details" rows={4} maxLength={1000} placeholder="Describe the issue" /></Field>
          <div className="wide"><Btn type="submit" busy={busy}>Send report</Btn></div>
        </>)}
      </AsyncForm>
    </Modal>
  );
}

/* ---------------- certificate ---------------- */
export function CertModal({ cert, orgName, onClose }) {
  return (
    <Modal title="Certificate" onClose={onClose} wide>
      <div className="cert">
        <div className="cert-in">
          <small>AnnSetu</small>
          <h2>Certificate of Appreciation</h2>
          <p>is proudly presented to</p>
          <h3>{orgName}</h3>
          <p>for earning the badge</p>
          <h4>{cert.title}</h4>
          <p className="m">Issued {fmtD(cert.issued_at)} · Serial {cert.serial}</p>
          <i className="seal"><FiAward /></i>
        </div>
      </div>
      <div className="center" style={{ marginTop: 14 }}><Btn onClick={() => window.print()}><FiPrinter /> Print or save as PDF</Btn></div>
    </Modal>
  );
}

/* ---------------- impact (badges, certificates, leaderboard) ---------------- */
export function ImpactView({ org, kind, stats }) {
  const { data, error } = useLoader(() => loadImpact(org.id, kind), [org.id]);
  const [cert, setCert] = useState(null);
  const verb = kind === 'donor' ? 'donated' : 'received';
  if (error) return <Empty>Couldn’t load your achievements: {error.message}</Empty>;
  if (!data) return <Skeleton />;
  const cur = { donations: stats.donations, units: stats.units, partners: stats.partners };
  const label = (d) => d.metric === 'donations' ? `${d.threshold} ${kind === 'donor' ? 'donation' : 'pickup'}${d.threshold > 1 ? 's' : ''}` : d.metric === 'units' ? `${d.threshold} units ${verb}` : `${d.threshold} ${kind === 'donor' ? 'NGOs' : 'donors'}`;
  return (<>
    <PageHead kicker="Recognition" title="Impact" sub="Calculated only from your confirmed pickups." />
    <div className="grid">
      <Stat i={0} n={stats.donations} label={kind === 'donor' ? 'Donations completed' : 'Pickups completed'} icon={<FiCheckCircle />} />
      <Stat i={1} n={stats.units} label={`Units ${verb}`} icon={<FiAward />} />
      <Stat i={2} n={stats.partners} label={kind === 'donor' ? 'NGOs supported' : 'Donors partnered'} icon={<FiShield />} />
    </div>
    <h3 className="sec">Achievements</h3>
    <div className="badges">
      {data.defs.map((d, i) => {
        const on = data.earned.has(d.code);
        return (
          <div key={d.code} className={'bd rise' + (on ? ' on' : '')} style={{ '--i': i }}>
            <div className="ic"><FiAward /></div>
            <b>{d.name}</b>
            <div className="m">{on ? 'Earned' : label(d)}</div>
            {!on && <Bar pct={((cur[d.metric] || 0) / d.threshold) * 100} />}
          </div>
        );
      })}
    </div>
    <h3 className="sec">Certificates</h3>
    {data.certs.length ? data.certs.map((c, i) => (
      <Card key={c.id} i={i} className="row"><div><h3>{c.title}</h3><span className="m">Issued {fmtD(c.issued_at)} · {c.serial}</span></div><Btn size="sm" kind="ghost" onClick={() => setCert(c)}><FiFileText /> View</Btn></Card>
    )) : <Empty>Certificates appear here when you earn a badge.</Empty>}
    <h3 className="sec">Top {kind === 'donor' ? 'donors' : 'receivers'} <small className="m">(public leaderboard)</small></h3>
    {data.board.length ? (
      <Card className="board">
        {data.board.map((b, i) => (
          <div key={b.org_id} className={'brow' + (b.org_id === org.id ? ' me' : '')}>
            <span className="rank">{b.rank || i + 1}</span><b>{b.name}</b><span className="m">{b.pickups ?? b.donations} {kind === 'donor' ? 'donations' : 'pickups'}</span><span className="u">{b.units} units</span>
          </div>
        ))}
      </Card>
    ) : <Empty>The leaderboard fills up as pickups are completed.</Empty>}
    {cert && <CertModal cert={cert} orgName={org.name} onClose={() => setCert(null)} />}
  </>);
}

/* ---------------- profile (organisation details, logo, location, documents) ---------------- */
export function ProfileView({ role, user, org, docs, onChanged, extra }) {
  const toast = useToast();
  const types = role === 'ngo' ? NGO_TYPES : DONOR_TYPES;
  const [pos, setPos] = useState({ lat: org?.lat ?? '', lng: org?.lng ?? '' });
  useEffect(() => { setPos({ lat: org?.lat ?? '', lng: org?.lng ?? '' }); }, [org?.id, org?.lat, org?.lng]);
  const filled = org ? [org.name, org.org_type, org.phone, org.address, org.about, org.lat != null && org.lng != null, org.logo_path, role === 'ngo' ? org.area_served : true].filter(Boolean).length : 0;
  const pct = Math.round((filled / 8) * 100);
  const useMyLocation = () => new Promise((res) => {
    if (!navigator.geolocation) { toast('Your browser can’t share location.', 'bad'); return res(); }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = p.coords.latitude, lng = p.coords.longitude;
        setPos({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
        // OpenStreetMap (Nominatim) fills in the address too, if the field is empty
        addressFor(lat, lng).then((addr) => {
          const el = document.querySelector('input[name=address]');
          if (addr && el && !el.value.trim()) { el.value = addr.slice(0, 160); toast('Location and address filled in. Check them and save.', 'info'); }
        }).catch(() => {});
        toast('Location captured. Save to keep it.', 'info'); res();
      },
      () => { toast('Couldn’t read your location. Allow location access and try again.', 'bad'); res(); },
      { enableHighAccuracy: true, timeout: 12000 });
  });
  const save = async (fd) => {
    const v = { name: String(fd.get('name')).trim(), type: fd.get('type'), phone: String(fd.get('phone') || '').trim(), address: String(fd.get('address') || '').trim(), about: String(fd.get('about') || '').trim(), area: String(fd.get('area') || '').trim(), lat: pos.lat, lng: pos.lng };
    if (v.name.length < 2) throw new Error('Enter your organisation’s name.');
    if (v.phone.replace(/\D/g, '').length < 7) throw new Error('Enter a phone number (at least 7 digits).');
    if (v.address.length < 8) throw new Error('Enter your full address.');
    if (v.about.length < 20) throw new Error('Tell us about your organisation in at least 20 characters.');
    if (role === 'ngo' && v.area.length < 2) throw new Error('Enter the area you serve.');
    if (v.lat === '' || v.lng === '' || v.lat == null || v.lng == null || isNaN(Number(v.lat)) || isNaN(Number(v.lng))) throw new Error('Add your location: use “Use my current location” or enter latitude and longitude.');
    const logo = fd.get('logo');
    if (logo && logo.size) {
      if (logo.size > 1024 * 1024) throw new Error('Logo must be 1 MB or smaller.');
      if (!/^image\/(jpeg|png|webp)$/.test(logo.type)) throw new Error('Logo must be a JPG, PNG or WebP image.');
      v.logo_path = await uploadTo('org-logos', user.id, logo);
    }
    await saveOrg(user.id, role, org, v);
    toast(org ? 'Profile saved.' : 'Profile created. Upload documents now, or later from this page.');
    await onChanged();
  };
  const upload = async (fd, form) => {
    const f = fd.get('document');
    if (!f || !f.size) throw new Error('Choose a file first.');
    if (f.size > 5 * 1024 * 1024) throw new Error('File must be 5 MB or smaller.');
    if (!/^(application\/pdf|image\/(jpeg|png))$/.test(f.type)) throw new Error('Upload a PDF, JPG or PNG.');
    const path = await uploadTo('verification-docs', user.id, f, org.id + '/');
    const row = need(await db.from('verification_documents').insert({ org_id: org.id, path, doc_type: fd.get('doc_type') }).select('id').single());
    form.reset();
    // AI reads and checks the document straight away, so the admin's summary is ready before they open it.
    if (row && row.id && apiReady()) api('/ai/auto-review', { document_id: row.id }).catch(() => {});
    toast('Document uploaded. Our AI is checking it now; an admin will make the final decision.');
    await onChanged();
  };
  const delDoc = async (d) => { need(await db.from('verification_documents').delete().eq('id', d.id)); toast('Document removed.'); await onChanged(); };
  return (<>
    {missingProfile(org, role).length > 0 && (
      <div className="banner warn rise" role="status"><FiAlertTriangle /><div><b>Complete your profile to continue</b><span>Required: {missingProfile(org, role).join(', ')}. Verification documents can be added later.</span></div></div>
    )}
    <div className="phero rise">
      <div className="cover" />
      <div className="pbody">
        <div className="bigav">{org?.logo ? <img src={org.logo} alt="" /> : (org?.name || user.email).slice(0, 2).toUpperCase()}</div>
        <div className="pinfo">
          <h1>{org?.name || 'Your organisation'}</h1>
          <div className="chips">
            {org && <Tag s={org.suspended ? 'rejected' : org.verification}>{org.suspended ? 'suspended' : org.verification}</Tag>}
            {org?.org_type && <Tag>{org.org_type}</Tag>}
            {org?.address && <span className="m">{org.address}</span>}
          </div>
        </div>
      </div>
    </div>
    <div className="pgrid">
      <Card i={1} className="ringc"><Ring pct={pct} /><div><h3>{pct}% complete</h3><span className="m">Complete profiles earn more trust.</span></div></Card>
      <Card i={2}><h3>Verification</h3><div style={{ margin: '8px 0' }}>{org ? <Tag s={org.suspended ? 'rejected' : org.verification}>{org.suspended ? 'suspended' : org.verification}</Tag> : <Tag>not started</Tag>}</div><p className="m">{org?.verification_note || 'Upload at least one document. An admin checks it and verifies your organisation.'}</p></Card>
      <Card i={3}><h3>Account</h3><p className="m" style={{ margin: '6px 0' }}>{user.email}</p><span className="m">Signed in as {role === 'ngo' ? 'receiver' : 'donor'}</span></Card>
    </div>

    <Card i={4}>
      <h3>Organisation details</h3>
      <AsyncForm onSubmit={save} className="mt">
        {({ busy }) => (<>
          <Field label="Organisation name *" wide><input name="name" defaultValue={org?.name || ''} maxLength={80} required /></Field>
          <Field label="Type"><select name="type" defaultValue={org?.org_type || types[0]}>{types.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Phone *"><input name="phone" defaultValue={org?.phone || ''} maxLength={20} inputMode="tel" required /></Field>
          {role === 'ngo' && <Field label="Area served *"><input name="area" defaultValue={org?.area_served || ''} maxLength={80} placeholder="e.g. East Delhi" required /></Field>}
          <Field label={role === 'ngo' ? 'Address *' : 'Pickup address *'} wide={role !== 'ngo'}><input name="address" defaultValue={org?.address || ''} maxLength={160} required /></Field>
          <Field label="About *" wide><textarea name="about" rows={3} maxLength={300} defaultValue={org?.about || ''} placeholder="Who you are, what you do, who you serve (20+ characters)" required /></Field>
          <Field label="Latitude *" hint="Used to find food near you"><input value={pos.lat} onChange={(e) => setPos({ ...pos, lat: e.target.value })} inputMode="decimal" /></Field>
          <Field label="Longitude *"><input value={pos.lng} onChange={(e) => setPos({ ...pos, lng: e.target.value })} inputMode="decimal" /></Field>
          <div className="wide"><Btn kind="ghost" size="sm" onClick={useMyLocation}><FiMapPin /> Use my current location</Btn></div>
          <Field label="Logo (optional, 1 MB max)" wide><input name="logo" type="file" accept="image/jpeg,image/png,image/webp" /></Field>
          <div className="wide"><Btn type="submit" busy={busy}>{org ? 'Save profile' : 'Create profile'}</Btn></div>
        </>)}
      </AsyncForm>
    </Card>

    {extra}

    {org && (
      <Card i={6}>
        <h3>Verification documents</h3>
        <p className="m">Registration, FSSAI, 12A/80G or similar proof. PDF, JPG or PNG up to 5 MB.</p>
        <AsyncForm onSubmit={upload} className="mt">
          {({ busy }) => (<>
            <Field label="Document type"><select name="doc_type">{DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="File"><input name="document" type="file" accept="application/pdf,image/jpeg,image/png" required /></Field>
            <div className="wide"><Btn type="submit" busy={busy}><FiUploadCloud /> Upload document</Btn></div>
          </>)}
        </AsyncForm>
        {NO_CERT_TYPES.includes(org.org_type) && <NoCertificate org={org} hasDocs={docs.length > 0} onChanged={onChanged} />}
        <div className="docs">
          {docs.map((d) => (
            <div key={d.id} className="doc">
              <FiFileText /><div><b>{(DOC_TYPES.find((x) => x[0] === d.doc_type) || [0, d.doc_type])[1]}</b><small>{fmtDT(d.created_at)}{d.reviewer_note ? ` · ${d.reviewer_note}` : ''}</small></div>
              <Tag s={d.status} />
              {d.status !== 'approved' && <button className="ib sm" aria-label="Remove document" onClick={() => delDoc(d).catch((e) => toast(e.message, 'bad'))}><FiTrash2 /></button>}
            </div>
          ))}
          {!docs.length && <div className="m">No documents uploaded yet.</div>}
        </div>
      </Card>
    )}
  </>);
}

export function Checklist({ items }) {
  const n = items.filter((x) => x[1]).length;
  if (n === items.length) return null;
  return (
    <Card i={2}>
      <div className="row"><h3>Getting started</h3><span className="m">{n} of {items.length}</span></div>
      <Bar pct={(n / items.length) * 100} />
      {items.map(([t, ok], i) => <div key={i} className={'ck' + (ok ? ' ok' : '')}><i>{ok ? '✓' : ''}</i><span>{t}</span></div>)}
    </Card>
  );
}
export function Activity({ events }) {
  if (!events.length) return null;
  return (
    <Card i={3}>
      <h3>Recent activity</h3>
      {events.slice(0, 6).map((e, i) => <div key={i} className="ev"><span>{e.t}</span><small className="m">{ago(new Date(e.at).getTime())}</small></div>)}
    </Card>
  );
}

/* "We don't have a registration certificate": manual admin review (sql/annsetu_schema_part6_no_certificate.sql). */
function NoCertificate({ org, hasDocs, onChanged }) {
  const toast = useToast();
  const [open, setOpen] = useState(!!org.no_certificate);
  if (org.verification === 'approved') return null;
  if (org.no_certificate && org.no_certificate_requested_at) {
    return (
      <div className="nocert done" role="status">
        <FiClock /><div><b>Manual review requested</b>
          <span>Requested {fmtD(org.no_certificate_requested_at)}. Your request will be reviewed within <b>3–5 business days</b>. We’ll notify you here and by email.</span>
          <button type="button" className="lk" onClick={async () => { try { need(await db.from('organizations').update({ no_certificate: false, no_certificate_note: null }).eq('id', org.id)); await onChanged(); } catch (e) { toast(e.message, 'bad'); } }}>Withdraw request (I'll upload a document instead)</button>
        </div>
      </div>
    );
  }
  return (
    <div className="nocert">
      <label className="ck2"><input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> <span><b>We don’t have a registration certificate</b> (local NGOs, community groups and community kitchens)</span></label>
      {open && (
        <AsyncForm className="mt" onSubmit={async (fd) => {
          const note = String(fd.get('note') || '').trim();
          if (note.length < 30) throw new Error('Please explain who you serve, since when, and any references (at least 30 characters).');
          try { need(await db.from('organizations').update({ no_certificate: true, no_certificate_note: note }).eq('id', org.id)); }
          catch (e) {
            if (/no_certificate|column/i.test(e.message || '')) throw new Error('This option needs a database update (sql/annsetu_schema_part6_no_certificate.sql). Please contact AnnSetu support.');
            throw e;
          }
          toast('Request sent. Your request will be reviewed within 3–5 business days.');
          await onChanged();
        }}>
          {({ busy }) => (<>
            <Field label="Tell the admins about your organisation" wide hint={hasDocs ? 'Supporting files you uploaded above (photos, letters, ID) help the review.' : 'Optional: upload any supporting proof above (photos, letters, ID) as “Other proof”.'}>
              <textarea name="note" rows={4} minLength={30} maxLength={1000} defaultValue={org.no_certificate_note || ''} placeholder="Who you serve, since when, where, and people or organisations who can vouch for you" />
            </Field>
            <p className="m wide">Your request will be reviewed within <b>3–5 business days</b>.</p>
            <div className="wide"><Btn type="submit" busy={busy}>Request admin review</Btn></div>
          </>)}
        </AsyncForm>
      )}
    </div>
  );
}


/* ---------------- pickup tracking (status + ETA) ---------------- */
const TRIP = { assigned: 'Representative assigned', on_the_way: 'On the way', arrived: 'Arrived at pickup', collected: 'Collected' };
const TRIP_STEPS = ['assigned', 'on_the_way', 'arrived'];
export const mapsLink = (o) => {
  if (!o) return null;
  const q = o.lat != null && o.lng != null ? `${o.lat},${o.lng}` : (o.address || '');
  return q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : null;
};
export function TripStatus({ request, canUpdate, onChanged }) {
  const toast = useToast();
  const [mins, setMins] = useState(20);
  const st = request.trip_status || 'assigned';
  const idx = TRIP_STEPS.indexOf(st);
  const set = (status) => async () => {
    const eta = status === 'on_the_way' ? new Date(Date.now() + mins * 6e4).toISOString() : null;
    const r = await db.rpc('set_trip_status', { p_request: request.id, p_status: status, p_eta: eta });
    if (r.error) { toast(r.error.message, 'bad'); return; }
    toast(status === 'on_the_way' ? 'Donor and NGO notified: on the way.' : 'Donor and NGO notified: arrived.');
    if (onChanged) await onChanged();
  };
  return (
    <div className="trip" aria-label="Pickup progress">
      <ol className="trip-steps">
        {TRIP_STEPS.map((k, i) => <li key={k} className={i < idx ? 'done' : i === idx ? 'now' : ''}><i />{TRIP[k]}</li>)}
      </ol>
      <div className="trip-eta"><FiTruck />
        {st === 'on_the_way' && request.eta ? <span>ETA <b>{new Date(request.eta).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</b></span>
          : st === 'arrived' ? <span>The representative is at the pickup point.</span>
          : <span>Waiting for the representative to start the trip.</span>}
        {request.trip_updated_at && <small className="m"> · updated {ago(new Date(request.trip_updated_at).getTime())}</small>}
      </div>
      {canUpdate && (
        <div className="acts trip-acts">
          {st !== 'arrived' && (<>
            <select className="mini" value={mins} onChange={(e) => setMins(+e.target.value)} aria-label="Minutes until arrival">
              {[10, 20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
            <Btn size="sm" onClick={set('on_the_way')}><FiNavigation /> {st === 'on_the_way' ? 'Update ETA' : 'On the way'}</Btn>
          </>)}
          {st === 'on_the_way' && <Btn size="sm" kind="ghost" onClick={set('arrived')}><FiMapPin /> I’ve arrived</Btn>}
        </div>
      )}
    </div>
  );
}

/* ---------------- live location sharing during a pickup ---------------- */
export function LocationShare({ request, who = 'your representative' }) {
  const toast = useToast();
  const [on, setOn] = useState(false);
  const [last, setLast] = useState(null);
  const watch = useRef(null);
  const lastSent = useRef(0);
  const stop = () => { if (watch.current != null) navigator.geolocation.clearWatch(watch.current); watch.current = null; };
  useEffect(() => stop, []);
  const toggle = () => {
    if (on) { stop(); setOn(false); return; }
    if (!navigator.geolocation) { toast('Your device can’t share location.', 'bad'); return; }
    watch.current = navigator.geolocation.watchPosition(async (p) => {
      if (Date.now() - lastSent.current < 5000) return;
      lastSent.current = Date.now();
      const r = await db.rpc('update_location', { p_request: request.id, p_lat: +p.coords.latitude.toFixed(6), p_lng: +p.coords.longitude.toFixed(6), p_acc: Math.round(p.coords.accuracy || 0) });
      if (r.error) { toast(r.error.message, 'bad'); stop(); setOn(false); } else setLast(new Date());
    }, () => { toast('Location permission was denied.', 'bad'); stop(); setOn(false); }, { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 });
    setOn(true);
  };
  return (
    <div className="loc"><FiNavigation />
      <span>{on ? `Sharing live location with the donor${last ? ' · updated ' + last.toLocaleTimeString() : '…'}` : `Let the donor see ${who} on the way (optional)`}</span>
      <button className={'switch' + (on ? ' on' : '')} role="switch" aria-checked={on} aria-label="Share live location" onClick={toggle}><i /></button>
    </div>
  );
}

/* Donor side: where is the representative? (live location, read-only) */
export function RepLocation({ requestId }) {
  const [loc, setLoc] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = async () => { const r = await db.from('rep_locations').select('lat,lng,updated_at').eq('request_id', requestId).maybeSingle(); if (alive && !r.error) setLoc(r.data); };
    load();
    const t = setInterval(load, 10000);
    return () => { alive = false; clearInterval(t); };
  }, [requestId]);
  if (!loc) return null;
  return (
    <a className="loc live" href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`} target="_blank" rel="noopener noreferrer">
      <FiNavigation /><span>Representative’s live location · {ago(new Date(loc.updated_at).getTime())}</span><FiExternalLink />
    </a>
  );
}

export function CallLink({ phone, label }) {
  if (!phone) return null;
  return <a className="btn ghost sm" href={'tel:' + String(phone).replace(/[^+\d]/g, '')}><FiPhone /> {label || 'Call'}</a>;
}

/* ---------------- community needs (published by verified receivers) ---------------- */
export async function loadNeeds(all = false) {
  let q = db.from('requirements').select('*').order('needed_by', { ascending: true }).limit(200);
  if (!all) q = q.eq('status', 'open');
  const rows = need(await q) || [];
  const ids = [...new Set(rows.map((r) => r.ngo_org_id))];
  const orgs = ids.length ? need(await db.from('organizations').select('id,name,org_type,area_served,address,phone').in('id', ids)) || [] : [];
  const byId = Object.fromEntries(orgs.map((o) => [o.id, o]));
  return rows.map((r) => ({ ...r, ngo: byId[r.ngo_org_id] || null }));
}
export function NeedsList({ admin, onHelp, onMessage, emptyText, reloadKey }) {
  const { data, error } = useLoader(() => loadNeeds(admin), [admin, reloadKey]);
  if (error) return <Empty>Couldn’t load needs: {error.message}</Empty>;
  if (!data) return <Skeleton />;
  if (!data.length) return <Empty>{emptyText || 'No open needs right now.'}</Empty>;
  return data.map((n, i) => {
    const late = new Date(n.needed_by) < new Date();
    return (
      <Card key={n.id} i={i} className="need-card">
        <div className="row"><div><h3>{n.title}</h3>
          <span className="m">{n.quantity} needed by {fmtDT(n.needed_by)} · {n.ngo ? n.ngo.name : 'Receiver'}{n.ngo?.area_served ? ' · serves ' + n.ngo.area_served : ''}</span></div>
          <Tag s={n.status === 'open' ? (late ? 'rejected' : 'pending') : 'approved'}>{n.status === 'open' ? (late ? 'overdue' : 'open') : n.status}</Tag></div>
        {(onHelp || onMessage || n.ngo?.phone) && (
          <div className="acts">
            {onHelp && n.status === 'open' && <Btn size="sm" onClick={() => onHelp(n)}>Fulfil this need</Btn>}
            {onMessage && <Btn size="sm" kind="ghost" onClick={() => onMessage(n)}>Message {n.ngo?.name || 'receiver'}</Btn>}
            {n.ngo?.phone && <a className="btn ghost sm" href={'tel:' + String(n.ngo.phone).replace(/[^+\d]/g, '')}>Call {n.ngo.name}</a>}
          </div>
        )}
      </Card>
    );
  });
}
