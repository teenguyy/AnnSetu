/* Public homepage entry. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, useReducedMotion } from 'motion/react';
import { FiMenu, FiX, FiSearch, FiArrowRight } from 'react-icons/fi';
import { configured, db, initTheme, ROUTES } from './lib.js';
import { loadMe } from './data.js';
import { ToastProvider } from './ui.jsx';
import { Logo } from './brand.jsx';
import { initCursor } from './cursor.js';
import { useGsap, revealAll, ScrollTrigger } from './anim.js';
import Hero from './home/Hero.jsx';
import { Story, Mission, Journey, HomeDiscover, Experiences, Impact, Stories, Join, Footer } from './home/Sections.jsx';

initTheme();
initCursor();

/* ------------------------------------------------------------------ site search (sections, pages, FAQs) */
function SearchOverlay({ open, onClose, session }) {
  const [q, setQ] = useState('');
  const [faqs, setFaqs] = useState([]);
  const [sel, setSel] = useState(0);
  const input = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    setQ(''); setSel(0);
    const t = setTimeout(() => input.current && input.current.focus(), 30);
    if (configured && !faqs.length) db.from('faqs').select('question,answer').eq('published', true).order('sort_order').then((r) => setFaqs(r.data || []), () => {});
    const k = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => { clearTimeout(t); removeEventListener('keydown', k); };
  }, [open]); // eslint-disable-line
  const role = session?.profile?.role;
  const index = useMemo(() => [
    { t: 'Explore food near you', d: 'Live listings from verified donors', href: '#discover' },
    { t: 'Donate surplus food', d: 'Register as a donor', href: 'signin.html?role=donor&view=register' },
    { t: 'Join as a receiver (NGO, shelter, community kitchen)', d: 'Register your organisation', href: 'signin.html?role=ngo&view=register' },
    { t: role ? 'My dashboard' : 'Sign in', d: role ? 'Open your dashboard' : 'Donor, receiver or admin', href: role ? ROUTES[role] : 'signin.html' },
    { t: 'How it works: five stops from surplus to served', d: 'The AnnSetu journey', href: '#journey' },
    { t: 'About AnnSetu', d: 'A bridge, not a delivery fleet', href: '#mission' },
    { t: 'Our impact', d: 'Real numbers from confirmed pickups', href: '#impact' },
    { t: 'Community stories', d: 'Voices from partners', href: '#stories' },
    { t: 'Contact the team', d: 'Write to us', href: '#join' },
    { t: 'Verify a certificate', d: 'Check a certificate serial', href: '#cert-serial' },
    ...faqs.map((f) => ({ t: f.question, d: f.answer, href: '#join', faq: true })),
  ], [faqs, role]);
  const term = q.trim().toLowerCase();
  const res = term ? index.filter((x) => (x.t + ' ' + x.d).toLowerCase().includes(term)).slice(0, 8) : index.slice(0, 6);
  const go = (r) => { onClose(); if (r.href.startsWith('#')) document.querySelector(r.href)?.scrollIntoView({ behavior: 'smooth' }); else location.href = r.href; };
  if (!open) return null;
  return (
    <div className="search-ov" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="search-box" role="dialog" aria-modal="true" aria-label="Search AnnSetu">
        <label className="search-in"><FiSearch aria-hidden="true" /><span className="sr">Search</span>
          <input ref={input} value={q} placeholder="Search food, pages and questions…" onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, res.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              if (e.key === 'Enter' && res[sel]) go(res[sel]);
            }} />
          <button type="button" className="search-x" onClick={onClose} aria-label="Close search"><FiX /></button>
        </label>
        <ul className="search-res" role="listbox">
          {res.length ? res.map((r, i) => (
            <li key={r.t} role="option" aria-selected={i === sel}>
              <button type="button" className={i === sel ? 'on' : ''} onMouseEnter={() => setSel(i)} onClick={() => go(r)}>
                <span><b>{r.t}</b><small>{r.faq ? 'FAQ · ' : ''}{r.d.length > 90 ? r.d.slice(0, 90) + '…' : r.d}</small></span><FiArrowRight aria-hidden="true" />
              </button>
            </li>
          )) : <li className="search-empty">No results. Try “food”, “donate” or “verify”.</li>}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ navigation */
