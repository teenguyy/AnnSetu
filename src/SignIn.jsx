import React, { useState, useEffect, useRef } from 'react';
import { FiEye, FiEyeOff, FiArrowLeft, FiCheck } from 'react-icons/fi';
import { db, ROUTES, SIGNIN, EMAIL_RE, errMsg } from './lib.js';
import { loadMe, need } from './data.js';
import { ThemeToggle } from './shell.jsx';
import { Logo } from './brand.jsx';
import { Btn, AsyncForm, Field, useToast } from './ui.jsx';

const SLIDES = [
  ['Good food deserves a second journey.', 'Restaurants, hotels and canteens share what they can’t serve, safely and in minutes.'],
  ['Find food close to your community.', 'NGOs discover fresh listings nearby and collect with their own representatives.'],
  ['A bridge between a meal and a mouth.', 'Verified organisations, code-confirmed pickups and transparent impact.'],
];

function Art() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 5600); return () => clearInterval(t); }, []);
  return (
    <section className="art" aria-label="About AnnSetu" data-dark>
      <Logo tone="reverse" />
      <div className="cap" aria-live="polite">{SLIDES.map((s, k) => <div key={k} className={k === i ? 'on' : ''} aria-hidden={k !== i}><h2>{s[0]}</h2><p>{s[1]}</p></div>)}</div>
      <svg className="scene" viewBox="0 0 520 220" aria-hidden="true">
        <path className="sc-arch" d="M30 190 Q260 -20 490 190" pathLength="1" />
        <path className="sc-deck" d="M0 150 H520" />
        {[90, 140, 190, 240, 290, 340, 390, 440].map((x) => { const t = (x - 30) / 460; return <path key={x} className="sc-h" d={`M${x} ${(190 - 420 * t * (1 - t)).toFixed(1)} V150`} />; })}
        <circle className="sc-n a" cx="30" cy="150" r="7" /><circle className="sc-n b" cx="490" cy="150" r="7" />
        <circle className="sc-m" r="5"><animateMotion dur="6s" repeatCount="indefinite" path="M30 150 H490" /></circle>
        <text x="30" y="182" className="sc-t">donor</text><text x="490" y="182" textAnchor="end" className="sc-t">community</text>
      </svg>
      <p className="art-note">verified · code-confirmed · real impact</p>
      <div className="dots" aria-hidden="true">{SLIDES.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
    </section>
  );
}

function PassField({ label, name, autoComplete, placeholder, meter, value, onChange }) {
  const [show, setShow] = useState(false);
  const v = value || '';
  let s = 0;
  if (v.length >= 8) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/\d/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v) && v.length >= 8) s++;
  return (
    <Field label={label}>
      <span className="pw">
        <input name={name} type={show ? 'text' : 'password'} autoComplete={autoComplete} placeholder={placeholder} value={value} onChange={onChange} />
        <button type="button" className="eye" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>{show ? <FiEyeOff /> : <FiEye />}</button>
      </span>
      {meter && <span className="str">{[0, 1, 2, 3].map((i) => <i key={i} className={i < s ? 's' + s : ''} />)}</span>}
    </Field>
  );
}

const GOOGLE = (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" /><path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.8-6.1z" /><path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2.1 1.4-4.7 2.3-7.7 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z" /></svg>
);

