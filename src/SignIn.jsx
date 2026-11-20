import React, { useState, useEffect, useRef } from 'react';
import { FiEye, FiEyeOff, FiArrowLeft, FiCheck } from 'react-icons/fi';
import { db, ROUTES, SIGNIN, EMAIL_RE, errMsg } from './lib.js';
import { loadMe, need } from './data.js';
import { ThemeToggle } from './shell.jsx';
import { Logo } from './brand.jsx';
import { Btn, AsyncForm, Field, useToast } from './ui.jsx';

const COPY = {
  signin: ['Welcome back to the bridge.', 'Every handover starts with a single sign-in.'],
  donor: ['Your surplus, someone’s next meal.', 'List what you can’t serve. Verified NGOs nearby collect it.'],
  ngo: ['Fresh food, close to your community.', 'Discover nearby surplus and send your own representative.'],
  choose: ['Join the AnnSetu bridge.', 'Choose how you are joining: as a donor or a receiver.'],
};

/* Bridge shared by every scene: deck + arch + hangers. */
function Bridge({ tone }) {
  return (
    <g className={'sc-bridge ' + tone}>
      <path className="sc-arch" d="M30 190 Q260 -20 490 190" pathLength="1" />
      <path className="sc-deck" d="M0 150 H520" />
      {[90, 140, 190, 240, 290, 340, 390, 440].map((x) => { const t = (x - 30) / 460; return <path key={x} className="sc-h" d={`M${x} ${(190 - 420 * t * (1 - t)).toFixed(1)} V150`} />; })}
    </g>
  );
}

/* Different animation for a new donor, a new receiver, and one shared animation for signing in. */
function Scene({ kind }) {
  if (kind === 'donor') return (
    <svg className="scene sc-donor" viewBox="0 0 520 220" aria-hidden="true" key="donor">
      <circle className="sc-glow" cx="90" cy="120" r="90" />
      <Bridge tone="warm" />
      {/* a crate of food glides onto the deck from the donor's kitchen */}
      <g className="sc-crate">
        <rect x="-26" y="-34" width="52" height="34" rx="6" fill="#F5D98B" stroke="#102F46" strokeWidth="3" />
        <path d="M-26 -22 H26" stroke="#102F46" strokeWidth="2" />
        <circle cx="-10" cy="-40" r="9" fill="#E87968" /><circle cx="8" cy="-42" r="8" fill="#FFE28A" stroke="#102F46" strokeWidth="2" /><circle cx="-1" cy="-46" r="6" fill="#82C5DF" />
      </g>
      <g className="sc-bowl" transform="translate(70 120)">
        <path className="sc-steam" d="M-8 -22 C -12 -28, -4 -32, -8 -38 M4 -22 C 0 -28, 8 -32, 4 -38" fill="none" stroke="#F4ECD8" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M-22 -12 L22 -12 C 21 2, 12 10, 0 10 C -12 10, -21 2, -22 -12 Z" fill="#FFE28A" stroke="#102F46" strokeWidth="2.6" />
      </g>
      <text x="30" y="182" className="sc-t">your kitchen</text><text x="490" y="182" textAnchor="end" className="sc-t">a verified NGO</text>
    </svg>
  );
  if (kind === 'ngo') return (
    <svg className="scene sc-ngo" viewBox="0 0 520 220" aria-hidden="true" key="ngo">
      <circle className="sc-glow cool" cx="430" cy="120" r="90" />
      <Bridge tone="cool" />
      {/* food arrives over the bridge into open hands on the community's bank */}
      <circle className="sc-m" r="7" fill="#FFE28A"><animateMotion dur="3.2s" repeatCount="indefinite" path="M40 140 Q 260 -10 450 120" /></circle>
      <g className="sc-hands" transform="translate(440 160)">
        <path d="M-40 0 C -36 -16, -22 -26, -6 -24 L 0 -10 C -14 -12, -26 -6, -30 6 Z" fill="#A8D9E9" />
        <path d="M40 0 C 36 -16, 22 -26, 6 -24 L 0 -10 C 14 -12, 26 -6, 30 6 Z" fill="#82C5DF" />
      </g>
      <g className="sc-people" fill="#A8D9E9">
        <g><circle cx="372" cy="128" r="7" /><path d="M362 150 C 362 138, 382 138, 382 150 Z" /></g>
        <g><circle cx="500" cy="124" r="7" /><path d="M490 146 C 490 134, 510 134, 510 146 Z" /></g>
      </g>
      <text x="30" y="182" className="sc-t">verified donors</text><text x="490" y="182" textAnchor="end" className="sc-t">your community</text>
    </svg>
  );
  return (
    <svg className={'scene sc-shared' + (kind === 'choose' ? ' quiet' : '')} viewBox="0 0 520 220" aria-hidden="true" key="shared">
      <Bridge tone="sun" />
      <circle className="sc-n a" cx="30" cy="150" r="7" /><circle className="sc-n b" cx="490" cy="150" r="7" />
      <circle className="sc-m" r="7" fill="#FFE28A" stroke="#102F46" strokeWidth="2.5"><animateMotion dur="4.5s" repeatCount="indefinite" path="M30 150 H490" /></circle>
      <text x="30" y="182" className="sc-t">donor</text><text x="490" y="182" textAnchor="end" className="sc-t">community</text>
    </svg>
  );
}

