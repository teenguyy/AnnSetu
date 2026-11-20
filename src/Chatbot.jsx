import React, { useEffect, useRef, useState } from 'react';
import { FiMessageCircle, FiX, FiSend, FiZap } from 'react-icons/fi';
import { api, apiReady } from './api.js';
import { db, configured } from './lib.js';

const STARTERS = [
  'How do I donate surplus food?',
  'We have no registration certificate. Can we receive food?',
  'How does the pickup OTP work?',
  'How do I track my representative?',
];

/* Instant answers for the most common questions (no waiting for the AI). */
const INSTANT = [
  [/(download|install|get|is there|have).*\b(app|apk)\b|\bapk\b|android app|mobile app|play ?store/i,
    'Yes, AnnSetu has an **Android app**.\n- Open the **Get the App** section on the home page and tap **Download for Android**\n- If asked, allow **Install unknown apps** for your browser\n- Sign in with the **same account** you use on this website\n- You get push notifications, live tracking and chats on your phone'],
  [/(how|where).*(donate|give|list)|donat(e|ion).*(food|surplus)|post.*listing/i,
    'Donating takes a few minutes:\n- **Sign up as a Donor** and complete your profile\n- Upload your **FSSAI licence** so an admin can verify you\n- Tap **Add listing**: food, quantity, pickup-by time and a photo\n- Accept a request and give the receiver’s representative the food after checking their **OTP**'],
  [/(no|without|don.?t have).*(certificate|registration)|certificate.*(no|not)/i,
    'Yes, you can still join.\n- Sign up as a **Receiver** and complete your profile\n- In Documents, tick **“We don’t have a registration certificate”**\n- Explain who you serve and since when\n- An admin reviews it within **3–5 business days**'],
  [/\botp\b|one.?time|handover code|pickup code/i,
    'The OTP keeps every handover safe.\n- When the donor accepts, the receiver gets a **4-digit OTP**\n- The representative shows it at pickup\n- The donor enters it to **confirm the handover**\n- Only then is the pickup marked collected'],
  [/track|where.*(representative|rep)|live location|eta|arriv/i,
    'Open **Pickups** in your dashboard.\n- You see each step: **assigned → on the way → reached → collected → delivered**\n- A live map shows the representative while they travel\n- The ETA updates automatically, and you can **call** or **message** them'],
  [/representative|rep\b|who collects|pickup person/i,
    'Representatives collect food for an NGO.\n- The NGO adds them under **Profile → Pickup representatives** with their email\n- They sign up as **Representative** with that same email\n- They then see directions, the OTP and the pickup steps'],
  [/verif|approv|document|fssai|pending/i,
    'Verification keeps AnnSetu safe.\n- Upload documents in **Profile → Documents** (FSSAI for food businesses; registration, 12A/80G or Darpan for NGOs)\n- Our AI checks them instantly and an **admin makes the final decision**\n- You’re notified as soon as you’re approved'],
  [/who can (receive|get)|receive food|ngo.*join|join.*ngo/i,
    'Receivers are verified NGOs, shelters, community kitchens and local community groups.\n- Sign up as **Receiver**, complete your profile and upload documents\n- After approval you can browse nearby food and request it'],
  [/deliver(y|ies)?\b.*(do you|provide)|do you deliver/i,
    'AnnSetu does **not** run delivery.\n- Each receiver sends **its own representative** to collect the food\n- You can follow them live on the map'],
  [/safe|hygien|expired|quality/i,
    'Food safety comes first.\n- Only list food that is **fresh, covered and within its safe time**\n- Listings disappear automatically after the pickup-by time\n- Receivers check the food at collection and can **report** problems'],
  [/certificate.*(earn|get|badge)|badge|milestone|leaderboard/i,
    'Every confirmed pickup counts.\n- Donors and receivers earn **badges and certificates** at milestones\n- The **top 25%** appear on the public leaderboard\n- Anyone can verify a certificate serial in the website footer'],
  [/^(hi|hello|hey|namaste|hii+)\b/i, 'Hi! I can help with donating, receiving, verification, pickups and tracking. What would you like to know?'],
];

