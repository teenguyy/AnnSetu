import React, { useState, useEffect, useRef } from 'react';
import { FiEye, FiEyeOff, FiArrowLeft, FiCheck } from 'react-icons/fi';
import { db, ROUTES, SIGNIN, EMAIL_RE, errMsg } from './lib.js';
import { loadMe, need } from './data.js';
import { ThemeToggle } from './shell.jsx';
import { Btn, AsyncForm, Field, useToast } from './ui.jsx';

const SLIDES = [
  ['Turn surplus food into hope.', 'Restaurants, hotels and canteens share what they can’t serve, safely and in minutes.'],
  ['Find food close to your community.', 'NGOs discover fresh listings nearby and collect with their own representatives.'],
  ['A bridge between a meal and a mouth.', 'Verified organisations, OTP-confirmed pickups, and transparent impact.'],
];

function Art() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 5200); return () => clearInterval(t); }, []);
  const sparks = useRef(Array.from({ length: 16 }, (_, k) => ({ k, z: 3 + Math.random() * 6, l: Math.random() * 100, d: 9 + Math.random() * 10, o: -Math.random() * 14 }))).current;
  return (
    <section className="art" aria-label="AnnSetu illustration">
      <div className="brand"><i className="dot" />AnnSetu</div>
      {sparks.map((s) => <span key={s.k} className="spark" style={{ width: s.z, height: s.z, left: s.l + '%', animationDuration: s.d + 's', animationDelay: s.o + 's' }} />)}
      <svg className="scene" viewBox="0 0 600 560" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        <circle className="sunring" cx="490" cy="110" r="46" />
        <circle className="sun" cx="490" cy="110" r="42" />
        <g className="cloud"><ellipse cx="120" cy="90" rx="46" ry="15" /><ellipse cx="150" cy="78" rx="30" ry="14" /></g>
        <g className="cloud b"><ellipse cx="60" cy="170" rx="38" ry="12" /><ellipse cx="84" cy="160" rx="24" ry="11" /></g>
        <path className="hill1" d="M0 430 Q150 360 300 410 T600 390 V560 H0Z" />
        <path className="hill2" d="M0 470 Q180 420 320 460 T600 440 V560 H0Z" />
        <g><rect className="bld" x="50" y="330" width="120" height="110" rx="6" /><path className="roof a" d="M40 335 L110 285 L180 335Z" />
          <rect className="win" x="70" y="360" width="26" height="34" rx="3" /><rect className="win" x="118" y="360" width="26" height="34" rx="3" /><rect className="door" x="92" y="400" width="34" height="40" rx="3" /></g>
        <g><rect className="bld" x="430" y="340" width="120" height="100" rx="6" /><path className="roof b" d="M420 345 L490 295 L560 345Z" />
          <rect className="win" x="472" y="385" width="36" height="55" rx="3" /><path className="hrt" d="M490 372c-8-9-20 0-10 8l10 8 10-8c10-8-2-17-10-8z" /></g>
        <g>{[0, 1.5, 3].map((d, n) => <path key={n} className="heart" d="M490 330c-5-6-13 0-6 5l6 5 6-5c7-5-1-11-6-5z" style={{ animationDelay: d + 's', transform: `translateX(${(n - 1) * 16}px)` }} />)}</g>
        <path className="bridge" d="M175 425 Q300 280 425 425" />
        <path className="path" d="M175 425 Q300 280 425 425" />
        <g className="posts"><path d="M215 396V425M255 357V425M300 350V425M345 357V425M385 396V425" /></g>
        <g><g><ellipse rx="15" ry="8" className="f1" /><path d="M-15 0a15 15 0 0030 0z" className="f2" /><path className="steam" d="M-5-6q-3-6 0-10M5-6q-3-6 0-10" /><animateMotion dur="7s" repeatCount="indefinite" path="M175 395 Q300 250 425 395" /></g>
          <g><rect x="-14" y="-8" width="28" height="16" rx="8" className="f3" /><path d="M-6-8v16M3-8v16" className="f4" /><animateMotion dur="7s" begin="-2.3s" repeatCount="indefinite" path="M175 395 Q300 250 425 395" /></g>
          <g><circle r="10" className="f2" /><path d="M0-10q6-8 12-4q-6 6-12 4z" className="f5" /><animateMotion dur="7s" begin="-4.6s" repeatCount="indefinite" path="M175 395 Q300 250 425 395" /></g></g>
        <g className="bob"><text x="300" y="256" textAnchor="middle" className="sceneword">Ann Setu</text></g>
      </svg>
      <div className="cap">{SLIDES.map((s, k) => <div key={k} className={k === i ? 'on' : ''}><h2>{s[0]}</h2><p>{s[1]}</p></div>)}</div>
      <div className="dots">{SLIDES.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
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
        <div className="authbar"><ThemeToggle /></div>
        <div className="wrap">
          {checking ? <div className="boot-dots"><i /><i /><i /></div> : view === 'done' ? (
            <div className="done rise">
              <div className="tick"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>
              <h1>{done.t}</h1><p className="sub">{done.d}</p><div className="note">{done.n}</div>
              <p className="fine"><button className="lk" onClick={() => setView('login')}><FiArrowLeft /> Back to sign in</button></p>
            </div>
          ) : (<>
            <h1 key={view} className="rise">{t[0]}</h1><p className="sub rise" style={{ '--i': 1 }}>{t[1]}</p>
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
                  <div className="wide"><Btn type="submit" busy={busy} className="full">Sign in</Btn></div>
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
                      <button type="button" className={"rolebtn" + (role === "donor" ? " on" : "")} onClick={() => setRole('donor')} aria-pressed={role === 'donor'}><b>Donor</b><span>Restaurant, hotel, canteen, event</span></button>
                      <button type="button" className={"rolebtn" + (role === "ngo" ? " on" : "")} onClick={() => setRole('ngo')} aria-pressed={role === 'ngo'}><b>Receiver</b><span>NGO, shelter, community kitchen</span></button>
                    </div></div>
                  <Field label="Full name" wide><input name="name" autoComplete="name" placeholder="Your name" /></Field>
                  <Field label="Email" wide><input name="email" type="email" autoComplete="email" placeholder="you@organisation.org" /></Field>
                  <div className="wide"><PassField label="Password" name="password" autoComplete="new-password" placeholder="At least 8 characters" meter value={pw} onChange={(e) => setPw(e.target.value)} /></div>
                  <label className="ck2 wide"><input type="checkbox" name="tc" /> <span>I agree to the Terms and Privacy Policy</span></label>
                  <div className="wide"><Btn type="submit" busy={busy} className="full">Create account</Btn></div>
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
        <p className="fine taglinep">Save Food. Share Hope. Build Change.</p>
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
