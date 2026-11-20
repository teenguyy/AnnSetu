import React, { useState, useEffect } from 'react';
import { FiHome, FiShield, FiBriefcase, FiList, FiInbox, FiFlag, FiMail, FiEdit3, FiClipboard, FiEye, FiCheck, FiX, FiUsers, FiBox, FiHeart, FiTrendingUp, FiAlertTriangle, FiTrash2, FiPlus, FiCpu, FiAward, FiRefreshCw, FiStar, FiEyeOff } from 'react-icons/fi';
import { api, apiReady } from './api.js';
import { db, fmtDT, fmtD, tleft, DOC_TYPES } from './lib.js';
import { need, loadNotes, markAllRead, subscribe } from './data.js';
import { Shell, PageHead, Hero } from './shell.jsx';
import { Btn, AsyncForm, Field, Card, Tag, Empty, Stat, Skeleton, Modal, useToast, useLoader, useHashTab } from './ui.jsx';

const TABS = ['overview', 'verify', 'orgs', 'listings', 'requests', 'reports', 'leaderboard', 'inbox', 'content', 'audit'];
const all = async (q) => need(await q) || [];
/* SLA helper for no-certificate reviews (3-5 business days promised to the organisation). */
function addBusinessDays(d, n) {
  const x = new Date(d || Date.now());
  let added = 0;
  while (added < n) { x.setDate(x.getDate() + 1); if (x.getDay() !== 0 && x.getDay() !== 6) added++; }
  return x;
}

async function loadAdmin(uid) {
  const opt = async (q) => { const r = await q; return r.error ? [] : r.data || []; }; // features added in part 7
  const [reviews, overrides, settings, lbDonor, lbNgo, snap] = await Promise.all([
    opt(db.from('document_reviews').select('*').order('created_at', { ascending: false }).limit(300)),
    opt(db.from('leaderboard_overrides').select('*')),
    opt(db.from('app_settings').select('*')),
    opt(db.rpc('public_leaderboard', { p_kind: 'donor' })),
    opt(db.rpc('public_leaderboard', { p_kind: 'ngo' })),
    db.rpc('latest_landing').then((r) => (r.error ? null : r.data)),
  ]);
  const [orgs, docs, listings, requests, reports, contacts, faqs, testi, audit, profiles, notes] = await Promise.all([
    all(db.from('organizations').select('*').order('created_at', { ascending: false })),
    all(db.from('verification_documents').select('*').order('created_at', { ascending: false })),
    all(db.from('food_listings').select('*').order('created_at', { ascending: false })),
    all(db.from('food_requests').select('*').order('created_at', { ascending: false })),
    all(db.from('reports').select('*').order('created_at', { ascending: false })),
    all(db.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(100)),
    all(db.from('faqs').select('*').order('sort_order')),
    all(db.from('testimonials').select('*').order('created_at', { ascending: false })),
    all(db.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100)),
    all(db.from('profiles').select('id,full_name,role')),
    loadNotes(uid),
  ]);
  const orgById = Object.fromEntries(orgs.map((o) => [o.id, o]));
  const prof = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const pct = settings.find((x) => x.key === 'leaderboard_percent');
  return { orgs, docs, listings, requests, reports, contacts, faqs, testi, audit, notes, orgById, prof, reviews, overrides, lbDonor, lbNgo, snap, percent: pct ? Number(pct.value) : 25 };
}

function ReasonModal({ title, label, cta, required = true, onSubmit, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <AsyncForm onSubmit={async (fd) => {
        const v = String(fd.get('reason') || '').trim();
        if (required && !v) throw new Error('Please write a short reason.');
        await onSubmit(v);
        onClose();
      }}>
        {({ busy }) => (<>
          <Field label={label} wide><textarea name="reason" rows={3} maxLength={300} autoFocus /></Field>
          <div className="wide"><Btn type="submit" kind="danger" busy={busy}>{cta}</Btn></div>
        </>)}
      </AsyncForm>
    </Modal>
  );
}

