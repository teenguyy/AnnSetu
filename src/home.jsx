/* Public homepage entry. */
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, useReducedMotion } from 'motion/react';
import { FiMenu, FiX } from 'react-icons/fi';
import { configured, initTheme, ROUTES } from './lib.js';
import { loadMe } from './data.js';
import { ToastProvider } from './ui.jsx';
import { Logo } from './brand.jsx';
import { initCursor } from './cursor.js';
import { useGsap, revealAll, ScrollTrigger } from './anim.js';
import Hero from './home/Hero.jsx';
import { Story, Mission, Journey, HomeDiscover, Experiences, Impact, Stories, Join, Footer } from './home/Sections.jsx';

initTheme();
initCursor();

const LINKS = [['mission', 'Mission'], ['journey', 'Journey'], ['discover', 'Discover'], ['impact', 'Impact'], ['stories', 'Stories']];

function Nav({ session }) {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('');
  const reduce = useReducedMotion();
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40);
    on();
    addEventListener('scroll', on, { passive: true });
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    LINKS.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    const hero = document.querySelector('.hero-x');
    const io2 = new IntersectionObserver(([e]) => { if (e.isIntersecting) setActive(''); }, { threshold: 0.5 });
    if (hero) io2.observe(hero);
    return () => { removeEventListener('scroll', on); io.disconnect(); io2.disconnect(); };
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (!open) return undefined;
    const k = (e) => e.key === 'Escape' && setOpen(false);
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [open]);
  const role = session?.profile?.role;
  const acct = role ? { href: ROUTES[role], t: 'My dashboard' } : { href: 'signin.html', t: 'Sign in' };
  return (
    <header className={'hnav' + (solid ? ' solid' : '') + (open ? ' open' : '')} data-dark>
      <a className="skip" href="#main">Skip to content</a>
      <div className="hnav-in">
        <Logo tone="reverse" href="#top" size={32} />
        <nav className="hnav-links" aria-label="Main">
          {LINKS.map(([id, t]) => (
            <a key={id} href={'#' + id} aria-current={active === id ? 'true' : undefined} onClick={() => setOpen(false)}>
              {t}
              {active === id && <motion.i className="hnav-ind" layoutId="hnav-ind" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }} />}
            </a>
          ))}
        </nav>
        <a className="hnav-acct" id="navsign" href={acct.href}>{acct.t}</a>
        <button className="hnav-menu" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="hnav-sheet" onClick={() => setOpen(!open)}>{open ? <FiX /> : <FiMenu />}</button>
      </div>
      <div className="hnav-sheet" id="hnav-sheet" hidden={!open}>
        {LINKS.map(([id, t], i) => <a key={id} href={'#' + id} onClick={() => setOpen(false)}><span>{String(i + 1).padStart(2, '0')}</span>{t}</a>)}
        <a href={acct.href} className="sheet-acct">{acct.t}</a>
      </div>
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
        <Hero donateHref={donateHref} />
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