function Art({ view, role }) {
  const kind = view === 'register' ? (role === 'donor' ? 'donor' : role === 'ngo' || role === 'rep' ? 'ngo' : 'choose') : 'signin';
  const [title, text] = COPY[kind];
  return (
    <section className={'art art-' + kind} aria-label="About AnnSetu" data-dark>
      <Logo tone="reverse" size={64} tagline />
      <div className="cap" aria-live="polite"><div className="on" key={kind}><h2>{title}</h2><p>{text}</p></div></div>
      <Scene kind={kind} />
      <p className="art-note">verified · code-confirmed · real impact</p>
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
const APPLE = <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9s-2-.9-3.4-.9c-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8 2.2-1.3 3.1-2.5c1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 4.9c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z"/></svg>;
const MICROSOFT = <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#F25022" d="M2 2h9.5v9.5H2z"/><path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z"/><path fill="#00A4EF" d="M2 12.5h9.5V22H2z"/><path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z"/></svg>;
const PROVIDERS = [['google', 'Google', GOOGLE], ['apple', 'Apple', APPLE], ['azure', 'Microsoft', MICROSOFT]];

export default function SignIn() {
  const toast = useToast();
  const qs = new URLSearchParams(location.search);
  const [view, setView] = useState(qs.get('view') === 'register' ? 'register' : 'login'); // login | register | forgot | recovery | done
  const [role, setRole] = useState(['ngo', 'donor', 'rep'].includes(qs.get('role')) ? qs.get('role') : '');
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
    // Representatives: link this account to the NGO that added this email.
    if (r !== 'admin') {
      try { const { data } = await db.rpc('link_my_rep'); if (data && data.linked) r = 'rep'; } catch (e) {}
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
  const oauth = async (provider) => {
    try { if (role) sessionStorage.setItem('annsetu_role_pick', role); } catch (e) {}
    try {
      need(await db.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin + location.pathname, scopes: provider === 'azure' ? 'email' : undefined } }));
    } catch (e) {
      const name = PROVIDERS.find((x) => x[0] === provider)[1];
      toast(/not enabled|unsupported provider/i.test(errMsg(e)) ? `${name} sign-in isn’t switched on yet. Use email for now.` : errMsg(e), 'bad');
    }
  };
  const social = (verb) => (
    <div className="wide social">{PROVIDERS.map(([id, name, icon]) => (
      <Btn key={id} kind="ghost" className="full" onClick={() => oauth(id)}>{icon} {verb} {name}</Btn>
    ))}</div>
  );

  const t = titles[view];
  return (
    <div className="auth">
      <Art view={view} role={role} />
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
                  {social('Continue with')}
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
                      <button type="button" className={"rolebtn" + (role === "rep" ? " on" : "")} onClick={() => setRole('rep')} aria-pressed={role === 'rep'}><i>03</i><b>Representative</b><span>Collect food for an NGO</span></button>
                    </div>
                    {role === 'rep' && <p className="note rep-note">Use the same email your NGO saved for you in their Representatives list. Your account links to them automatically.</p>}</div>
                  <Field label="Full name" wide><input name="name" autoComplete="name" placeholder="Your name" /></Field>
                  <Field label="Email" wide><input name="email" type="email" autoComplete="email" placeholder="you@organisation.org" /></Field>
                  <div className="wide"><PassField label="Password" name="password" autoComplete="new-password" placeholder="At least 8 characters" meter value={pw} onChange={(e) => setPw(e.target.value)} /></div>
                  <label className="ck2 wide"><input type="checkbox" name="tc" /> <span>I agree to the Terms and Privacy Policy</span></label>
                  <div className="wide"><Btn type="submit" busy={busy} className="full" arrow>Create account</Btn></div>
                  <div className="note wide">Organisations are reviewed by an admin before they can list or request food.</div>
                  <div className="or wide">or</div>
                  {social('Sign up with')}
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
