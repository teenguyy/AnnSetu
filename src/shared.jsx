import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiMapPin, FiUploadCloud, FiTrash2, FiAward, FiPrinter, FiShield, FiAlertTriangle, FiCheckCircle, FiClock, FiFileText } from 'react-icons/fi';
import { db, DONOR_TYPES, NGO_TYPES, DOC_TYPES, uploadTo, ago, fmtD, fmtDT } from './lib.js';
import { need, saveOrg, orgDocs, loadMessages, sendMessage, fileReport, loadImpact } from './data.js';
import { Btn, AsyncForm, Field, Card, Tag, Empty, Modal, Ring, Bar, Stat, useToast, useLoader, Skeleton } from './ui.jsx';
import { PageHead } from './shell.jsx';

export const canAct = (org) => !!org && org.verification === 'approved' && !org.suspended;

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
export function ChatModal({ request, meId, title, onClose }) {
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const box = useRef();
  const toast = useToast();
  const load = async () => { try { setMsgs(await loadMessages(request.id)); } catch (e) { toast(e.message, 'bad'); } };
  useEffect(() => {
    load();
    let ch = null;
    try {
      ch = db.channel('msg-' + request.id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'request_id=eq.' + request.id }, load).subscribe();
    } catch (e) {}
    const poll = setInterval(load, 8000);
    return () => { clearInterval(poll); if (ch) db.removeChannel(ch); };
  }, [request.id]); // eslint-disable-line
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs]);
  const send = async (e) => {
    e.preventDefault();
    const b = text.trim();
    if (!b) return;
    setText('');
    try { await sendMessage(request.id, b); await load(); } catch (x) { setText(b); toast(x.message, 'bad'); }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <div className="chat" ref={box}>
        {msgs === null ? <div className="m">Loading…</div> : msgs.length === 0 ? <div className="m center">No messages yet. Say hello and coordinate the pickup.</div> :
          msgs.map((m) => (
            <div key={m.id} className={'bub' + (m.sender_id === meId ? ' me' : '')}>
              <p>{m.body}</p><small>{ago(new Date(m.created_at).getTime())}</small>
            </div>
          ))}
      </div>
      <form className="chatf" onSubmit={send}>
        <input value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" aria-label="Message" />
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
    <h3 className="sec">Top {kind === 'donor' ? 'donors' : 'receivers'}</h3>
    {data.board.length ? (
      <Card className="board">
        {data.board.map((b, i) => (
          <div key={b.org_id} className={'brow' + (b.org_id === org.id ? ' me' : '')}>
            <span className="rank">{i + 1}</span><b>{b.name}</b><span className="m">{b.donations} {kind === 'donor' ? 'donations' : 'pickups'}</span><span className="u">{b.units} units</span>
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
      (p) => { setPos({ lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) }); toast('Location captured. Save to keep it.', 'info'); res(); },
      () => { toast('Couldn’t read your location. Allow location access and try again.', 'bad'); res(); },
      { enableHighAccuracy: true, timeout: 12000 });
  });
  const save = async (fd) => {
    const v = { name: String(fd.get('name')).trim(), type: fd.get('type'), phone: String(fd.get('phone') || '').trim(), address: String(fd.get('address') || '').trim(), about: String(fd.get('about') || '').trim(), area: String(fd.get('area') || '').trim(), lat: pos.lat, lng: pos.lng };
    if (v.name.length < 2) throw new Error('Enter your organisation’s name.');
    const logo = fd.get('logo');
    if (logo && logo.size) {
      if (logo.size > 1024 * 1024) throw new Error('Logo must be 1 MB or smaller.');
      if (!/^image\/(jpeg|png|webp)$/.test(logo.type)) throw new Error('Logo must be a JPG, PNG or WebP image.');
      v.logo_path = await uploadTo('org-logos', user.id, logo);
    }
    await saveOrg(user.id, role, org, v);
    toast(org ? 'Profile saved.' : 'Profile created. Now upload your documents for verification.');
    await onChanged();
  };
  const upload = async (fd, form) => {
    const f = fd.get('document');
    if (!f || !f.size) throw new Error('Choose a file first.');
    if (f.size > 5 * 1024 * 1024) throw new Error('File must be 5 MB or smaller.');
    if (!/^(application\/pdf|image\/(jpeg|png))$/.test(f.type)) throw new Error('Upload a PDF, JPG or PNG.');
    const path = await uploadTo('verification-docs', user.id, f, org.id + '/');
    need(await db.from('verification_documents').insert({ org_id: org.id, path, doc_type: fd.get('doc_type') }));
    form.reset();
    toast('Document uploaded. An admin will review it.');
    await onChanged();
  };
  const delDoc = async (d) => { need(await db.from('verification_documents').delete().eq('id', d.id)); toast('Document removed.'); await onChanged(); };
  return (<>
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
          <Field label="Organisation name" wide><input name="name" defaultValue={org?.name || ''} maxLength={80} required /></Field>
          <Field label="Type"><select name="type" defaultValue={org?.org_type || types[0]}>{types.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Phone"><input name="phone" defaultValue={org?.phone || ''} maxLength={20} inputMode="tel" /></Field>
          {role === 'ngo' && <Field label="Area served"><input name="area" defaultValue={org?.area_served || ''} maxLength={80} placeholder="e.g. East Delhi" /></Field>}
          <Field label={role === 'ngo' ? 'Address' : 'Pickup address'} wide={role !== 'ngo'}><input name="address" defaultValue={org?.address || ''} maxLength={160} /></Field>
          <Field label="About" wide><textarea name="about" rows={3} maxLength={300} defaultValue={org?.about || ''} placeholder="A short description of your organisation" /></Field>
          <Field label="Latitude" hint="Used to find food near you"><input value={pos.lat} onChange={(e) => setPos({ ...pos, lat: e.target.value })} inputMode="decimal" /></Field>
          <Field label="Longitude"><input value={pos.lng} onChange={(e) => setPos({ ...pos, lng: e.target.value })} inputMode="decimal" /></Field>
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
