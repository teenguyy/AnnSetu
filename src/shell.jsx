import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { FiSun, FiMoon, FiBell, FiLogOut, FiMenu, FiCheck, FiX, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';
import { db, ago, setTheme, SIGNIN } from './lib.js';
import { Avatar, Modal, Btn } from './ui.jsx';
import { Logo as BrandLogo } from './brand.jsx';

export function Logo({ light }) {
  return <BrandLogo tone={light ? 'reverse' : 'brand'} />;
}

export function ThemeToggle() {
  const [t, setT] = useState(document.documentElement.getAttribute('data-theme') || 'light');
  const flip = () => { const n = t === 'dark' ? 'light' : 'dark'; setTheme(n); setT(n); };
  return (
    <button className="ib" onClick={flip} aria-label={t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title="Theme">
      <span className="ibi" key={t}>{t === 'dark' ? <FiSun /> : <FiMoon />}</span>
    </button>
  );
}

function Bell({ notes, onReadAll }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const unread = notes.filter((n) => !n.read).length;
  useEffect(() => {
    if (!open) return undefined;
    const f = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); onReadAll(); } };
    const k = (e) => { if (e.key === 'Escape') { setOpen(false); onReadAll(); } };
    document.addEventListener('mousedown', f);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', f); document.removeEventListener('keydown', k); };
  }, [open]); // eslint-disable-line
  return (
    <div className="bw" ref={ref}>
      <button className="ib" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}
        onClick={() => { if (open) onReadAll(); setOpen(!open); }}>
        <FiBell />{unread ? <span className="bdot">{unread > 9 ? '9+' : unread}</span> : null}
      </button>
      {open && (
        <div className="dd" role="dialog" aria-label="Notifications">
          <div className="ddh"><b>Notifications</b><button className="lk" onClick={onReadAll}><FiCheck /> Mark all read</button></div>
          <div className="ddl">
            {notes.length ? notes.map((n) => (
              <div key={n.id} className={'ni' + (n.read ? '' : ' un')}>
                <b>{n.title}</b>{n.body ? <span>{n.body}</span> : null}
                <small>{ago(new Date(n.created_at).getTime())}</small>
              </div>
            )) : <div className="ni"><span className="m">You’re all caught up. Updates will appear here.</span></div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function Shell({ roleLabel, tabs, tab, setTab, title, org, user, notes, onReadAll, banner, children }) {
  const [menu, setMenu] = useState(false);
  const [askOut, setAskOut] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('annsetu_nav_collapsed') === '1'; } catch (e) { return false; } });
  const reduce = useReducedMotion();
  const toggleNav = () => setCollapsed((c) => { try { localStorage.setItem('annsetu_nav_collapsed', c ? '0' : '1'); } catch (e) {} return !c; });
  const signOut = async () => { await db.auth.signOut(); location.replace(SIGNIN); };
  const go = (id) => { setTab(id); setMenu(false); };
  useEffect(() => {
    if (!menu) return undefined;
    const k = (e) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [menu]);
  return (
    <div className={'shell' + (collapsed ? ' collapsed' : '')}>
      <a className="skip" href="#main">Skip to content</a>
      <aside data-dark className={'side' + (menu ? ' open' : '')} aria-label={roleLabel + ' navigation'}>
        <div className="sidetop">
          <Logo light />
          <button className="ib menu-x" aria-label="Close menu" onClick={() => setMenu(false)}><FiX /></button>
          <button className="ib nav-toggle" onClick={toggleNav} aria-label={collapsed ? 'Expand menu' : 'Collapse menu'} aria-pressed={collapsed} title={collapsed ? 'Expand menu' : 'Collapse menu'}>{collapsed ? <FiChevronsRight /> : <FiChevronsLeft />}</button>
        </div>
        <span className="siderole">{roleLabel}</span>
        <nav>
          {tabs.map((t) => (
            <button key={t.id} className={'nav' + (tab === t.id ? ' on' : '')} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined} disabled={t.disabled} title={t.disabled ? 'Complete your profile first' : collapsed ? t.label : undefined} aria-label={t.badge ? `${t.label}, ${t.badge} new` : t.label}>
              {tab === t.id && (
                <motion.span className="nav-ind" layoutId={'nav-ind-' + roleLabel} transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }} />
              )}
              <span className="ni-ic">{t.icon}</span><span className="nav-l">{t.label}</span>
              {t.badge ? <span className="badge">{t.badge}</span> : null}
            </button>
          ))}
        </nav>
        <div className="who">
          <Avatar name={org?.name || user.email} src={org?.logo} />
          <div className="whot"><b>{org?.name || (roleLabel === 'Admin console' ? 'Administrator' : 'Set up your profile')}</b><small>{user.email}</small></div>
        </div>
        <button className="nav signout" onClick={() => setAskOut(true)} title={collapsed ? 'Sign out' : undefined}><span className="ni-ic"><FiLogOut /></span><span className="nav-l">Sign out</span></button>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      <main id="main" tabIndex={-1}>
        <div className="ambient" aria-hidden="true"><i /><i /><i /><svg viewBox="0 0 1200 200" preserveAspectRatio="none"><path d="M0 120 C 200 60, 380 170, 600 110 S 1000 50, 1200 120" /></svg></div>
        <div className="tb">
          <button className="ib menu" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(true)}><FiMenu /></button>
          <div className="tbt">{title}</div>
          <div className="tbr"><ThemeToggle /><Bell notes={notes} onReadAll={onReadAll} /><Avatar name={org?.name || user.email} src={org?.logo} /></div>
        </div>
        {banner}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div className="view" key={tab}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={{ duration: reduce ? 0 : 0.28, ease: [0.2, 0.7, 0.1, 1] }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      {askOut && (
        <Modal title="Sign out of AnnSetu?" onClose={() => setAskOut(false)}>
          <p className="m">You’ll need to sign in again to manage listings, requests and pickups.</p>
          <div className="acts"><Btn kind="danger" onClick={signOut}>Sign out</Btn><Btn kind="ghost" onClick={() => setAskOut(false)}>Stay signed in</Btn></div>
        </Modal>
      )}
    </div>
  );
}

export function PageHead({ title, sub, action, kicker }) {
  return (
    <div className="top rise">
      <div>{kicker ? <span className="kick">{kicker}</span> : null}<h1>{title}</h1>{sub ? <p className="sub">{sub}</p> : null}</div>
      {action}
    </div>
  );
}

export function Hero({ kicker, title, text, action }) {
  return (
    <div className="hero rise" data-dark>
      <svg className="hero-route" viewBox="0 0 600 160" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-10 140 C 140 140, 180 30, 320 60 S 520 150, 610 20" pathLength="1" />
      </svg>
      <div className="hero-t"><small>{kicker}</small><h1>{title}</h1><p>{text}</p></div>
      {action}
    </div>
  );
}
