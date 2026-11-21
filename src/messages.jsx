import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiShield, FiPhone, FiArrowLeft, FiMessageCircle, FiHeart } from 'react-icons/fi';
import { db, CATEGORIES, uploadTo, toLocalInput, errMsg, ago } from './lib.js';
import { need, loadConversations, openConversation, loadConversationMessages, sendConversationMessage } from './data.js';
import { Btn, AsyncForm, Field, Empty, Modal, Skeleton, useToast } from './ui.jsx';
import { PageHead } from './shell.jsx';

const tel = (p) => 'tel:' + String(p).replace(/[^+\d]/g, '');
const time = (d) => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/* ---------- lasting donor <-> receiver conversations ---------- */
export function MessagesView({ meId, kind, openId, onOpened }) {
  const toast = useToast();
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [sel, setSel] = useState(openId || null);
  const load = async () => { try { setState(await loadConversations()); setError(null); } catch (e) { setError(e); } };
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);
  useEffect(() => { if (openId) { setSel(openId); load(); if (onOpened) onOpened(); } }, [openId]); // eslint-disable-line

  const start = async (orgId) => {
    if (!orgId) return;
    try { const id = await openConversation(orgId); await load(); setSel(id); } catch (e) { toast(errMsg(e), 'bad'); }
  };
  const convs = state?.convs || [];
  const talked = new Set(convs.map((c) => c.other_org_id));
  const fresh = (state?.partners || []).filter((p) => !talked.has(p.org_id));
  const current = convs.find((c) => c.id === sel);
  const other = kind === 'donor' ? 'receivers' : 'donors';

  return (<>
    <PageHead kicker="Messages" title="Messages" sub={`Private conversations with ${other}. They stay here, so you can ask for or offer food any time.`} />
    {error ? <Empty title="Couldn’t load messages">{errMsg(error)}</Empty> : !state ? <Skeleton /> : (
      <div className={'dm' + (current ? ' has-sel' : '')}>
        <aside className="dm-list" aria-label="Conversations">
          {fresh.length > 0 && (
            <label className="dm-new"><span className="lab">New conversation</span>
              <select value="" onChange={(e) => start(e.target.value)} aria-label={`Start a conversation with one of your ${other}`}>
                <option value="">Choose {kind === 'donor' ? 'a receiver' : 'a donor'}…</option>
                {fresh.map((p) => <option key={p.org_id} value={p.org_id}>{p.name}</option>)}
              </select></label>
          )}
          {!convs.length ? <Empty title="No conversations yet">{kind === 'donor'
            ? 'Open Community needs and tap “Message” on a need, or fulfil one. Receivers you have helped appear here too.'
            : 'When a donor pledges food for your need or messages you, the conversation appears here. You can also message donors you have received food from.'}</Empty>
            : convs.map((c) => (
              <button key={c.id} type="button" className={'dm-item' + (c.id === sel ? ' on' : '')} onClick={() => setSel(c.id)} aria-current={c.id === sel}>
                <span className="dm-av" aria-hidden="true">{(c.other_name || '?').slice(0, 1).toUpperCase()}</span>
                <span className="dm-txt"><b>{c.other_name}</b><span>{c.last_body ? (c.last_sender === meId ? 'You: ' : '') + c.last_body : 'No messages yet'}</span></span>
                <small>{ago(c.last_at)}</small>
              </button>
            ))}
        </aside>
        <section className="dm-thread" aria-label="Conversation">
          {current ? <Thread key={current.id} conv={current} meId={meId} onBack={() => setSel(null)} onSent={load} />
            : <div className="dm-empty"><FiMessageCircle aria-hidden="true" /><p>Choose a conversation.</p></div>}
        </section>
      </div>
    )}
  </>);
}

