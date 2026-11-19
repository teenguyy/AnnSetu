import React, { useEffect, useRef, useState } from 'react';
import { FiMessageCircle, FiX, FiSend } from 'react-icons/fi';
import { api, apiReady } from './api.js';

const STARTERS = [
  'How do I donate surplus food?',
  'We have no registration certificate. Can we receive food?',
  'How does the pickup OTP work?',
  'How do representatives get directions?',
];

/* Floating AnnSetu assistant. Works for visitors (observers), donors, receivers, representatives and admins.
   Answers come from the FastAPI backend (Gemini) with the platform guide + live FAQ. */
export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const box = useRef(null);
  const input = useRef(null);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs, busy]);
  useEffect(() => {
    if (!open) return undefined;
    setTimeout(() => input.current && input.current.focus(), 50);
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [open]);
  if (!apiReady()) return null; // hidden until the AI service URL is configured

  const send = async (q) => {
    const content = String(q || '').trim().slice(0, 1500);
    if (!content || busy) return;
    const next = [...msgs, { role: 'user', content }];
    setMsgs(next); setText(''); setErr(''); setBusy(true);
    try {
      const r = await api('/chat', { messages: next.slice(-12) });
      setMsgs([...next, { role: 'assistant', content: r.reply || 'Sorry, I don’t have an answer for that.' }]);
    } catch (e) {
      setErr(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className={'bot' + (open ? ' open' : '')}>
      {open && (
        <div className="bot-panel" role="dialog" aria-label="AnnSetu assistant">
          <header className="bot-head"><span className="bot-dot" aria-hidden="true" /><div><b>AnnSetu assistant</b><small>Answers about donating, receiving, pickups and verification</small></div>
            <button className="ib" onClick={() => setOpen(false)} aria-label="Close assistant"><FiX /></button></header>
          <div className="bot-msgs" ref={box} aria-live="polite">
            {!msgs.length && (
              <div className="bot-hello"><p>Hi! Ask me anything about AnnSetu.</p>
                <div className="bot-starters">{STARTERS.map((s) => <button key={s} type="button" onClick={() => send(s)}>{s}</button>)}</div></div>
            )}
            {msgs.map((m, i) => <div key={i} className={'bot-bub ' + m.role}>{m.content}</div>)}
            {busy && <div className="bot-bub assistant typing" aria-label="Assistant is typing"><i /><i /><i /></div>}
            {err && <div className="bot-err" role="alert">{err} <button type="button" className="lk" onClick={() => send(msgs.length ? msgs[msgs.length - 1].content : '')}>Retry</button></div>}
          </div>
          <form className="bot-form" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} placeholder="Type your question…" aria-label="Your question" />
            <button className="btn primary" type="submit" disabled={busy || !text.trim()} aria-label="Send"><FiSend /></button>
          </form>
          <small className="bot-foot">AI answers can be wrong. For account issues, use the Contact form.</small>
        </div>
      )}
      <button className="bot-fab" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Close assistant' : 'Ask the AnnSetu assistant'}>
        {open ? <FiX /> : <FiMessageCircle />}<span>{open ? '' : 'Ask AnnSetu'}</span>
      </button>
    </div>
  );
}
