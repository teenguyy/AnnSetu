import React from 'react';
import { createRoot } from 'react-dom/client';
import { configured, db, initTheme, ROUTES, SIGNIN } from './lib.js';
import { loadMe } from './data.js';
import { ToastProvider, Skeleton } from './ui.jsx';
import SignIn from './SignIn.jsx';
import Donor from './Donor.jsx';
import Receiver from './Receiver.jsx';
import Admin from './Admin.jsx';
import Rep from './Rep.jsx';
import Chatbot from './Chatbot.jsx';
import { initCursor } from './cursor.js';
import { Monogram } from './brand.jsx';

initTheme();
initCursor();
const page = document.documentElement.dataset.page; // signin | donor | ngo | admin | rep
const root = createRoot(document.getElementById('root'));

function Fatal({ title, text }) {
  return <div className="fatal"><Monogram size={64} /><h1>{title}</h1><p>{text}</p><a className="btn primary" href="index.html"><span>Back to home</span></a></div>;
}

function Guard({ role }) {
  const [state, setState] = React.useState({ s: 'load' });
  React.useEffect(() => {
    (async () => {
      try {
        const me = await loadMe();
        if (!me) { location.replace(SIGNIN); return; }
        const r = me.profile && me.profile.role;
        if (!r) { setState({ s: 'err', m: 'Your profile isn’t ready yet. Please sign in again.' }); return; }
        if (r !== role) { location.replace(ROUTES[r]); return; }
        setState({ s: 'ok', me });
      } catch (e) { setState({ s: 'err', m: e.message }); }
    })();
    const { data } = db.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.replace(SIGNIN); });
    return () => data?.subscription?.unsubscribe?.();
  }, []);
  if (state.s === 'load') return <div className="boot"><Skeleton /></div>;
  if (state.s === 'err') return <Fatal title="We couldn’t verify your account" text={state.m} />;
  const P = role === 'donor' ? Donor : role === 'ngo' ? Receiver : role === 'rep' ? Rep : Admin;
  return <P me={state.me} />;
}

root.render(
  <ToastProvider>
    {!configured ? <Fatal title="AnnSetu is temporarily unavailable" text="Secure backend configuration is missing. Check supabase-config.js and your internet connection." />
      : page === 'signin' ? <SignIn /> : <Guard role={page} />}
    {configured && <Chatbot />}
  </ToastProvider>
);
