import React, { useState, useEffect } from 'react';
import { FiHome, FiShield, FiBriefcase, FiList, FiInbox, FiFlag, FiMail, FiEdit3, FiClipboard, FiEye, FiCheck, FiX, FiUsers, FiBox, FiHeart, FiTrendingUp, FiAlertTriangle, FiTrash2, FiPlus } from 'react-icons/fi';
import { db, fmtDT, fmtD, tleft, DOC_TYPES } from './lib.js';
import { need, loadNotes, markAllRead, subscribe } from './data.js';
import { Shell, PageHead, Hero } from './shell.jsx';
import { Btn, AsyncForm, Field, Card, Tag, Empty, Stat, Skeleton, Modal, useToast, useLoader, useHashTab } from './ui.jsx';

const TABS = ['overview', 'verify', 'orgs', 'listings', 'requests', 'reports', 'inbox', 'content', 'audit'];
const all = async (q) => need(await q) || [];

async function loadAdmin(uid) {
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
  return { orgs, docs, listings, requests, reports, contacts, faqs, testi, audit, notes, orgById, prof };
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
  useEffect(() => subscribe(uid, refresh), [uid]); // eslint-disable-line

  if (error) return <div className="fatal"><h1>Couldn’t load the admin console</h1><p>{error.message}</p><button className="btn primary" onClick={refresh}>Try again</button></div>;
  if (!data) return <div className="boot"><Skeleton /></div>;
  const { orgs, docs, listings, requests, reports, contacts, faqs, testi, audit, notes, orgById, prof } = data;
  const nm = (id) => orgById[id]?.name || '(removed)';
  const pend = orgs.filter((o) => o.verification === 'pending');
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
        <div className="docs">
          {od.length ? od.map((d) => (
            <div key={d.id} className="doc">
              <FiEye /><div><b>{(DOC_TYPES.find((x) => x[0] === d.doc_type) || [0, d.doc_type])[1]}</b><small>{fmtD(d.created_at)}{d.reviewer_note ? ' · ' + d.reviewer_note : ''}</small></div>
              <Tag s={d.status} />
              <Btn size="sm" kind="ghost" onClick={() => viewDoc(d)}>Open</Btn>
              {d.status !== 'approved' && <Btn size="sm" kind="ok" onClick={rpc('review_document', { p_doc: d.id, p_status: 'approved', p_note: null }, 'Document approved')}><FiCheck /></Btn>}
              {d.status !== 'rejected' && <Btn size="sm" kind="danger" onClick={() => setModal({ title: 'Reject document', label: 'Why is this document rejected?', cta: 'Reject document', run: async (r) => { need(await db.rpc('review_document', { p_doc: d.id, p_status: 'rejected', p_note: r })); toast('Document rejected'); await refresh(); } })}><FiX /></Btn>}
            </div>
          )) : <div className="m">No documents uploaded.</div>}
        </div>
        {o.verification_note && <div className="m" style={{ marginTop: 8 }}>Note: {o.verification_note}</div>}
        <div className="acts">
          {o.verification !== 'approved' && <><input className="noteinp" value={note} onChange={(e) => setNotes({ ...notesById, [o.id]: e.target.value })} placeholder="Note to the organisation (required to reject)" aria-label="Review note" />
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
    {audit.length > 0 && <Card><h3>Recent decisions</h3>{audit.slice(0, 5).map((a) => <div key={a.id} className="ev"><span>{a.action.replace(/_/g, ' ')}{a.details?.note ? ': ' + a.details.note : ''}</span><small className="m">{fmtDT(a.created_at)}</small></div>)}</Card>}
  </>);

  const orgsList = orgs.filter((o) => (orgF === 'all' || (orgF === 'donors' && o.kind === 'donor') || (orgF === 'ngos' && o.kind === 'ngo') || (orgF === 'suspended' ? o.suspended : o.verification === orgF)) && (!q || (o.name + ' ' + o.org_type + ' ' + (o.address || '')).toLowerCase().includes(q.toLowerCase())));
  const listingsList = listings.filter((l) => lf === 'all' || l.status === lf);
  const reqList = requests.filter((r) => rf === 'all' || r.status === rf);

  return (
    <Shell roleLabel="Admin console" tabs={tabs} tab={tab} setTab={setTab} title={titles[tab]} org={null} user={me.user} notes={notes} onReadAll={readAll}>
      {tab === 'overview' && overview}

      {tab === 'verify' && (<><PageHead title="Verification queue" sub="Approve only organisations whose documents you have checked." />
        {pend.length ? pend.map((o, i) => orgCard(o, i, false)) : <Empty>No organisations are waiting. You’re all caught up.</Empty>}</>)}

      {tab === 'orgs' && (<><PageHead title="Organisations" sub="Every registered donor and NGO." />
        <div className="fl">{['all', 'donors', 'ngos', 'pending', 'approved', 'rejected', 'suspended'].map((k) => <button key={k} className={'chip' + (orgF === k ? ' on' : '')} onClick={() => setOrgF(k)}>{k === 'ngos' ? 'NGOs' : k}</button>)}</div>
        <div className="fl"><input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, type, address" aria-label="Search organisations" /></div>
        {orgsList.length ? orgsList.map((o, i) => orgCard(o, i, true)) : <Empty>No organisations match.</Empty>}</>)}

      {tab === 'listings' && (<><PageHead title="Listings" sub="Oversight of every food listing. You can withdraw unsafe ones." />
        <div className="fl">{['all', 'active', 'reserved', 'completed', 'expired', 'withdrawn'].map((k) => <button key={k} className={'chip' + (lf === k ? ' on' : '')} onClick={() => setLf(k)}>{k}</button>)}</div>
        {listingsList.length ? listingsList.map((l, i) => (
          <Card key={l.id} i={i}><div className="row"><div><h3>{l.title}</h3><span className="m">{nm(l.donor_org_id)} · pickup by {fmtDT(l.pickup_by)} · {l.qty_reserved} of {l.quantity} {l.unit} reserved</span></div><Tag s={l.status} /></div>
            {['active', 'reserved'].includes(l.status) && <div className="acts"><Btn size="sm" kind="danger" onClick={() => setModal({ title: 'Withdraw listing', label: 'Reason (sent to the donor and affected NGOs)', cta: 'Withdraw listing', run: async (r) => { need(await db.rpc('admin_withdraw_listing', { p_listing: l.id, p_reason: r })); toast('Listing withdrawn'); await refresh(); } })}>Withdraw</Btn></div>}
          </Card>)) : <Empty>No listings to show.</Empty>}</>)}

      {tab === 'requests' && (<><PageHead title="Requests" sub="Read-only view of every food request." />
        <div className="fl">{['all', 'pending', 'accepted', 'completed', 'rejected', 'cancelled'].map((k) => <button key={k} className={'chip' + (rf === k ? ' on' : '')} onClick={() => setRf(k)}>{k}</button>)}</div>
        {reqList.length ? reqList.map((r, i) => {
          const l = listings.find((x) => x.id === r.listing_id);
          return <Card key={r.id} i={i}><div className="row"><div><h3>{l?.title || '(removed)'}</h3><span className="m">{nm(r.ngo_org_id)} requested {r.quantity} · from {nm(l?.donor_org_id)} · {fmtDT(r.created_at)}</span></div><Tag s={r.status} /></div></Card>;
        }) : <Empty>No requests to show.</Empty>}</>)}

      {tab === 'reports' && (<><PageHead title="Reports" sub="Complaints raised by donors and receivers." />
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
                <Btn size="sm" kind="ghost" onClick={() => setModal({ title: 'Dismiss report', label: 'Why is it dismissed?', cta: 'Dismiss', run: async (n) => { need(await db.rpc('resolve_report', { p_report: r.id, p_status: 'dismissed', p_note: n, p_suspend: false })); toast('Report dismissed'); await refresh(); } })}>Dismiss</Btn>
              </div>)}
          </Card>)) : <Empty>No reports. Great news.</Empty>}</>)}

      {tab === 'inbox' && (<><PageHead title="Inbox" sub="Messages from the website contact form." />
        {contacts.length ? contacts.map((c, i) => (
          <Card key={c.id} i={i}>
            <div className="row"><div><h3>{c.subject || 'No subject'}</h3><span className="m">{c.name} · {c.email} · {fmtDT(c.created_at)}</span></div><Tag s={c.status === 'new' ? 'pending' : c.status === 'replied' ? 'approved' : ''}>{c.status}</Tag></div>
            <p style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>{c.message}</p>
            <div className="acts"><a className="btn ghost sm" href={`mailto:${c.email}?subject=${encodeURIComponent('Re: ' + (c.subject || 'AnnSetu'))}`}>Reply by email</a>
              {c.status !== 'read' && <Btn size="sm" kind="ghost" onClick={async () => { need(await db.from('contact_messages').update({ status: 'read' }).eq('id', c.id)); await refresh(); }}>Mark read</Btn>}
              {c.status !== 'replied' && <Btn size="sm" kind="ghost" onClick={async () => { need(await db.from('contact_messages').update({ status: 'replied' }).eq('id', c.id)); await refresh(); }}>Mark replied</Btn>}</div>
          </Card>)) : <Empty>No messages yet.</Empty>}</>)}

      {tab === 'content' && (<><PageHead title="Website content" sub="FAQs and testimonials shown on the public site." />
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

      {tab === 'audit' && (<><PageHead title="Audit log" sub="Every admin decision is recorded here." />
        {audit.length ? <Card>{audit.map((a) => <div key={a.id} className="ev"><span><b>{a.action.replace(/_/g, ' ')}</b>{a.target_table ? ' · ' + a.target_table : ''}{a.details?.note || a.details?.reason ? ': ' + (a.details.note || a.details.reason) : ''}</span><small className="m">{fmtDT(a.created_at)}</small></div>)}</Card> : <Empty>No decisions yet.</Empty>}</>)}

      {modal && <ReasonModal title={modal.title} label={modal.label} cta={modal.cta} onSubmit={modal.run} onClose={() => setModal(null)} />}
    </Shell>
  );
}
