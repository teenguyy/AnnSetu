import React, { useRef, useState, useEffect } from 'react';
import { FiArrowRight, FiCheck, FiChevronDown } from 'react-icons/fi';
import { gsap, useGsap, countUp } from '../anim.js';
import { db, configured, EMAIL_RE, errMsg, fmtD, ROUTES, publicUrl } from '../lib.js';
import { need, myOrg, loadDiscover } from '../data.js';
import { Btn, AsyncForm, Field, Arrow, useToast } from '../ui.jsx';
import { DiscoverBoard, LockedBoard } from '../discover.jsx';
import { Monogram, Wordmark } from '../brand.jsx';

const canAct = (org) => !!org && org.verification === 'approved' && !org.suspended;

/* 2 ─ Food waste and food insecurity ------------------------------------------------ */
const FACTS = [
  { n: '1.05', u: 'billion tonnes', t: 'of food was wasted worldwide in 2022, about one-fifth of all food available to consumers.', s: 'UNEP Food Waste Index Report 2024' },
  { n: '733', u: 'million people', t: 'faced hunger in 2023, roughly one in eleven people on the planet.', s: 'FAO et al., The State of Food Security and Nutrition in the World 2024' },
  { n: '55', u: 'kg per person', t: 'of food is wasted each year in an average Indian home.', s: 'UNEP Food Waste Index Report 2024' },
];
export function Story() {
  const ref = useRef(null);
  useGsap(ref, (reduced) => {
    if (reduced) return;
    gsap.to('.story-marq', { xPercent: -30, ease: 'none', scrollTrigger: { trigger: ref.current, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  return (
    <section className="story" id="story" ref={ref} aria-labelledby="story-h" data-dark>
      <div className="story-marq" aria-hidden="true">waste · hunger · waste · hunger · waste · hunger ·</div>
      <div className="wrap story-grid">
        <header className="story-head">
          <span className="kick">01 / The paradox</span>
          <h2 id="story-h" data-reveal="clip">Plenty on one side of the city. <em>Empty plates</em> on the other.</h2>
          <p className="annot" data-reveal>the food exists, the connection doesn’t</p>
        </header>
        <ol className="facts">
          {FACTS.map((f, i) => (
            <li key={f.n} className={'fact f' + i} data-reveal>
              <div className="fact-n"><b>{f.n}</b><span>{f.u}</span></div>
              <p>{f.t}</p>
              <cite>Source: {f.s}</cite>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* 3 ─ Mission ----------------------------------------------------------------------- */
export function Mission() {
  return (
    <section className="mission" id="mission" aria-labelledby="mission-h">
      <div className="wrap mission-grid">
        <div className="mission-l">
          <span className="kick">02 / Mission</span>
          <h2 id="mission-h" data-reveal="clip">A bridge, <em>not</em> a delivery fleet.</h2>
          <p className="lead" data-reveal>AnnSetu connects verified food donors with verified NGOs. We coordinate the match, the request and the handover. NGOs send their own representatives to collect, so every pickup stays local, accountable and human.</p>
        </div>
        <div className="etym" data-reveal aria-label="The name AnnSetu">
          <p><span lang="hi">अन्न</span> <b>Ann</b> <span>food, grain</span></p>
          <p className="plus" aria-hidden="true">+</p>
          <p><span lang="hi">सेतु</span> <b>Setu</b> <span>bridge</span></p>
          <Monogram size={120} draw />
        </div>
        <ul className="pillars" data-stagger>
          <li><span>i.</span><h3>Verified</h3><p>Every organisation uploads documents that an admin checks before it can list or request food.</p></li>
          <li><span>ii.</span><h3>Accountable</h3><p>Handovers are confirmed with a one-time code, so a pickup only counts when it really happened.</p></li>
          <li><span>iii.</span><h3>Local</h3><p>Receivers discover food near them and their own people collect it, inside the pickup window.</p></li>
        </ul>
      </div>
    </section>
  );
}

/* 4 ─ Animated donor-to-receiver journey -------------------------------------------- */
const STEPS = [
  ['Donor', 'Lists surplus food with quantity, safety notes and a pickup deadline.'],
  ['AnnSetu', 'Shows it only to verified, active receivers, nearest first.'],
  ['NGO', 'Requests a quantity and names a representative. The donor accepts and the food is reserved.'],
  ['Collection', 'The representative collects. The donor confirms the handover with a 4-digit code.'],
  ['Community', 'Meals reach people. Impact, badges and certificates are recorded automatically.'],
];
const ROUTE = 'M40 250 C 170 250, 190 80, 320 90 S 520 300, 620 250 S 790 60, 900 100 S 1060 260, 1160 200';
export function Journey() {
  const ref = useRef(null);
  const tlRef = useRef(null);
  const [active, setActive] = useState(0);
  const [pts, setPts] = useState([]);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    const p = ref.current && ref.current.querySelector('#jr-path');
    if (!p || !p.getTotalLength) return;
    const L = p.getTotalLength();
    setPts(STEPS.map((_, i) => { const q = p.getPointAtLength((L * i) / (STEPS.length - 1)); return [q.x, q.y]; }));
  }, []);
  // Auto-play: when the section comes into view the route draws itself, the hot-food marker travels it,
  // and the stops light up one by one, then it rests and loops. No scroll-pinning or scrubbing.
  useGsap(ref, (reduced) => {
    // Use the real length in px (pathLength scaling is ignored by some browsers, which made the line look finished early).
    const drawEl = ref.current && ref.current.querySelector('#jr-draw');
    const L = drawEl ? drawEl.getTotalLength() : 1000;
    gsap.set('#jr-draw', { strokeDasharray: `${L} ${L + 20}`, strokeDashoffset: L });
    if (reduced) { setActive(STEPS.length - 1); gsap.set('#jr-draw', { strokeDashoffset: 0 }); return undefined; }
    const n = STEPS.length - 1;
    const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 2.2,
      onRepeat: () => setActive(0),
      onUpdate: () => { const pr = Math.min(1, tl.time() / 7); setActive(Math.min(n, Math.floor(pr * n + 0.02))); } });
    tl.set('#jr-draw', { strokeDashoffset: L }, 0)
      .to('#jr-draw', { strokeDashoffset: 0, duration: 7, ease: 'none' }, 0)
      .fromTo('.jr-marker', { motionPath: { path: '#jr-path', align: '#jr-path', alignOrigin: [0.5, 0.5], autoRotate: false, end: 0 } },
        { motionPath: { path: '#jr-path', align: '#jr-path', alignOrigin: [0.5, 0.5], autoRotate: false, end: 1 }, duration: 7, ease: 'none' }, 0)
      .to({}, { duration: 1.2 });
    tlRef.current = tl;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && tlRef.current?.userPlay !== false) tl.play(); else tl.pause(); }, { threshold: 0.35 });
    io.observe(ref.current);
    return () => { io.disconnect(); tlRef.current = null; };
  });
  const toggle = () => {
    const tl = tlRef.current;
    if (!tl) return;
    if (playing) { tl.pause(); tl.userPlay = false; } else { tl.userPlay = true; tl.play(); }
    setPlaying(!playing);
  };
  const jump = (i) => {
    const tl = tlRef.current;
    setActive(i);
    if (tl) { tl.pause(); tl.userPlay = false; tl.time((7 * i) / (STEPS.length - 1)); setPlaying(false); }
  };
  return (
    <section className="journey" id="journey" ref={ref} aria-labelledby="journey-h" data-dark>
      <div className="jr-pin">
        <div className="wrap">
          <header className="jr-head">
            <span className="kick">03 / The journey</span>
            <h2 id="journey-h">Five stops from <em>surplus</em> to <em>served.</em></h2>
            <button type="button" className="jr-play" onClick={toggle} aria-pressed={!playing}>{playing ? 'Pause' : 'Play'} journey</button>
          </header>
          <div className="jr-stage">
            <svg className="jr-svg" viewBox="0 0 1200 340" aria-hidden="true">
              <path id="jr-path" d={ROUTE} className="jr-base" />
              <path id="jr-draw" d={ROUTE} className="jr-line" />
              {pts.map(([x, y], i) => (
                <g key={i} className={'jr-node' + (i <= active ? ' on' : '') + (i === active ? ' now' : '')} transform={`translate(${x} ${y})`}>
                  <circle r="22" className="halo" /><circle r="9" className="core" />
                  <text y={i % 2 ? 52 : -38} textAnchor="middle">{STEPS[i][0]}</text>
                </g>
              ))}
              {/* the food travelling the route: a steaming bowl */}
              <g className="jr-marker">
                <g className="jr-steam" fill="none" stroke="#F4ECD8" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M-7 -16 C -11 -21, -3 -24, -7 -30" /><path d="M0 -17 C -4 -22, 4 -25, 0 -32" /><path d="M7 -16 C 3 -21, 11 -24, 7 -30" />
                </g>
                <path d="M-15 -8 C -12 -14, 12 -14, 15 -8 Z" fill="#E87968" />
                <circle cx="-6" cy="-10" r="2.4" fill="#FFE28A" /><circle cx="4" cy="-11" r="2" fill="#F5D98B" />
                <path d="M-19 -8 L19 -8 C 18 4, 10 11, 0 11 C -10 11, -18 4, -19 -8 Z" fill="#FFE28A" stroke="#102F46" strokeWidth="2.4" strokeLinejoin="round" />
                <path d="M-8 11 L8 11 L6 15 L-6 15 Z" fill="#F5D98B" stroke="#102F46" strokeWidth="2" />
              </g>
            </svg>
          </div>
          <ol className="jr-steps">
            {STEPS.map(([t, d], i) => (
              <li key={t} className={i === active ? 'on' : i < active ? 'past' : ''} data-step={i}>
                <button type="button" className="jr-dot" onClick={() => jump(i)} aria-label={`Show step ${i + 1}: ${t}`} aria-current={i === active ? 'step' : undefined}>
                  <span className="jr-no">{String(i + 1).padStart(2, '0')}</span>
                </button>
                <div><h3>{t}</h3><p>{d}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* 5 ─ Food discovery (live Supabase data) ------------------------------------------- */
export function HomeDiscover({ session }) {
  const [state, setState] = useState({ s: 'load' });
  const load = async () => {
    try {
      if (!configured) { setState({ s: 'off' }); return; }
      const me = session;
      const role = me?.profile?.role;
      if (role === 'ngo') {
        const org = await myOrg(me.user.id);
        const reps = org ? need(await db.from('representatives').select('*').eq('org_id', org.id).order('name')) || [] : [];
        const listings = canAct(org) ? await loadDiscover({}) : [];
        setState({ s: 'ngo', org, reps, listings });
        return;
      }
      if (role) { setState({ s: 'role', role }); return; }
      // Signed out: an optional, privacy-safe public preview (sql/annsetu_schema_part5_public_preview.sql).
      const r = await db.rpc('public_listings_preview', { p_limit: 24 });
      if (!r.error && Array.isArray(r.data) && r.data.length) {
        setState({ s: 'preview', listings: r.data.map((l) => ({ ...l, photo: publicUrl('listing-photos', l.photo_path) })) });
      } else setState({ s: 'anon' });
    } catch (e) { setState({ s: 'err', e }); }
  };
  useEffect(() => { if (session !== undefined) load(); }, [session]); // eslint-disable-line
  const S = state.s;
  return (
    <section className="discover" id="discover" aria-labelledby="discover-h">
      <div className="wrap">
        <header className="disc-head">
          <span className="kick">04 / Food discovery</span>
          <h2 id="discover-h" data-reveal="clip">Food, looking for its <em>next table.</em></h2>
          <p className="lead" data-reveal>Live listings from verified donors. Search, filter, then drag what your community needs into the request tray.</p>
        </header>
        {S === 'load' && <div className="board-load" aria-busy="true"><span className="skel" /><span className="skel" /><span className="skel" /></div>}
        {S === 'ngo' && (canAct(state.org)
          ? <DiscoverBoard listings={state.listings} reps={state.reps} ok
            lockReason="" onRequested={load}
            intro={!state.reps.length ? <p className="board-warn">Add a pickup representative in your dashboard before sending requests. <a href="receiver.html#profile">Add one →</a></p> : null} />
          : <LockedBoard title="Your organisation isn’t verified yet" text="Once an admin approves your documents, live listings and the request tray open up here and in your dashboard."
            action={<a className="btn ink has-arrow" href="receiver.html#profile"><span>Open my profile</span><Arrow /></a>} />)}
        {S === 'preview' && <DiscoverBoard listings={state.listings} ok={false} lockReason="Sign in as a verified receiver to request food." lockHref="signin.html?view=register&role=ngo" />}
        {S === 'role' && <LockedBoard title={state.role === 'admin' ? 'You’re signed in as an admin' : 'You’re signed in as a donor'}
          text={state.role === 'admin' ? 'Every listing is available in the admin console.' : 'Food discovery is for verified receivers. Manage your own listings and incoming requests from your dashboard.'}
          action={<a className="btn ink has-arrow" href={ROUTES[state.role]}><span>Go to my dashboard</span><Arrow /></a>} />}
        {S === 'anon' && <LockedBoard title="Live listings are for verified receivers"
          text="To protect donors, food listings are only shown to NGOs and community organisations that an admin has verified. Sign in or register as a receiver to search, filter and drag food into your request tray."
          action={<div className="row-l"><a className="btn ink has-arrow" href="signin.html?role=ngo&view=register"><span>Register as receiver</span><Arrow /></a><a className="btn ghost" href="signin.html">Sign in</a></div>} />}
        {S === 'off' && <LockedBoard title="Discovery is offline" text="The secure backend isn’t configured on this deployment, so no listings can be shown." />}
        {S === 'err' && <LockedBoard title="We couldn’t load listings" text={errMsg(state.e)} action={<Btn kind="ghost" onClick={load}>Try again</Btn>} />}
      </div>
    </section>
  );
}

/* 6 ─ Donor and NGO experiences ----------------------------------------------------- */
const EXP = {
  donor: { k: 'For donors', h: 'Turn tonight’s surplus into tomorrow’s meal.', who: 'Restaurants · hotels · canteens · event organisers',
    steps: ['List food in under a minute, with a photo and safety notes', 'Accept or decline requests from verified NGOs', 'Confirm each handover with the receiver’s code', 'Earn badges and printable certificates'],
    cta: 'Register as donor', href: 'signin.html?role=donor&view=register' },
  ngo: { k: 'For NGOs & receivers', h: 'Find fresh food close to the people you serve.', who: 'NGOs · shelters · community kitchens',
    steps: ['Discover live listings nearby, nearest first', 'Request quantities and assign your own representative', 'Share live location during pickup, if you choose to', 'Publish your community’s needs for donors to see'],
    cta: 'Register as receiver', href: 'signin.html?role=ngo&view=register' },
};
export function Experiences() {
  const [side, setSide] = useState('donor');
  return (
    <section className="exp" id="experiences" aria-labelledby="exp-h">
      <h2 id="exp-h" className="sr">Donor and NGO experiences</h2>
      <div className="exp-split" data-active={side}>
        {Object.entries(EXP).map(([k, e]) => (
          <article key={k} data-dark={k === 'ngo' ? '' : undefined} className={'exp-p ' + k + (side === k ? ' on' : '')} onMouseEnter={() => setSide(k)} onFocus={() => setSide(k)}>
            <span className="kick">{k === 'donor' ? '05 / ' : ''}{e.k}</span>
            <h3>{e.h}</h3>
            <p className="who">{e.who}</p>
            <ol className="exp-steps">{e.steps.map((s, i) => <li key={s}><span>{String(i + 1).padStart(2, '0')}</span>{s}</li>)}</ol>
            <a className={'btn has-arrow ' + (k === 'donor' ? 'ink' : 'sun')} href={e.href}><span>{e.cta}</span><Arrow /></a>
            <span className="exp-big" aria-hidden="true">{k === 'donor' ? 'give' : 'receive'}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

/* 7 ─ Real impact statistics -------------------------------------------------------- */
export function Impact() {
  const ref = useRef(null);
  const [d, setD] = useState(undefined);
  useEffect(() => {
    if (!configured) { setD(null); return; }
    db.rpc('public_impact').then((r) => setD(!r.error && r.data && r.data[0] ? r.data[0] : null), () => setD(null));
  }, []);
  const has = d && (d.donations || d.donors || d.ngos);
  const [wk, setWk] = useState(null);
  useEffect(() => { if (configured) db.rpc('latest_landing').then((r) => { if (!r.error && r.data && r.data.taken_at) setWk(r.data); }, () => {}); }, []);
  useGsap(ref, (reduced) => {
    if (!has) return;
    ref.current.querySelectorAll('[data-count]').forEach((el) => countUp(el, el.getAttribute('data-count'), reduced));
  }, [has]);
  const items = has ? [[d.donations, 'Pickups completed', 'handovers confirmed by code'], [d.units, 'Units of food shared', 'portions, kg and packs'], [d.donors, 'Verified donors', 'kitchens giving'], [d.ngos, 'Verified receivers', 'NGOs collecting']] : [];
  return (
    <section className="impact" id="impact" ref={ref} aria-labelledby="impact-h" data-dark>
      <div className="wrap">
        <header className="imp-head">
          <span className="kick">06 / Impact</span>
          <h2 id="impact-h" data-reveal="clip">Real numbers. <em>Only.</em></h2>
          <p className="lead" data-reveal>Counted live from confirmed pickups and verified organisations in the AnnSetu database.</p>
        </header>
        {d === undefined ? <div className="imp-grid" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="imp skel" />)}</div>
          : has ? (
            <dl className="imp-grid">
              {items.map(([n, l, s], i) => (
                <div key={l} className={'imp i' + i}>
                  <dt>{l}<small>{s}</small></dt>
                  <dd data-count={Number(n) || 0}>{(Number(n) || 0).toLocaleString('en-IN')}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="imp-empty" data-reveal>
              <b>0</b>
              <p>No donations have been recorded yet. The first confirmed pickup will appear here. We never display invented figures.</p>
            </div>
          )}
        {wk && (
          <p className="imp-week" data-reveal>
            <b>This week</b> {Number(wk.week_pickups) || 0} pickups · {(Number(wk.week_units) || 0).toLocaleString('en-IN')} units shared · {Number(wk.listings_week) || 0} new listings
            {wk.top_donor ? <> · top donor <b>{wk.top_donor}</b></> : null}
            <small> · weekly snapshot, updated {new Date(wk.taken_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}</small>
          </p>
        )}
      </div>
    </section>
  );
}

/* Public leaderboard: top % of donors and receivers, visible to everyone ------------- */
export function Leaderboard() {
  const [k, setK] = useState('donor');
  const [rows, setRows] = useState({});
  useEffect(() => {
    if (!configured) { setRows({ donor: [], ngo: [] }); return; }
    ['donor', 'ngo'].forEach((kind) => db.rpc('public_leaderboard', { p_kind: kind }).then((r) => setRows((x) => ({ ...x, [kind]: r.error ? [] : r.data || [] })), () => setRows((x) => ({ ...x, [kind]: [] }))));
  }, []);
  const list = rows[k];
  return (
    <section className="lboard" id="leaderboard" aria-labelledby="lb-h">
      <div className="wrap">
        <header className="lb-head">
          <span className="kick">Leaderboard</span>
          <h2 id="lb-h" data-reveal="clip">The people <em>moving food</em></h2>
          <p className="lead" data-reveal>The most active verified donors and receivers, by food shared through confirmed pickups.</p>
          <div className="lb-tabs" role="tablist" aria-label="Leaderboard type">
            <button role="tab" aria-selected={k === 'donor'} className={k === 'donor' ? 'on' : ''} onClick={() => setK('donor')}>Top donors</button>
            <button role="tab" aria-selected={k === 'ngo'} className={k === 'ngo' ? 'on' : ''} onClick={() => setK('ngo')}>Top receivers</button>
          </div>
        </header>
        {list === undefined ? <div className="lb-list" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="lb-item skel" />)}</div>
          : list.length ? (
            <ol className="lb-list">
              {list.map((x) => (
                <li key={x.org_id} className={'lb-item' + (x.rank <= 3 ? ' top' + x.rank : '')}>
                  <span className="lb-rank" aria-label={'Rank ' + x.rank}>{x.rank}</span>
                  <span className="lb-name"><b>{x.name}</b><small>{x.org_type}{x.pinned ? ' · featured' : ''}</small></span>
                  <span className="lb-num"><b>{Number(x.units).toLocaleString('en-IN')}</b><small>units · {x.pickups} pickups</small></span>
                </li>
              ))}
            </ol>
          ) : <p className="lb-empty" data-reveal>The leaderboard appears after the first confirmed pickups. Rankings are never invented.</p>}
      </div>
    </section>
  );
}

/* About the app + download ------------------------------------------------------------ */
// The APK is served by this site from /download (see vercel.json for the download headers).
// One universal APK that runs on every Android phone (64-bit, 32-bit and x86):
// cd mobile && flutter build apk --release, then copy app-release.apk -> download/AnnSetu.apk.
// Keep the build number in mobile/pubspec.yaml above 3008 so updates install over every earlier build.
export const APP_RELEASE = { version: '1.0.7', size: '65 MB', minAndroid: '7.0', href: 'download/AnnSetu.apk' };

export function AppAbout() {
  const r = APP_RELEASE;
  return (
    <section className="appabout" id="app" aria-labelledby="app-h">
      <div className="wrap app-grid">
        <div>
          <span className="kick">The AnnSetu app</span>
          <h2 id="app-h" data-reveal="clip">AnnSetu, <em>in your pocket</em></h2>
          <p className="lead" data-reveal>The Android app for donors, NGOs and representatives. Sign in with the same account you use here, and everything stays in sync with the website.</p>
          <ul className="app-feats" data-reveal>
            <li><b>Post surplus food in seconds</b> with a photo, quantity and pickup window.</li>
            <li><b>Push notifications</b> when food is nearby, a request is accepted or your representative is on the way.</li>
            <li><b>Live tracking on the map</b>: representatives get directions, the pickup OTP and share their location.</li>
            <li><b>Private chats and calls</b> between donor, NGO and representative.</li>
            <li><b>AnnSetu assistant, dark mode</b> and your impact and certificates on the go.</li>
          </ul>
          <div className="app-dl" data-reveal>
            <a className="btn primary app-dl-btn" href={r.href} download="AnnSetu.apk">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.6 9.48l1.84-3.18a.38.38 0 0 0-.66-.38l-1.86 3.22a11.4 11.4 0 0 0-9.84 0L5.22 5.92a.38.38 0 0 0-.66.38L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" /></svg>
              <span>Download for Android</span>
            </a>
            <span className="app-meta">Version {r.version} · {r.size} · Android {r.minAndroid}+</span>
          </div>
          <details className="app-help" data-reveal>
            <summary>How to install</summary>
            <ol>
              <li>Tap <b>Download for Android</b> on your phone and open the file when it finishes.</li>
              <li>If Android asks, allow <b>Install unknown apps</b> for your browser. The app is not on Play Store yet.</li>
              <li>Tap <b>Install</b>, open AnnSetu and sign in with your website account.</li>
            </ol>
            <p className="app-meta">One download works on every Android phone, new or old.</p>
          </details>
        </div>
        <div className="app-phone">
          <div className="phone shot"><img src="assets/landing/app-screen.webp" width="390" height="844" loading="lazy" alt="The AnnSetu app welcome screen: one hand passing an apple to another" /></div>
          <figure className="app-qr">
            <img src="assets/landing/app-qr.svg" width="112" height="112" loading="lazy" alt="QR code to download the AnnSetu Android app" />
            <figcaption>On a computer? Scan to download on your phone.</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

/* 8 ─ Community stories (published testimonials) ------------------------------------ */
export function Stories() {
  const [list, setList] = useState(undefined);
  useEffect(() => {
    if (!configured) { setList([]); return; }
    db.from('testimonials').select('id,quote,author_name,author_role,created_at').eq('published', true).order('created_at', { ascending: false }).limit(12)
      .then((r) => setList(r.error ? [] : r.data || []), () => setList([]));
  }, []);
  const [lead, ...rest] = list || [];
  return (
    <section className="stories" id="stories" aria-labelledby="stories-h">
      <div className="wrap">
        <header className="st-head">
          <span className="kick">07 / Community stories</span>
          <h2 id="stories-h" data-reveal="clip">Told by the people <em>on the bridge.</em></h2>
        </header>
        {list === undefined ? <div className="skel st-skel" aria-busy="true" />
          : !list.length ? (
            <div className="st-empty" data-reveal>
              <p className="annot">this space is waiting for real voices</p>
              <p>Stories appear here once partners share them and an admin publishes them. We only show real quotes, used with permission.</p>
            </div>
          ) : (<>
            <figure className="st-lead" data-reveal>
              <blockquote>“{lead.quote}”</blockquote>
              <figcaption><b>{lead.author_name}</b>{lead.author_role ? <span>{lead.author_role}</span> : null}</figcaption>
            </figure>
            {rest.length > 0 && (
              <ul className="st-row" aria-label="More stories">
                {rest.map((t) => (
                  <li key={t.id}><blockquote>“{t.quote}”</blockquote><p><b>{t.author_name}</b>{t.author_role ? ` · ${t.author_role}` : ''}</p><small>{fmtD(t.created_at)}</small></li>
                ))}
              </ul>
            )}
          </>)}
      </div>
    </section>
  );
}

/* 9 ─ Join AnnSetu: roles, contact form (→ admin inbox), FAQs (← admin content) ------- */
export function Join({ session }) {
  const toast = useToast();
  const [sent, setSent] = useState(false);
  const [faqs, setFaqs] = useState([]);
  useEffect(() => {
    if (!configured) return;
    db.from('faqs').select('id,question,answer').eq('published', true).order('sort_order').then((r) => setFaqs(r.error ? [] : r.data || []), () => {});
  }, []);
  const role = session?.profile?.role;
  const send = async (fd, form) => {
    if (!configured) throw new Error('The secure backend isn’t configured on this deployment.');
    const v = { name: String(fd.get('name') || '').trim(), email: String(fd.get('email') || '').trim(), subject: String(fd.get('subject') || '').trim() || null, message: String(fd.get('message') || '').trim() };
    if (v.name.length < 2) throw new Error('Please tell us your name.');
    if (!EMAIL_RE.test(v.email)) throw new Error('Enter a valid email address so we can reply.');
    if (v.message.length < 5) throw new Error('Write a short message.');
    need(await db.from('contact_messages').insert(v));
    form.reset();
    setSent(true);
    toast('Message sent. The AnnSetu team will reply by email.');
  };
  return (
    <section className="join" id="join" aria-labelledby="join-h">
      <div className="wrap">
        <header className="join-head">
          <span className="kick">08 / Join AnnSetu</span>
          <h2 id="join-h" data-reveal="clip">Bring your kitchen. <em>Bring your community.</em></h2>
        </header>
        <div className="join-roles" data-stagger>
          {role ? (
            <a className="role-link" href={ROUTES[role]}><span className="kick">Signed in</span><b>Go to my dashboard</b><FiArrowRight aria-hidden="true" /></a>
          ) : (<>
            <a className="role-link" href="signin.html?role=donor&view=register"><span className="kick">I have surplus food</span><b>Join as a donor</b><FiArrowRight aria-hidden="true" /></a>
            <a className="role-link alt" href="signin.html?role=ngo&view=register"><span className="kick">I feed a community</span><b>Join as a receiver</b><FiArrowRight aria-hidden="true" /></a>
          </>)}
        </div>
        <div className="join-grid">
          <div className="contact">
            <h3>Write to the team</h3>
            {sent ? (
              <div className="sent" role="status"><FiCheck aria-hidden="true" /><div><b>Thank you, your message reached our inbox.</b><p>We reply by email, usually within two working days.</p><button className="lk" onClick={() => setSent(false)}>Send another message</button></div></div>
            ) : (
              <AsyncForm onSubmit={send}>
                {({ busy }) => (<>
                  <Field label="Your name"><input name="name" autoComplete="name" maxLength={80} required /></Field>
                  <Field label="Email"><input name="email" type="email" autoComplete="email" maxLength={120} required /></Field>
                  <Field label="Subject" wide><input name="subject" maxLength={120} placeholder="Partnership, verification, press…" /></Field>
                  <Field label="Message" wide><textarea name="message" rows={4} maxLength={2000} required /></Field>
                  <div className="wide"><Btn type="submit" busy={busy} arrow>Send message</Btn></div>
                </>)}
              </AsyncForm>
            )}
          </div>
          {faqs.length > 0 && (
            <div className="faq">
              <h3>Questions, answered</h3>
              {faqs.map((f) => (
                <details key={f.id}><summary>{f.question}<FiChevronDown aria-hidden="true" /></summary><p>{f.answer}</p></details>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* 10 ─ Minimal editorial footer (+ public certificate check) ------------------------- */
export function Footer() {
  const [res, setRes] = useState(null);
  const check = async (fd) => {
    const serial = String(fd.get('serial') || '').trim();
    if (serial.length < 4) throw new Error('Enter the serial printed on the certificate.');
    if (!configured) throw new Error('The secure backend isn’t configured on this deployment.');
    const rows = need(await db.rpc('verify_certificate', { p_serial: serial })) || [];
    setRes(rows[0] ? { ok: true, ...rows[0] } : { ok: false, serial });
  };
  return (
    <footer className="foot" data-dark>
      <div className="wrap">
        <div className="foot-card">
          <div className="foot-brand">
            <Monogram size={64} tone="reverse" />
            <p>Good food deserves a second journey.</p>
            <small>Connect · Share · Nourish</small>
          </div>
          <nav className="foot-cols" aria-label="Footer">
            <div><h3>Platform</h3><a href="#discover">Explore food</a><a href="#journey">How it works</a><a href="#impact">Impact</a><a href="#leaderboard">Leaderboard</a><a href="#app">The app</a></div>
            <div><h3>Get involved</h3><a href="signin.html?role=donor&view=register">Join as a donor</a><a href="signin.html?role=ngo&view=register">Join as a receiver</a><a href="signin.html">Sign in</a></div>
            <div><h3>Trust & support</h3><a href="#mission">About AnnSetu</a><a href="#join">Contact the team</a><a href="#join">FAQ</a></div>
          </nav>
          <div className="foot-cert">
            <h3>Verify a certificate</h3>
            <AsyncForm onSubmit={check} className="cert-f">
              {({ busy }) => (<>
                <label className="sr" htmlFor="cert-serial">Certificate serial</label>
                <input id="cert-serial" name="serial" placeholder="AS-XXXXXXXX" maxLength={40} autoComplete="off" />
                <Btn type="submit" kind="sun" size="sm" busy={busy}>Check</Btn>
              </>)}
            </AsyncForm>
            {res && <p className="cert-r" role="status">{res.ok ? <>Valid: <b>{res.title}</b>, issued to {res.org_name} on {fmtD(res.issued_at)}.</> : <>No certificate found for “{res.serial}”.</>}</p>}
          </div>
        </div>
        <div className="foot-mega" aria-hidden="true"><Wordmark /></div>
        <div className="foot-bot"><span>© {new Date().getFullYear()} AnnSetu</span><span>Real numbers only. No invented figures.</span><span>AnnSetu coordinates pickups; it does not run a delivery fleet.</span></div>
      </div>
    </footer>
  );
}
