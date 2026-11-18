import React, { useState, useEffect, useRef } from 'react';
import { FiSun, FiMoon, FiBell, FiLogOut, FiMenu, FiCheck } from 'react-icons/fi';
import { db, ago, setTheme, SIGNIN } from './lib.js';
import { Avatar } from './ui.jsx';

export function Logo({ light }) {
  return <a className={'logo' + (light ? ' light' : '')} href="index.html"><i className="dot" /><b className="lt">Ann<span>Setu</span></b></a>;
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
    if (!open) return;
    const f = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); onReadAll(); } };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
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
          {notes.length ? notes.map((n) => (
            <div key={n.id} className={'ni' + (n.read ? '' : ' un')}>
              <b>{n.title}</b>{n.body ? <span>{n.body}</span> : null}
              <small>{ago(new Date(n.created_at).getTime())}</small>
            </div>
          )) : <div className="ni"><span className="m">You’re all caught up. Updates will appear here.</span></div>}
        </div>
      )}
    </div>
  );
}

export function Shell({ roleLabel, tabs, tab, setTab, title, org, user, notes, onReadAll, banner, children }) {
  const [menu, setMenu] = useState(false);
  const signOut = async () => { await db.auth.signOut(); location.replace(SIGNIN); };
  const go = (id) => { setTab(id); setMenu(false); };
  return (
    <div className="shell">
      <aside className={'side' + (menu ? ' open' : '')} aria-label={roleLabel + ' navigation'}>
        <div className="sidetop"><Logo /><span className="siderole">{roleLabel}</span></div>
        <nav>
          {tabs.map((t) => (
            <button key={t.id} className={'nav' + (tab === t.id ? ' on' : '')} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
              <span className="ni-ic">{t.icon}</span><span>{t.label}</span>
              {t.badge ? <span className="badge">{t.badge}</span> : null}
            </button>
          ))}
        </nav>
        <div className="who">
          <Avatar name={org?.name || user.email} />
          <div className="whot"><b>{org?.name || (roleLabel === 'Admin console' ? 'Administrator' : 'Set up your profile')}</b><small>{user.email}</small></div>
        </div>
        <button className="nav signout" onClick={signOut}><span className="ni-ic"><FiLogOut /></span><span>Sign out</span></button>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      <main id="main" tabIndex={-1}>
        <div className="tb">
          <button className="ib menu" aria-label="Menu" onClick={() => setMenu(true)}><FiMenu /></button>
          <div className="tbt">{title}</div>
          <div className="tbr"><ThemeToggle /><Bell notes={notes} onReadAll={onReadAll} /><Avatar name={org?.name || user.email} src={org?.logo} /></div>
        </div>
        {banner}
        <div className="view" key={tab}>{children}</div>
      </main>
    </div>
  );
}

export function PageHead({ title, sub, action }) {
  return (
    <div className="top rise">
      <div><h1>{title}</h1>{sub ? <p className="sub">{sub}</p> : null}</div>
      {action}
    </div>
  );
}

export function Hero({ kicker, title, text, action }) {
  return (
    <div className="hero rise">
      <div><small>{kicker}</small><h1>{title}</h1><p>{text}</p></div>
      {action}
    </div>
  );
}