function Thread({ conv, meId, onBack, onSent }) {
  const toast = useToast();
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const box = useRef();
  const load = async () => { try { setMsgs(await loadConversationMessages(conv.id)); } catch (e) { toast(errMsg(e), 'bad'); } };
  useEffect(() => {
    load();
    let ch = null;
    try {
      ch = db.channel('conv-' + conv.id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_messages', filter: 'conversation_id=eq.' + conv.id }, load).subscribe();
    } catch (e) { /* realtime is optional */ }
    const poll = setInterval(load, 10000);
    return () => { clearInterval(poll); if (ch) db.removeChannel(ch); };
  }, [conv.id]); // eslint-disable-line
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs]);
  const send = async (e) => {
    e.preventDefault();
    const b = text.trim();
    if (!b) return;
    setText('');
    try { await sendConversationMessage(conv.id, b); await load(); if (onSent) onSent(); } catch (x) { setText(b); toast(errMsg(x), 'bad'); }
  };
  return (<>
    <header className="dm-head">
      <button type="button" className="dm-back" onClick={onBack} aria-label="Back to conversations"><FiArrowLeft /></button>
      <div><b>{conv.other_name}</b><span className="m"><FiShield aria-hidden="true" /> Only your two organisations can see this</span></div>
      {conv.other_phone && <a className="btn ghost sm" href={tel(conv.other_phone)}><FiPhone /> Call</a>}
    </header>
    <div className="chat dm-chat" ref={box}>
      {msgs === null ? <div className="m">Loading…</div> : msgs.length === 0 ? <div className="m center">No messages yet. Say hello to {conv.other_name}.</div> :
        msgs.map((m, i) => {
          const mine = m.sender_id === meId;
          const prev = msgs[i - 1];
          const grouped = prev && prev.sender_id === m.sender_id && new Date(m.created_at) - new Date(prev.created_at) < 120000;
          return <div key={m.id} className={'bub' + (mine ? ' me' : '') + (grouped ? ' grp' : '')}><p>{m.body}</p><small>{time(m.created_at)}</small></div>;
        })}
    </div>
    <form className="chat-f" onSubmit={send}>
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={`Message ${conv.other_name}`} aria-label="Message" />
      <Btn type="submit" disabled={!text.trim()}><FiSend /> Send</Btn>
    </form>
  </>);
}

/* ---------- donor fulfils one community need privately ---------- */
export function FulfilNeedModal({ need: n, uid, onClose, onDone }) {
  const toast = useToast();
  const submit = async (fd) => {
    const qty = Math.floor(+fd.get('qty'));
    if (!(qty >= 1)) throw new Error('Enter a quantity of at least 1.');
    const by = new Date(fd.get('by'));
    if (isNaN(by) || by < new Date(Date.now() + 15 * 6e4)) throw new Error('Pickup-by must be at least 15 minutes from now.');
    const photo = fd.get('photo');
    let photo_path = null;
    if (photo && photo.size) {
      if (photo.size > 2 * 1024 * 1024) throw new Error('Photo must be 2 MB or smaller.');
      if (!/^image\/(jpeg|png|webp)$/.test(photo.type)) throw new Error('Photo must be JPG, PNG or WebP.');
      photo_path = await uploadTo('listing-photos', uid, photo);
    }
    need(await db.rpc('fulfil_need', {
      p_need: n.id, p_quantity: qty, p_unit: fd.get('unit'), p_category: fd.get('cat'), p_pickup_by: by.toISOString(),
      p_notes: String(fd.get('notes') || '').trim() || null, p_photo: photo_path, p_message: String(fd.get('msg') || '').trim() || null,
    }));
    toast(`Pledged to ${n.ngo?.name || 'the receiver'}. Only they can see this food.`);
    if (onDone) await onDone();
  };
  return (
    <Modal title="Fulfil this need" onClose={onClose}>
      <p className="note"><FiHeart aria-hidden="true" /> <b>{n.ngo?.name || 'This receiver'}</b> asked for <b>{n.quantity} × {n.title}</b>. This food goes only to them. It is not listed for anyone else, and their pickup is confirmed automatically.</p>
      <AsyncForm onSubmit={submit} className="mt">
        {({ busy }) => (<>
          <Field label="Quantity you can give"><input name="qty" type="number" min="1" max="10000" defaultValue={n.quantity} required /></Field>
          <Field label="Unit"><select name="unit"><option>portions</option><option>kg</option><option>packs</option></select></Field>
          <Field label="Category"><select name="cat">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Collect by"><input name="by" type="datetime-local" defaultValue={toLocalInput(Date.now() + 3 * 36e5)} required /></Field>
          <Field label="Photo (optional, 2 MB max)" wide><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></Field>
          <Field label="Safety & storage notes" wide><textarea name="notes" rows={2} maxLength={300} placeholder="Allergens, veg/non-veg, storage temperature…" /></Field>
          <Field label={`Message to ${n.ngo?.name || 'the receiver'} (optional)`} wide><textarea name="msg" rows={2} maxLength={1000} placeholder="We’ll have it packed at the back gate. Ask for Ramesh." /></Field>
          <div className="wide row-l"><Btn type="submit" busy={busy}>Pledge food</Btn><Btn kind="ghost" onClick={onClose}>Cancel</Btn></div>
        </>)}
      </AsyncForm>
    </Modal>
  );
}