const words = (t) => (String(t).toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter((w) => !['the', 'and', 'can', 'how', 'what', 'for', 'you', 'are', 'does'].includes(w));

/* Clean rendering: short paragraphs, "- " bullet lines, **bold** */
function Formatted({ text }) {
  const clean = String(text).replace(/^#+\s*/gm, '').replace(/\r/g, '').trim();
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
  const inline = (s, k) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (/^\*\*[^*]+\*\*$/.test(part) ? <b key={k + '-' + i}>{part.slice(2, -2)}</b> : part.replace(/\*/g, '')));
  const out = []; let list = [];
  const flush = () => { if (list.length) { out.push(<ul key={'u' + out.length}>{list}</ul>); list = []; } };
  lines.forEach((l, i) => {
    if (/^([-•*]|\d+[.)])\s+/.test(l)) list.push(<li key={i}>{inline(l.replace(/^([-•*]|\d+[.)])\s+/, ''), i)}</li>);
    else { flush(); out.push(<p key={i}>{inline(l, i)}</p>); }
  });
  flush();
  return <>{out}</>;
}

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [faqs, setFaqs] = useState([]);
  const box = useRef(null);
  const root = useRef(null);
  const input = useRef(null);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs, busy]);
  useEffect(() => {
    if (!open) return undefined;
    setTimeout(() => input.current && input.current.focus(), 50);
    if (!faqs.length && configured) db.from('faqs').select('question,answer').eq('published', true).then((r) => { if (!r.error) setFaqs(r.data || []); }, () => {});
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    const away = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false); }; // click outside closes
    addEventListener('keydown', k);
    document.addEventListener('pointerdown', away);
    return () => { removeEventListener('keydown', k); document.removeEventListener('pointerdown', away); };
  }, [open]); // eslint-disable-line
  if (!apiReady()) return null; // hidden until the AI service URL is configured

  const instant = (q) => {
    const hit = INSTANT.find(([re]) => re.test(q));
    if (hit) return hit[1];
    const qw = new Set(words(q));
    let best = null, score = 0;
    faqs.forEach((f) => { const fw = words(f.question); const s = fw.filter((w) => qw.has(w)).length / Math.max(2, fw.length); if (s > score) { score = s; best = f; } });
    return score >= 0.5 ? best.answer : null;
  };

  const send = async (q) => {
    const content = String(q || '').trim().slice(0, 1500);
    if (!content || busy) return;
    const next = [...msgs, { role: 'user', content }];
    setText(''); setErr('');
    const quick = instant(content);
    if (quick) { setMsgs([...next, { role: 'assistant', content: quick, instant: true }]); return; }
    setMsgs(next); setBusy(true);
    try {
      const r = await api('/chat', { messages: next.slice(-12).map(({ role, content: c }) => ({ role, content: c })) });
      setMsgs([...next, { role: 'assistant', content: r.reply || 'Sorry, I don’t have an answer for that.' }]);
    } catch (e) {
      setErr(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className={'bot' + (open ? ' open' : '')} ref={root}>
      {open && (
        <div className="bot-panel" role="dialog" aria-label="AnnSetu assistant">
          <header className="bot-head"><span className="bot-dot" aria-hidden="true" /><div><b>AnnSetu assistant</b><small>Donating, receiving, pickups and verification</small></div>
            <button className="ib" onClick={() => setOpen(false)} aria-label="Close assistant"><FiX /></button></header>
          <div className="bot-msgs" ref={box} aria-live="polite">
            {!msgs.length && (
              <div className="bot-hello"><p>Hi! Ask me anything about AnnSetu.</p>
                <div className="bot-starters">{STARTERS.map((s) => <button key={s} type="button" onClick={() => send(s)}>{s}</button>)}</div></div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={'bot-bub ' + m.role}>
                {m.role === 'assistant' ? <Formatted text={m.content} /> : m.content}
                {m.instant && <span className="bot-fast"><FiZap /> instant answer</span>}
              </div>
            ))}
            {busy && <div className="bot-bub assistant typing" aria-label="Assistant is typing"><i /><i /><i /></div>}
            {err && <div className="bot-err" role="alert">{err} <button type="button" className="lk" onClick={() => { const last = msgs[msgs.length - 1]; setMsgs(msgs.slice(0, -1)); send(last ? last.content : ''); }}>Retry</button></div>}
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