export default function SignIn() {
  const toast = useToast();
  const qs = new URLSearchParams(location.search);
  const [view, setView] = useState(qs.get('view') === 'register' ? 'register' : 'login'); // login | register | forgot | recovery | done
  const [role, setRole] = useState(qs.get('role') === 'ngo' || qs.get('role') === 'donor' ? qs.get('role') : '');
  const [pw, setPw] = useState('');
  const [done, setDone] = useState(null);
  const [checking, setChecking] = useState(true);
  const recovering = useRef(/type=recovery/.test(location.hash) || qs.get('type') === 'recovery');

  const route = async () => {
    const me = await loadMe();
    if (!me) return false;
    let r = me.profile?.role;
    // Google sign-in: apply the role chosen before the redirect, only when no organisation exists yet.
    let pick = null; try { pick = sessionStorage.getItem('annsetu_role_pick'); sessionStorage.removeItem('annsetu_role_pick'); } catch (e) {}
    if (pick && r !== pick && r !== 'admin') {
      const { error } = await db.rpc('set_my_role', { p_role: pick });
      if (!error) r = pick;
    }
    if (!r) throw new Error('Your profile isn’t ready yet. Please try again in a moment.');
    location.replace(ROUTES[r] || ROUTES.donor);
    return true;
  };

  useEffect(() => {
    let alive = true;
    const { data: sub } = db.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY' && alive) { recovering.current = true; setView('recovery'); setChecking(false); } });
    (async () => {
      try {
        if (recovering.current) { setView('recovery'); return; }
        await route();
      } catch (e) { toast(errMsg(e), 'bad'); }
      finally { if (alive) setChecking(false); }
    })();
    return () => { alive = false; sub?.subscription?.unsubscribe?.(); };
  }, []); // eslint-disable-line

  const titles = {
    login: ['Welcome back', 'Sign in to continue making a difference.'],
    register: ['Join AnnSetu', 'Create an account and help move food to people who need it.'],
    forgot: ['Reset password', 'We’ll email you a link to choose a new one.'],
    recovery: ['Choose a new password', 'Pick something strong you haven’t used before.'],
  };

  const login = async (fd) => {
    const email = String(fd.get('email')).trim(), password = String(fd.get('password'));
    if (!EMAIL_RE.test(email)) throw new Error('Enter a valid email address.');
    if (!password) throw new Error('Enter your password.');
    need(await db.auth.signInWithPassword({ email, password }));
    await route();
  };
  const register = async (fd) => {
    const name = String(fd.get('name')).trim(), email = String(fd.get('email')).trim(), password = pw;
    if (!role) throw new Error('Please choose how you are joining.');
    if (name.length < 2) throw new Error('Enter your name.');
    if (!EMAIL_RE.test(email)) throw new Error('Enter a valid email address.');
    if (password.length < 8) throw new Error('Use at least 8 characters for your password.');
    if (!fd.get('tc')) throw new Error('Please accept the terms to continue.');
    const r = need(await db.auth.signUp({ email, password, options: { data: { role, full_name: name }, emailRedirectTo: location.origin + location.pathname.replace(/[^/]*$/, '') + SIGNIN } }));
    if (r.session) { await route(); return; }
    if (r.user && r.user.identities && r.user.identities.length === 0) throw new Error('An account with this email already exists. Try signing in.');
    setDone({ t: 'Check your email', d: `We sent a confirmation link to ${email}.`, n: 'After confirming, sign in and complete your organisation profile. An admin will then verify it.' });
    setView('done');
  };
  const forgot = async (fd) => {
    const email = String(fd.get('email')).trim();
    if (!EMAIL_RE.test(email)) throw new Error('Enter a valid email address.');
    need(await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }));
    setDone({ t: 'Check your email', d: 'If that address has an account, a reset link is on its way.', n: 'Links expire after a short time for your safety.' });
    setView('done');
  };
  const recover = async () => {
    if (pw.length < 8) throw new Error('Use at least 8 characters.');
    need(await db.auth.updateUser({ password: pw }));
    toast('Password updated. Taking you to your dashboard…');
    history.replaceState(null, '', location.pathname);
    await route();
  };
  const google = async () => {
    try { if (role) sessionStorage.setItem('annsetu_role_pick', role); } catch (e) {}
    need(await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }));
  };

  const t = titles[view];
  return (
    <div className="auth">
      <Art />
      <section className="panel">
        <div className="authbar"><a className="lk back" href="index.html"><FiArrowLeft /> AnnSetu home</a><ThemeToggle /></div>
        <div className="wrap">
          {checking ? <div className="boot-dots"><i /><i /><i /></div> : view === 'done' ? (
            <div className="done rise">
              <div className="tick"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>
              <h1>{done.t}</h1><p className="sub">{done.d}</p><div className="note">{done.n}</div>
              <p className="fine"><button className="lk" onClick={() => setView('login')}><FiArrowLeft /> Back to sign in</button></p>
            </div>
          ) : (<>
            <span className="kick rise">{view === 'register' ? 'New account' : view === 'login' ? 'Sign in' : 'Account recovery'}</span><h1 key={view} className="rise">{t[0]}</h1><p className="sub rise" style={{ '--i': 1 }}>{t[1]}</p>
            {(view === 'login' || view === 'register') && (
              <div className={'tabs' + (view === 'register' ? ' reg' : '')} role="tablist"><i />
                <button role="tab" aria-selected={view === 'login'} className={view === 'login' ? 'on' : ''} onClick={() => setView('login')}>Sign in</button>
                <button role="tab" aria-selected={view === 'register'} className={view === 'register' ? 'on' : ''} onClick={() => setView('register')}>Create account</button>
              </div>
            )}
            {view === 'login' && (
              <AsyncForm onSubmit={login} className="v">
                {({ busy }) => (<>
                  <Field label="Email" wide><input name="email" type="email" autoComplete="email" placeholder="you@organisation.org" /></Field>
                  <Field label="Password" wide><PassWrap name="password" autoComplete="current-password" placeholder="Your password" /></Field>
                  <div className="row wide"><label className="ck2"><input type="checkbox" defaultChecked /> Keep me signed in</label><button type="button" className="lk" onClick={() => setView('forgot')}>Forgot password?</button></div>
                  <div className="wide"><Btn type="submit" busy={busy} className="full" arrow>Sign in</Btn></div>
                  <div className="or wide">or</div>
                  <div className="wide"><Btn kind="ghost" className="full" onClick={google}>{GOOGLE} Continue with Google</Btn></div>
                </>)}
              </AsyncForm>
            )}
            {view === 'register' && (
              <AsyncForm onSubmit={register} className="v">
                {({ busy }) => (<>
                  <div className="wide"><span className="lab">I am joining as</span>
                    <div className="roles">
                      <button type="button" className={"rolebtn" + (role === "donor" ? " on" : "")} onClick={() => setRole('donor')} aria-pressed={role === 'donor'}><i>01</i><b>Donor</b><span>Restaurant, hotel, canteen, event</span></button>
                      <button type="button" className={"rolebtn" + (role === "ngo" ? " on" : "")} onClick={() => setRole('ngo')} aria-pressed={role === 'ngo'}><i>02</i><b>Receiver</b><span>NGO, shelter, community kitchen</span></button>
                    </div></div>
                  <Field label="Full name" wide><input name="name" autoComplete="name" placeholder="Your name" /></Field>
                  <Field label="Email" wide><input name="email" type="email" autoComplete="email" placeholder="you@organisation.org" /></Field>
                  <div className="wide"><PassField label="Password" name="password" autoComplete="new-password" placeholder="At least 8 characters" meter value={pw} onChange={(e) => setPw(e.target.value)} /></div>
                  <label className="ck2 wide"><input type="checkbox" name="tc" /> <span>I agree to the Terms and Privacy Policy</span></label>
                  <div className="wide"><Btn type="submit" busy={busy} className="full" arrow>Create account</Btn></div>
                  <div className="note wide">Organisations are reviewed by an admin before they can list or request food.</div>
                  <div className="or wide">or</div>
                  <div className="wide"><Btn kind="ghost" className="full" onClick={google}>{GOOGLE} Sign up with Google</Btn></div>
                </>)}
              </AsyncForm>
            )}
            {view === 'forgot' && (
              <AsyncForm onSubmit={forgot} className="v">
                {({ busy }) => (<>
                  <Field label="Email" wide><input name="email" type="email" autoComplete="email" placeholder="you@organisation.org" /></Field>
                  <div className="wide"><Btn type="submit" busy={busy} className="full">Send reset link</Btn></div>
                  <p className="fine wide"><button type="button" className="lk" onClick={() => setView('login')}><FiArrowLeft /> Back to sign in</button></p>
                </>)}
              </AsyncForm>
            )}
            {view === 'recovery' && (
              <AsyncForm onSubmit={recover} className="v">
                {({ busy }) => (<>
                  <div className="wide"><PassField label="New password" name="password" autoComplete="new-password" placeholder="At least 8 characters" meter value={pw} onChange={(e) => setPw(e.target.value)} /></div>
                  <div className="wide"><Btn type="submit" busy={busy} className="full"><FiCheck /> Update password</Btn></div>
                </>)}
              </AsyncForm>
            )}
          </>)}
        </div>
        <p className="fine taglinep">Good food deserves a second journey.</p>
      </section>
    </div>
  );
}

function PassWrap({ name, autoComplete, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <span className="pw">
      <input name={name} type={show ? 'text' : 'password'} autoComplete={autoComplete} placeholder={placeholder} />
      <button type="button" className="eye" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>{show ? <FiEyeOff /> : <FiEye />}</button>
    </span>
  );
}
