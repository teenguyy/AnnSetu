import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { FiX, FiCheckCircle, FiAlertCircle, FiInfo } from 'react-icons/fi';
import { errMsg } from './lib.js';

/* ---------------- toasts ---------------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const toast = useCallback((msg, kind = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setList((l) => [...l.slice(-3), { id, msg, kind }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), kind === 'bad' ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={'toast ' + t.kind}>
            {t.kind === 'bad' ? <FiAlertCircle /> : t.kind === 'info' ? <FiInfo /> : <FiCheckCircle />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- buttons & forms ---------------- */
export function Btn({ kind = 'primary', size, busy, onClick, children, type = 'button', disabled, className = '', ...p }) {
  const toast = useToast();
  const [b, setB] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const click = async (e) => {
    if (!onClick) return;
    try {
      const r = onClick(e);
      if (r && r.then) { setB(true); await r; }
    } catch (x) { toast(errMsg(x), 'bad'); }
    finally { if (mounted.current) setB(false); }
  };
  const isBusy = busy || b;
  return (
    <button type={type} className={`btn ${kind} ${size || ''} ${className}`} disabled={disabled || isBusy} onClick={click} {...p}>
      {isBusy ? <span className="spin" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

export function AsyncForm({ onSubmit, children, className = '' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    setErr('');
    setBusy(true);
    try { await onSubmit(new FormData(f), f); }
    catch (x) { const m = errMsg(x); setErr(m); toast(m, 'bad'); }
    finally { setBusy(false); }
  };
  return (
    <form className={'form ' + className} onSubmit={submit} noValidate>
      {typeof children === 'function' ? children({ busy, err }) : children}
      {err ? <div className="err" role="alert">{err}</div> : null}
    </form>
  );
}

export function Field({ label, error, wide, children, hint }) {
  return (
    <label className={'field' + (wide ? ' wide' : '') + (error ? ' bad' : '')}>
      <span className="lab">{label}</span>
      {children}
      {hint ? <small className="m">{hint}</small> : null}
      {error ? <small className="er">{error}</small> : null}
    </label>
  );
}

/* ---------------- display bits ---------------- */
export const Card = ({ children, className = '', i = 0, ...p }) => (
  <div className={'card rise ' + className} style={{ '--i': i }} {...p}>{children}</div>
);
export const Tag = ({ s, children }) => <span className={'tag ' + (s || '')}>{children ?? s}</span>;
export const Empty = ({ children, icon }) => <div className="empty rise">{icon}<div>{children}</div></div>;
export const Bar = ({ pct }) => <div className="bar"><i style={{ width: Math.max(0, Math.min(100, pct)) + '%' }} /></div>;

export function useCountUp(n, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf, t0;
    const step = (t) => {
      t0 = t0 || t;
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(n * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n, ms]);
  return v;
}
export function Stat({ n, label, icon, i = 0 }) {
  const v = useCountUp(Number(n) || 0);
  return (
    <div className="stat rise" style={{ '--i': i }}>
      <div className="sico">{icon}</div>
      <b>{v}</b>
      <span>{label}</span>
    </div>
  );
}
export function Ring({ pct, size = 84 }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <svg className="ring" width={size} height={size} viewBox="0 0 84 84" aria-hidden="true">
      <circle className="rbg" cx="42" cy="42" r={r} />
      <circle className="rfg" cx="42" cy="42" r={r} style={{ strokeDasharray: c, strokeDashoffset: c - (c * pct) / 100 }} />
    </svg>
  );
}
export function Avatar({ name, src, size = 38 }) {
  const ini = ((name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('') || 'A').toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {src ? <img src={src} alt="" /> : ini}
    </span>
  );
}
export function Skeleton() {
  return (
    <div className="skel-wrap" aria-busy="true" aria-label="Loading">
      <div className="skel h" />
      <div className="skel-grid"><div className="skel" /><div className="skel" /><div className="skel" /><div className="skel" /></div>
      <div className="skel l" /><div className="skel l" />
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="mh"><h3>{title}</h3><button className="ib sm" aria-label="Close" onClick={onClose}><FiX /></button></div>
        <div className="mb">{children}</div>
      </div>
    </div>
  );
}

export function confetti() {
  const colors = ['#B89552', '#D4B26A', '#183A32', '#718879', '#A7654E', '#FFB020', '#34C48C'];
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < 46; i++) {
    const s = document.createElement('i');
    s.style.cssText = `left:${50 + (Math.random() - 0.5) * 20}%;background:${colors[i % colors.length]};--x:${(Math.random() - 0.5) * 90}vw;--r:${Math.random() * 720}deg;animation-delay:${Math.random() * 0.2}s;animation-duration:${1.4 + Math.random() * 1.2}s`;
    box.appendChild(s);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3200);
}

/* generic data loader with refresh + live subscriptions */
export function useLoader(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const ref = useRef(fn);
  ref.current = fn;
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const refresh = useCallback(async () => {
    try { const d = await ref.current(); if (alive.current) { setData(d); setError(null); } }
    catch (e) { if (alive.current) setError(e); }
  }, []);
  useEffect(() => { refresh(); }, deps); // eslint-disable-line
  return { data, error, refresh, setData };
}

export function useHashTab(def, allowed) {
  const get = () => { const h = location.hash.replace('#', ''); return allowed.includes(h) ? h : def; };
  const [tab, setT] = useState(get);
  useEffect(() => { const f = () => setT(get()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []); // eslint-disable-line
  const set = (t) => { location.hash = t; setT(t); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return [tab, set];
}