const REC = { looks_valid: ['approved', 'Looks valid'], needs_review: ['pending', 'Needs a closer look'], likely_invalid: ['rejected', 'Likely invalid'] };
const GEN = { likely_genuine: 'Looks genuine', uncertain: 'Genuineness unclear', likely_fake: 'Looks fake or edited' };
function AIVerdict({ review }) {
  if (!review) return <span className="ai-chip wait"><FiCpu /> AI check pending</span>;
  const ok = review.recommendation === 'looks_valid' && review.genuine !== 'likely_fake';
  const bad = review.recommendation === 'likely_invalid' || review.genuine === 'likely_fake';
  return <span className={'ai-chip ' + (ok ? 'ok' : bad ? 'bad' : 'warn')}><FiCpu /> {ok ? 'AI verified' : bad ? 'AI flagged' : 'AI: check manually'}{review.confidence != null ? ` · ${review.confidence}/100` : ''}</span>;
}
function AIReview({ review }) {
  if (!review) return null;
  const [cls, label] = REC[review.recommendation] || ['', review.recommendation];
  const ex = review.extracted || {};
  const rows = [['Name', ex.organisation_name], ['Number', ex.registration_number], ['Type', ex.document_type && String(ex.document_type).replace(/_/g, ' ')],
    ['Issued by', ex.issuing_authority], ['Valid until', ex.expiry_date], ['Address', ex.address]].filter((r) => r[1]);
  return (
    <div className="ai-rev">
      <div className="ai-head"><FiCpu /><b>AI overview</b><Tag s={cls}>{label}</Tag>{review.genuine && <Tag s={review.genuine === 'likely_genuine' ? 'approved' : review.genuine === 'likely_fake' ? 'rejected' : 'pending'}>{GEN[review.genuine]}</Tag>}{review.confidence != null && <span className="ai-conf" title="Confidence"><i style={{ width: review.confidence + '%' }} />{review.confidence}/100</span>}</div>
      <p>{review.summary}</p>
      {rows.length > 0 && <dl className="ai-fields">{rows.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>}
      {(review.checks || []).length > 0 && <ul className="ai-checks">{review.checks.map((c, i) => <li key={i} className={c.result}><b>{c.check}</b> {String(c.detail || '').split(/(https?:\/\/[^\s]+)/g).map((t, j) => (/^https?:\/\//.test(t) ? <a key={j} href={t} target="_blank" rel="noopener noreferrer">{t.replace(/^https?:\/\//, '').split('/')[0]}</a> : t))}</li>)}</ul>}
      <small className="m">{review.model ? 'Model ' + review.model + ' · ' : ''}{fmtDT(review.created_at)} · AI never approves: you decide.</small>
    </div>
  );
}

export default function Admin({ me }) {
  const uid = me.user.id;
  const toast = useToast();
  const [tab, setTab] = useHashTab('overview', TABS);
  const { data, error, refresh, setData } = useLoader(() => loadAdmin(uid), [uid]);
  const [orgF, setOrgF] = useState('all');
  const [q, setQ] = useState('');
  const [lf, setLf] = useState('all');
  const [rf, setRf] = useState('all');
  const [modal, setModal] = useState(null);
  const [notesById, setNotes] = useState({});
  const [reopen, setReopen] = useState({});
  const [aiOpen, setAiOpen] = useState({});
  useEffect(() => subscribe(uid, refresh), [uid]); // eslint-disable-line

  if (error) return <div className="fatal"><h1>Couldn’t load the admin console</h1><p>{error.message}</p><button className="btn primary" onClick={refresh}>Try again</button></div>;
  if (!data) return <div className="boot"><Skeleton /></div>;
  const { orgs, docs, listings, requests, reports, contacts, faqs, testi, audit, notes, orgById, prof, reviews, overrides, lbDonor, lbNgo, snap, percent } = data;
  const latestFor = (pred) => reviews.find(pred) || null;
  const runAI = (path, body, msg) => async () => { await api(path, body); toast(msg); await refresh(); };
  const aiHint = apiReady() ? undefined : 'Connect the AnnSetu AI service (ANNSETU_API_URL) to enable this';
  const nm = (id) => orgById[id]?.name || '(removed)';
  const pend = orgs.filter((o) => o.verification === 'pending').sort((a, b) => (b.no_certificate ? 1 : 0) - (a.no_certificate ? 1 : 0));
  const openRep = reports.filter((r) => ['open', 'reviewing'].includes(r.status));
  const newMsgs = contacts.filter((c) => c.status === 'new');
  const done = requests.filter((r) => r.status === 'completed');
  const activeL = listings.filter((l) => l.status === 'active' && new Date(l.pickup_by) > new Date());
  const tabs = [
    { id: 'overview', label: 'Overview', icon: <FiHome /> },
    { id: 'verify', label: 'Verification', icon: <FiShield />, badge: pend.length || null },
    { id: 'orgs', label: 'Organisations', icon: <FiBriefcase /> },
    { id: 'listings', label: 'Listings', icon: <FiList /> },
    { id: 'requests', label: 'Requests', icon: <FiInbox /> },
    { id: 'reports', label: 'Reports', icon: <FiFlag />, badge: openRep.length || null },
    { id: 'leaderboard', label: 'Leaderboard', icon: <FiAward /> },
    { id: 'inbox', label: 'Inbox', icon: <FiMail />, badge: newMsgs.length || null },
    { id: 'content', label: 'Content', icon: <FiEdit3 /> },
    { id: 'audit', label: 'Audit log', icon: <FiClipboard /> },
  ];
  const titles = Object.fromEntries(tabs.map((t) => [t.id, t.label]));
  const readAll = async () => {
    if (!notes.some((n) => !n.read)) return;
    try { await markAllRead(uid); setData((d) => ({ ...d, notes: d.notes.map((n) => ({ ...n, read: true })) })); } catch (e) {}
  };
  const rpc = (name, args, msg) => async () => { need(await db.rpc(name, args)); toast(msg); await refresh(); };
  const viewDoc = async (d) => {
    const { data: s, error: e } = await db.storage.from('verification-docs').createSignedUrl(d.path, 300);
    if (e) throw e;
    window.open(s.signedUrl, '_blank', 'noopener');
  };

  const orgCard = (o, i, full) => {
    const od = docs.filter((d) => d.org_id === o.id);
    const owner = prof[o.owner_id];
    const note = notesById[o.id] || '';
    return (
      <Card key={o.id} i={i}>
        <div className="row"><div><h3>{o.name}</h3><span className="m">{o.kind === 'ngo' ? 'Receiver' : 'Donor'} · {o.org_type}{o.address ? ' · ' + o.address : ''}{owner?.full_name ? ' · contact: ' + owner.full_name : ''}{o.phone ? ' · ' + o.phone : ''}</span></div>
          <div className="chips"><Tag s={o.verification} />{o.suspended && <Tag s="rejected">suspended</Tag>}</div></div>
        {o.about && <p className="m" style={{ margin: '8px 0 0' }}>{o.about}</p>}
        {o.no_certificate && (
          <div className="nocert-admin">
            <b>No certificate: manual review requested</b>
            <span className="m">Requested {fmtD(o.no_certificate_requested_at)} · reply due by {fmtD(addBusinessDays(o.no_certificate_requested_at, 5))}{new Date() > addBusinessDays(o.no_certificate_requested_at, 5) ? ' · OVERDUE' : ''}</span>
            <p>{o.no_certificate_note}</p>
            <small className="m">Approving is allowed without an approved document for this organisation. Check the explanation and any “Other proof” files.</small>
            <AIReview review={latestFor((r) => r.org_id === o.id && r.kind === 'no_certificate')} />
            <div className="acts"><Btn size="sm" kind="ghost" disabled={!apiReady()} title={aiHint} onClick={runAI('/ai/review-no-cert', { org_id: o.id }, 'AI summary ready')}><FiCpu /> {latestFor((r) => r.org_id === o.id && r.kind === 'no_certificate') ? 'Re-run AI summary' : 'AI summary'}</Btn></div>
          </div>
        )}
        <div className="docs">
          {od.length ? od.map((d) => (
            <div key={d.id} className="doc">
              <FiEye /><div><b>{(DOC_TYPES.find((x) => x[0] === d.doc_type) || [0, d.doc_type])[1]}</b><small>{fmtD(d.created_at)}{d.reviewer_note ? ' · ' + d.reviewer_note : ''}</small></div>
              <Tag s={d.status} />
              <Btn size="sm" kind="ghost" onClick={() => viewDoc(d)}>Open</Btn>
              <AIVerdict review={latestFor((r) => r.document_id === d.id)} />
              {latestFor((r) => r.document_id === d.id)
                ? <Btn size="sm" kind="ghost" onClick={() => setAiOpen({ ...aiOpen, [d.id]: !aiOpen[d.id] })} aria-expanded={!!aiOpen[d.id]}><FiCpu /> {aiOpen[d.id] ? 'Hide AI overview' : 'AI overview'}</Btn>
                : <Btn size="sm" kind="ghost" disabled={!apiReady()} title={aiHint} onClick={runAI('/ai/review-document', { document_id: d.id }, 'AI check complete')}><FiCpu /> Run AI check</Btn>}
              {d.status !== 'approved' && <Btn size="sm" kind="ok" onClick={rpc('review_document', { p_doc: d.id, p_status: 'approved', p_note: null }, 'Document verified manually')}><FiCheck /> Verify manually</Btn>}
              {d.status !== 'rejected' && <Btn size="sm" kind="danger" onClick={() => setModal({ title: 'Reject document', label: 'Why is this document rejected?', cta: 'Reject document', run: async (r) => { need(await db.rpc('review_document', { p_doc: d.id, p_status: 'rejected', p_note: r })); toast('Document rejected'); await refresh(); } })}><FiX /> Reject</Btn>}
              {aiOpen[d.id] && <div className="doc-ai"><AIReview review={latestFor((r) => r.document_id === d.id)} />
                <Btn size="sm" kind="ghost" disabled={!apiReady()} title={aiHint} onClick={runAI('/ai/review-document', { document_id: d.id }, 'AI check complete')}><FiRefreshCw /> Re-check with AI</Btn></div>}
            </div>
          )) : <div className="m">No documents uploaded.</div>}
        </div>
        {o.verification_note && <div className="m" style={{ marginTop: 8 }}>Note: {o.verification_note}</div>}
        <div className="acts">
          {o.verification === 'rejected' && !reopen[o.id] && <><span className="m decided">Rejected. The organisation has been told why.</span>
            <Btn size="sm" kind="ghost" onClick={() => setReopen({ ...reopen, [o.id]: true })}>Reconsider</Btn></>}
          {(o.verification === 'pending' || (o.verification === 'rejected' && reopen[o.id])) && <><input className="noteinp" value={note} onChange={(e) => setNotes({ ...notesById, [o.id]: e.target.value })} placeholder="Note to the organisation (required to reject)" aria-label="Review note" />
            <Btn size="sm" kind="ok" onClick={async () => { need(await db.rpc('review_org', { p_org: o.id, p_approve: true, p_note: note.trim() || null })); toast('Organisation approved'); await refresh(); }}>Approve</Btn>
            <Btn size="sm" kind="danger" onClick={async () => { if (!note.trim()) throw new Error('Write a note explaining the rejection first.'); need(await db.rpc('review_org', { p_org: o.id, p_approve: false, p_note: note.trim() })); toast('Organisation rejected'); await refresh(); }}>Reject</Btn></>}
          {full && o.verification === 'approved' && !o.suspended && <Btn size="sm" kind="danger" onClick={() => setModal({ title: `Suspend ${o.name}`, label: 'Reason (shown to the organisation)', cta: 'Suspend account', run: async (r) => { need(await db.rpc('suspend_org', { p_org: o.id, p_suspend: true, p_reason: r })); toast('Account suspended. Open listings were withdrawn.'); await refresh(); } })}>Suspend</Btn>}
          {full && o.suspended && <Btn size="sm" kind="ok" onClick={rpc('suspend_org', { p_org: o.id, p_suspend: false, p_reason: null }, 'Account reinstated')}>Reinstate</Btn>}
        </div>
      </Card>
    );
  };

  const overview = (<>
    <Hero kicker="Admin console" title="Keeping AnnSetu trusted" text="Verify organisations, watch the platform and keep food moving safely to the people who need it."
      action={<Btn onClick={() => setTab('verify')}><FiShield /> Review verifications</Btn>} />
    <div className="grid">
      <Stat i={0} n={pend.length} label="Awaiting verification" icon={<FiShield />} />
      <Stat i={1} n={orgs.filter((o) => o.verification === 'approved').length} label="Verified organisations" icon={<FiUsers />} />
      <Stat i={2} n={activeL.length} label="Active listings" icon={<FiBox />} />
      <Stat i={3} n={done.length} label="Completed pickups" icon={<FiHeart />} />
      <Stat i={4} n={done.reduce((a, r) => a + r.quantity, 0)} label="Units delivered" icon={<FiTrendingUp />} />
      <Stat i={5} n={openRep.length} label="Open reports" icon={<FiAlertTriangle />} />
    </div>
    {pend.length > 0 && <Card className="row"><div><h3>{pend.length} organisation{pend.length > 1 ? 's' : ''} waiting</h3><span className="m">They can’t list or request food until verified.</span></div><Btn onClick={() => setTab('verify')}>Review now</Btn></Card>}
    {openRep.length > 0 && <Card className="row"><div><h3>{openRep.length} open report{openRep.length > 1 ? 's' : ''}</h3><span className="m">Look into complaints raised by donors and NGOs.</span></div><Btn onClick={() => setTab('reports')}>Open reports</Btn></Card>}
    {audit.length > 0 && <Card><h3>Recent decisions</h3>{audit.slice(0, 5).map((a) => <div key={a.id} className="ev"><span><b>{prof[a.admin_id]?.full_name || 'Admin'}</b> · {a.action.replace(/_/g, ' ')}{a.details?.note ? ': ' + a.details.note : ''}</span><small className="m">{fmtDT(a.created_at)}</small></div>)}</Card>}
  </>);

  const orgsList = orgs.filter((o) => (orgF === 'all' || (orgF === 'donors' && o.kind === 'donor') || (orgF === 'ngos' && o.kind === 'ngo') || (orgF === 'suspended' ? o.suspended : o.verification === orgF)) && (!q || (o.name + ' ' + o.org_type + ' ' + (o.address || '')).toLowerCase().includes(q.toLowerCase())));
  const listingsList = listings.filter((l) => lf === 'all' || l.status === lf);
  const reqList = requests.filter((r) => rf === 'all' || r.status === rf);

  return (
    <Shell roleLabel="Admin console" tabs={tabs} tab={tab} setTab={setTab} title={titles[tab]} org={null} user={me.user} notes={notes} onReadAll={readAll}>
      {tab === 'overview' && overview}

      {tab === 'verify' && (<><PageHead kicker="Trust & safety" title="Verification queue" sub="Approve only organisations whose documents you have checked." />
        {pend.length ? pend.map((o, i) => orgCard(o, i, false)) : <Empty>No organisations are waiting. You’re all caught up.</Empty>}</>)}

      {tab === 'orgs' && (<><PageHead kicker="Directory" title="Organisations" sub="Every registered donor and NGO." />
        <div className="fl">{['all', 'donors', 'ngos', 'pending', 'approved', 'rejected', 'suspended'].map((k) => <button key={k} className={'chip' + (orgF === k ? ' on' : '')} onClick={() => setOrgF(k)}>{k === 'ngos' ? 'NGOs' : k}</button>)}</div>
        <div className="fl"><input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, type, address" aria-label="Search organisations" /></div>
        {orgsList.length ? orgsList.map((o, i) => orgCard(o, i, true)) : <Empty>No organisations match.</Empty>}</>)}

      {tab === 'listings' && (<><PageHead kicker="Oversight" title="Listings" sub="Oversight of every food listing. You can withdraw unsafe ones." />
        <div className="fl">{['all', 'active', 'reserved', 'completed', 'expired', 'withdrawn'].map((k) => <button key={k} className={'chip' + (lf === k ? ' on' : '')} onClick={() => setLf(k)}>{k}</button>)}</div>
        {listingsList.length ? (
          <div className="tbl-wrap rise"><table className="tbl">
            <thead><tr><th scope="col">Food</th><th scope="col">Donor</th><th scope="col">Pickup by</th><th scope="col">Reserved</th><th scope="col">Status</th><th scope="col"><span className="sr">Actions</span></th></tr></thead>
            <tbody>{listingsList.map((l) => (
              <tr key={l.id}>
                <th scope="row" data-label="Food"><b>{l.title}</b><small>{l.category}</small></th>
                <td data-label="Donor">{nm(l.donor_org_id)}</td>
                <td data-label="Pickup by">{fmtDT(l.pickup_by)}</td>
                <td data-label="Reserved"><span className="num">{l.qty_reserved}</span> / {l.quantity} {l.unit}</td>
                <td data-label="Status"><Tag s={l.status} /></td>
                <td className="tbl-act">{['active', 'reserved'].includes(l.status) && <Btn size="sm" kind="danger" onClick={() => setModal({ title: 'Withdraw listing', label: 'Reason (sent to the donor and affected NGOs)', cta: 'Withdraw listing', run: async (r) => { need(await db.rpc('admin_withdraw_listing', { p_listing: l.id, p_reason: r })); toast('Listing withdrawn'); await refresh(); } })}>Withdraw</Btn>}</td>
              </tr>))}</tbody>
          </table></div>
        ) : <Empty>No listings to show.</Empty>}</>)}

      {tab === 'requests' && (<><PageHead kicker="Oversight" title="Requests" sub="Read-only view of every food request." />
        <div className="fl">{['all', 'pending', 'accepted', 'completed', 'rejected', 'cancelled'].map((k) => <button key={k} className={'chip' + (rf === k ? ' on' : '')} onClick={() => setRf(k)}>{k}</button>)}</div>
        {reqList.length ? (
          <div className="tbl-wrap rise"><table className="tbl">
            <thead><tr><th scope="col">Listing</th><th scope="col">Receiver</th><th scope="col">Donor</th><th scope="col">Qty</th><th scope="col">Sent</th><th scope="col">Status</th></tr></thead>
            <tbody>{reqList.map((r) => {
              const l = listings.find((x) => x.id === r.listing_id);
              return (
                <tr key={r.id}>
                  <th scope="row" data-label="Listing"><b>{l?.title || '(removed)'}</b>{r.rep_name ? <small>rep: {r.rep_name}</small> : null}</th>
                  <td data-label="Receiver">{nm(r.ngo_org_id)}</td>
                  <td data-label="Donor">{nm(l?.donor_org_id)}</td>
                  <td data-label="Qty"><span className="num">{r.quantity}</span> {l?.unit || ''}</td>
                  <td data-label="Sent">{fmtDT(r.created_at)}</td>
                  <td data-label="Status"><Tag s={r.status} /></td>
                </tr>);
            })}</tbody>
          </table></div>
        ) : <Empty>No requests to show.</Empty>}</>)}

      {tab === 'reports' && (<><PageHead kicker="Trust & safety" title="Reports" sub="Complaints raised by donors and receivers." />
        {reports.length ? reports.map((r, i) => (
          <Card key={r.id} i={i}>
            <div className="row"><div><h3>{r.reason.replace(/_/g, ' ')}</h3><span className="m">{nm(r.reporter_org)} reported {nm(r.reported_org)} · {fmtDT(r.created_at)}</span></div><Tag s={r.status} /></div>
            {r.details && <p className="m" style={{ margin: '8px 0 0' }}>{r.details}</p>}
            {r.admin_note && <p className="m">Admin note: {r.admin_note}</p>}
            {['open', 'reviewing'].includes(r.status) && (
              <div className="acts">
                {r.status === 'open' && <Btn size="sm" kind="ghost" onClick={rpc('resolve_report', { p_report: r.id, p_status: 'reviewing', p_note: null, p_suspend: false }, 'Marked as reviewing')}>Start review</Btn>}
                <Btn size="sm" kind="ok" onClick={() => setModal({ title: 'Resolve report', label: 'What did you decide? (sent to the reporter)', cta: 'Resolve', danger: false, run: async (n) => { need(await db.rpc('resolve_report', { p_report: r.id, p_status: 'resolved', p_note: n, p_suspend: false })); toast('Report resolved'); await refresh(); } })}>Resolve</Btn>
                <Btn size="sm" kind="danger" onClick={() => setModal({ title: `Resolve and suspend ${nm(r.reported_org)}`, label: 'Reason (shown to the suspended organisation)', cta: 'Resolve and suspend', run: async (n) => { need(await db.rpc('resolve_report', { p_report: r.id, p_status: 'resolved', p_note: n, p_suspend: true })); toast('Report resolved and account suspended'); await refresh(); } })}>Resolve + suspend</Btn>
                <Btn size="sm" kind="ghost" onClick={() => setModal({ title: `Warn ${nm(r.reported_org)}`, label: 'Warning message (sent to the reported organisation)', cta: 'Send warning', run: async (n) => { need(await db.rpc('admin_warn_org', { p_report: r.id, p_message: n })); toast('Warning sent'); await refresh(); } })}><FiAlertTriangle /> Warn</Btn>
                <Btn size="sm" kind="ghost" onClick={() => setModal({ title: 'Dismiss report', label: 'Why is it dismissed?', cta: 'Dismiss', run: async (n) => { need(await db.rpc('resolve_report', { p_report: r.id, p_status: 'dismissed', p_note: n, p_suspend: false })); toast('Report dismissed'); await refresh(); } })}>Dismiss</Btn>
              </div>)}
          </Card>)) : <Empty>No reports. Great news.</Empty>}</>)}

      {tab === 'leaderboard' && (<><PageHead kicker="Recognition" title="Leaderboard" sub={`Everyone sees the top ${percent}% of donors and receivers by food shared. Curate with a reason; every change is audited.`} />
        <Card className="lb-settings">
          <AsyncForm onSubmit={async (fd) => { const v = Math.round(+fd.get('pct')); if (!(v >= 5 && v <= 100)) throw new Error('Choose a percentage between 5 and 100.'); need(await db.rpc('admin_set_setting', { p_key: 'leaderboard_percent', p_value: v })); toast('Leaderboard size updated'); await refresh(); }}>
            {({ busy }) => (<><Field label="Show the top (%)" hint="Between 20 and 30 is recommended."><input name="pct" type="number" min="5" max="100" defaultValue={percent} /></Field><div><Btn type="submit" busy={busy}>Save</Btn></div></>)}
          </AsyncForm>
          <div className="lb-snap"><b>Landing page numbers</b><span className="m">{snap && snap.taken_at ? 'Last refreshed ' + fmtDT(snap.taken_at) + ' · refreshes automatically every Monday' : 'Not refreshed yet'}</span>
            <Btn size="sm" kind="ghost" onClick={rpc('admin_refresh_landing', {}, 'Landing numbers refreshed')}><FiRefreshCw /> Refresh now</Btn></div>
        </Card>
        {[['donor', 'Top donors', lbDonor], ['ngo', 'Top receivers', lbNgo]].map(([k, title, rows]) => (
          <Card key={k}><h3>{title}</h3>
            {rows.length ? rows.map((x) => (
              <div key={x.org_id} className="ck lb-row"><span className="lb-rank">#{x.rank}</span><span style={{ flex: 1 }}><b>{x.name}</b> <span className="m">{x.org_type} · {x.pickups} pickups · {x.units} units</span>{x.curated && <Tag s="pending">{x.pinned ? 'pinned' : 'curated'}</Tag>}</span>
                <Btn size="sm" kind="ghost" onClick={() => setModal({ title: `Pin ${x.name} to the top`, label: 'Reason (kept in the audit log)', cta: 'Pin', run: async (r) => { need(await db.rpc('admin_set_leaderboard', { p_org: x.org_id, p_action: 'pin', p_reason: r, p_boost: 0 })); toast('Pinned'); await refresh(); } })}><FiStar /> Pin</Btn>
                <Btn size="sm" kind="ghost" onClick={() => setModal({ title: `Hide ${x.name}`, label: 'Reason (kept in the audit log)', cta: 'Hide', run: async (r) => { need(await db.rpc('admin_set_leaderboard', { p_org: x.org_id, p_action: 'hide', p_reason: r, p_boost: 0 })); toast('Hidden from the leaderboard'); await refresh(); } })}><FiEyeOff /> Hide</Btn>
                {x.curated && <Btn size="sm" kind="ghost" onClick={rpc('admin_set_leaderboard', { p_org: x.org_id, p_action: 'clear', p_reason: 'cleared', p_boost: 0 }, 'Override removed')}>Clear</Btn>}
              </div>)) : <Empty>No completed pickups yet, so nobody is ranked.</Empty>}
          </Card>))}
        {overrides.filter((o) => o.action === 'hide').length > 0 && <Card><h3>Hidden organisations</h3>{overrides.filter((o) => o.action === 'hide').map((o) => (
          <div key={o.org_id} className="ck"><span style={{ flex: 1 }}><b>{nm(o.org_id)}</b> <span className="m">{o.reason} · by {prof[o.admin_id]?.full_name || 'Admin'}</span></span>
            <Btn size="sm" kind="ghost" onClick={rpc('admin_set_leaderboard', { p_org: o.org_id, p_action: 'clear', p_reason: 'unhidden', p_boost: 0 }, 'Back on the leaderboard')}>Unhide</Btn></div>))}</Card>}
      </>)}

      {tab === 'inbox' && (<><PageHead kicker="Website" title="Inbox" sub="Messages from the website contact form." />
        {contacts.length ? contacts.map((c, i) => (
          <Card key={c.id} i={i}>
            <div className="row"><div><h3>{c.subject || 'No subject'}</h3><span className="m">{c.name} · {c.email} · {fmtDT(c.created_at)}</span></div><Tag s={c.status === 'new' ? 'pending' : c.status === 'replied' ? 'approved' : ''}>{c.status}</Tag></div>
            <p style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>{c.message}</p>
            <div className="acts"><a className="btn ghost sm" href={`mailto:${c.email}?subject=${encodeURIComponent('Re: ' + (c.subject || 'AnnSetu'))}`}>Reply by email</a>
              {c.status !== 'read' && <Btn size="sm" kind="ghost" onClick={async () => { need(await db.from('contact_messages').update({ status: 'read' }).eq('id', c.id)); await refresh(); }}>Mark read</Btn>}
              {c.status !== 'replied' && <Btn size="sm" kind="ghost" onClick={async () => { need(await db.from('contact_messages').update({ status: 'replied' }).eq('id', c.id)); await refresh(); }}>Mark replied</Btn>}</div>
          </Card>)) : <Empty>No messages yet.</Empty>}</>)}

      {tab === 'content' && (<><PageHead kicker="Website" title="Website content" sub="FAQs and testimonials shown on the public site." />
        <Card><h3>FAQs</h3>
          {faqs.map((f) => (
            <div key={f.id} className="ck"><span style={{ flex: 1 }}><b>{f.question}</b><br /><span className="m">{f.answer}</span></span>
              <Tag s={f.published ? 'approved' : ''}>{f.published ? 'published' : 'hidden'}</Tag>
              <Btn size="sm" kind="ghost" onClick={async () => { need(await db.from('faqs').update({ published: !f.published }).eq('id', f.id)); await refresh(); }}>{f.published ? 'Hide' : 'Publish'}</Btn>
              <Btn size="sm" kind="danger" onClick={async () => { need(await db.from('faqs').delete().eq('id', f.id)); await refresh(); }}><FiTrash2 /></Btn></div>))}
          <AsyncForm className="mt" onSubmit={async (fd, form) => { const qn = String(fd.get('q')).trim(), an = String(fd.get('a')).trim(); if (!qn || !an) throw new Error('Add both a question and an answer.'); need(await db.from('faqs').insert({ question: qn, answer: an, sort_order: faqs.length + 1 })); form.reset(); toast('FAQ added'); await refresh(); }}>
            {({ busy }) => (<><Field label="Question" wide><input name="q" maxLength={200} /></Field><Field label="Answer" wide><textarea name="a" rows={2} maxLength={600} /></Field><div className="wide"><Btn type="submit" busy={busy}><FiPlus /> Add FAQ</Btn></div></>)}
          </AsyncForm></Card>
        <Card><h3>Testimonials</h3><p className="m">Only publish real quotes you have permission to use.</p>
          {testi.map((t) => (
            <div key={t.id} className="ck"><span style={{ flex: 1 }}>“{t.quote}”<br /><span className="m">{t.author_name}{t.author_role ? ', ' + t.author_role : ''}</span></span>
              <Tag s={t.published ? 'approved' : ''}>{t.published ? 'published' : 'draft'}</Tag>
              <Btn size="sm" kind="ghost" onClick={async () => { need(await db.from('testimonials').update({ published: !t.published }).eq('id', t.id)); await refresh(); }}>{t.published ? 'Unpublish' : 'Publish'}</Btn>
              <Btn size="sm" kind="danger" onClick={async () => { need(await db.from('testimonials').delete().eq('id', t.id)); await refresh(); }}><FiTrash2 /></Btn></div>))}
          <AsyncForm className="mt" onSubmit={async (fd, form) => { const qn = String(fd.get('quote')).trim(), a = String(fd.get('author')).trim(); if (!qn || !a) throw new Error('Add the quote and who said it.'); need(await db.from('testimonials').insert({ quote: qn, author_name: a, author_role: String(fd.get('role') || '').trim() || null })); form.reset(); toast('Saved as a draft'); await refresh(); }}>
            {({ busy }) => (<><Field label="Quote" wide><textarea name="quote" rows={2} maxLength={400} /></Field><Field label="Author"><input name="author" maxLength={80} /></Field><Field label="Role / organisation"><input name="role" maxLength={80} /></Field><div className="wide"><Btn type="submit" busy={busy}><FiPlus /> Add testimonial</Btn></div></>)}
          </AsyncForm></Card></>)}

      {tab === 'audit' && (<><PageHead kicker="Accountability" title="Audit log" sub="Every admin decision is recorded here." />
        {audit.length ? (
          <div className="tbl-wrap rise"><table className="tbl">
            <thead><tr><th scope="col">When</th><th scope="col">By</th><th scope="col">Action</th><th scope="col">Target</th><th scope="col">Note</th></tr></thead>
            <tbody>{audit.map((a) => (
              <tr key={a.id}>
                <td data-label="When" className="nowrap">{fmtDT(a.created_at)}</td>
                <td data-label="By"><b>{prof[a.admin_id]?.full_name || (a.admin_id ? 'Admin (name not set)' : 'System')}</b></td>
                <th scope="row" data-label="Action"><b className="cap1">{a.action.replace(/_/g, ' ')}</b></th>
                <td data-label="Target">{a.target_table || '—'}</td>
                <td data-label="Note">{a.details?.note || a.details?.reason || '—'}</td>
              </tr>))}</tbody>
          </table></div>
        ) : <Empty>No decisions yet.</Empty>}</>)}

      {modal && <ReasonModal title={modal.title} label={modal.label} cta={modal.cta} onSubmit={modal.run} onClose={() => setModal(null)} />}
    </Shell>
  );
}