function Nav({ session }) {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const [active, setActive] = useState('home');
  const reduce = useReducedMotion();
  const role = session?.profile?.role;
  const links = [
    ['home', 'Home', '#home'],
    ['discover', 'Explore Food', '#discover'],
    ['donate', 'Donate', role === 'donor' ? 'donor.html#listings' : 'signin.html?role=donor&view=register'],
    ['mission', 'About', '#mission'],
    ['impact', 'Impact', '#impact'],
    ['join', 'Contact', '#join'],
  ];
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40);
    on();
    addEventListener('scroll', on, { passive: true });
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); }), { rootMargin: '-45% 0px -50% 0px' });
    ['home', 'discover', 'mission', 'impact', 'join'].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    const k = (e) => { if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && !/input|textarea/i.test(document.activeElement?.tagName)) { e.preventDefault(); setSearch(true); } };
    addEventListener('keydown', k);
    return () => { removeEventListener('scroll', on); removeEventListener('keydown', k); io.disconnect(); };
  }, []);
  useEffect(() => {
    document.body.style.overflow = open || search ? 'hidden' : '';
    if (!open) return undefined;
    const k = (e) => e.key === 'Escape' && setOpen(false);
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [open, search]);
  const acct = role ? { href: ROUTES[role], t: 'My dashboard' } : { href: 'signin.html', t: 'Sign In' };
  return (
    <header className={'hnav' + (solid ? ' solid' : '') + (open ? ' open' : '')} data-dark>
      <a className="skip" href="#main">Skip to content</a>
      <div className="hnav-in">
        <Logo tone="reverse" href="#home" size={44} tagline />
        <nav className="hnav-links" aria-label="Main">
          {links.map(([id, t, href]) => (
            <a key={id} href={href} aria-current={active === id ? 'true' : undefined} onClick={() => setOpen(false)}>
              {t}
              {active === id && <motion.i className="hnav-ind" layoutId="hnav-ind" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }} />}
            </a>
          ))}
        </nav>
        <button className="hnav-search" type="button" onClick={() => setSearch(true)} aria-label="Search (press /)"><FiSearch /></button>
        <a className="hnav-acct" id="navsign" href={acct.href}>{acct.t}</a>
        <button className="hnav-menu" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="hnav-sheet" onClick={() => setOpen(!open)}>{open ? <FiX /> : <FiMenu />}</button>
      </div>
      <div className="hnav-sheet" id="hnav-sheet" hidden={!open}>
        {links.map(([id, t, href]) => <a key={id} href={href} onClick={() => setOpen(false)}>{t}</a>)}
        <button type="button" className="sheet-search" onClick={() => { setOpen(false); setSearch(true); }}><FiSearch /> Search</button>
        <a href={acct.href} className="sheet-acct">{acct.t}</a>
      </div>
      <SearchOverlay open={search} onClose={() => setSearch(false)} session={session} />
    </header>
  );
}

function Home() {
  const [session, setSession] = useState(undefined);
  const ref = useRef(null);
  useEffect(() => {
    if (!configured) { setSession(null); return; }
    loadMe().then((m) => setSession(m || null), () => setSession(null));
  }, []);
  useGsap(ref, (reduced) => revealAll(reduced));
  // Data-driven sections change height after loading; keep ScrollTrigger positions accurate.
  useEffect(() => { const t = setTimeout(() => ScrollTrigger.refresh(), 600); return () => clearTimeout(t); }, [session]);
  const donateHref = session?.profile?.role === 'donor' ? 'donor.html#listings' : 'signin.html?role=donor&view=register';
  return (
    <div className="home" ref={ref} id="top">
      <Nav session={session} />
      <main id="main" tabIndex={-1}>
        <div id="home"><Hero donateHref={donateHref} /></div>
        <Story />
        <Mission />
        <Journey />
        <HomeDiscover session={session} />
        <Experiences />
        <Impact />
        <Stories />
        <Join session={session} />
      </main>
      <Footer />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<ToastProvider><Home /></ToastProvider>);
