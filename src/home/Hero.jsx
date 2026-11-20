import React, { useEffect, useRef, useState } from 'react';
import { FaHandHoldingHeart, FaPeopleGroup, FaPersonWalkingArrowRight, FaStore, FaArrowRight, FaRegStar } from 'react-icons/fa6';
import { gsap, useGsap } from '../anim.js';
import { db, configured } from '../lib.js';

/* ------------------------------------------------------------------ hands + apple (original vector artwork)
   Two halftone-collage hands: the giver reaches down from the top-right holding an apple,
   the receiver reaches up from the bottom-left with an open palm and a thread bracelet. */
function HandDefs() {
  return (
    <defs>
      <linearGradient id="hgTop" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7A7A78" /><stop offset=".5" stopColor="#C2C1BD" /><stop offset="1" stopColor="#E6E4DF" /></linearGradient>
      <linearGradient id="hgBot" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#727270" /><stop offset=".5" stopColor="#B6B5B1" /><stop offset="1" stopColor="#E0DED9" /></linearGradient>
      <linearGradient id="hgArmT" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5E5E5C" /><stop offset="1" stopColor="#A9A8A4" /></linearGradient>
      <linearGradient id="hgArmB" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#5A5A58" /><stop offset="1" stopColor="#A3A29E" /></linearGradient>
      <radialGradient id="hgApple" cx=".36" cy=".32" r=".8"><stop offset="0" stopColor="#F7B07A" /><stop offset=".3" stopColor="#E86A36" /><stop offset=".7" stopColor="#BF3220" /><stop offset="1" stopColor="#701812" /></radialGradient>
      <pattern id="hgDots" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><circle cx="2" cy="2" r=".85" fill="#000" opacity=".16" /></pattern>
      <filter id="hgGrain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="7" result="n" />
        <feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .25 0" result="g" />
        <feComposite in="g" in2="SourceGraphic" operator="in" result="gi" />
        <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="gi" /></feMerge>
      </filter>
      <filter id="hgSoft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#06121C" floodOpacity=".5" /></filter>
    </defs>
  );
}

export function HeroHands() {
  return (
    <svg className="hands" viewBox="0 0 600 640" role="img" aria-label="One hand passes an apple to another, open hand">
      <HandDefs />
      {/* sparkle + dotted path guiding the eye to the apple */}
      <g className="hd-path">
        <path d="M70 250 C 120 120, 260 80, 360 150" fill="none" stroke="#FFE28A" strokeWidth="1.6" strokeDasharray="2 9" strokeLinecap="round" opacity=".75" />
        <circle className="hd-dot" cx="0" cy="0" r="4" fill="#FFE28A" />
        <g className="hd-star" transform="translate(70 250)">
          <circle r="16" fill="#FFE28A" opacity=".16" />
          <path d="M0 -22 L3 -3 L22 0 L3 3 L0 22 L-3 3 L-22 0 L-3 -3 Z" fill="#FFE28A" />
        </g>
      </g>
      <path id="hdDotPath" d="M70 250 C 120 120, 260 80, 360 150" fill="none" stroke="none" />

      {/* real hands from the AnnSetu reference artwork (cut out, transparent); sleeve ends fade out */}
      <defs>
        <linearGradient id="fadeL" x1="0" x2="1" y1="0" y2="0"><stop offset=".14" stopColor="#fff" stopOpacity="0" /><stop offset=".42" stopColor="#fff" stopOpacity="1" /></linearGradient>
        <linearGradient id="fadeT" x1="0" x2="0" y1="0" y2="1"><stop offset=".02" stopColor="#fff" stopOpacity="0" /><stop offset=".34" stopColor="#fff" stopOpacity="1" /></linearGradient>
        <mask id="mRecv" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#fadeL)" /></mask>
        <mask id="mGive" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#fadeT)" /></mask>
      </defs>
      <g className="hd-receiver">
        <image href="assets/landing/hand-receiver.webp" x="-120" y="262" width="660" height="331" mask="url(#mRecv)" preserveAspectRatio="xMidYMid meet" />
      </g>
      <g className="hd-giver">
        <image href="assets/landing/hand-giver.webp" x="262" y="-150" width="510" height="340" mask="url(#mGive)" preserveAspectRatio="xMidYMid meet" />
      </g>
      {/* the little spark that appears when the hands come closest */}
      <g className="hd-meet" transform="translate(395 268)" opacity="0">
        <path d="M0 -14 L2 -2 L14 0 L2 2 L0 14 L-2 2 L-14 0 L-2 -2 Z" fill="#FFE28A" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ community collage (original duotone scene) */
export function HeroCollage() {
  return (
    <svg className="collage" viewBox="0 0 520 620" role="img" aria-label="Volunteers loading food onto a vehicle marked Food for All">
      <defs>
        <clipPath id="clArch"><path d="M60 620 L60 220 C 60 100, 160 30, 290 30 C 420 30, 520 110, 520 230 L520 620 Z" /></clipPath>
        <linearGradient id="clSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#82C5DF" /><stop offset="1" stopColor="#D8EEF6" /></linearGradient>
        <pattern id="clDots" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1" fill="#102F46" opacity=".14" /></pattern>
        <filter id="clPaper"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="3" /><feColorMatrix values="0 0 0 0 .95  0 0 0 0 .9  0 0 0 0 .8  0 0 0 .18 0" /><feComposite in2="SourceGraphic" operator="in" /></filter>
      </defs>
      {/* warm sun disc behind the arch */}
      <circle className="cl-sun" cx="160" cy="250" r="190" fill="#F5D98B" />
      <g clipPath="url(#clArch)">
        <g className="cl-scene">
          <rect x="40" y="0" width="500" height="620" fill="url(#clSky)" />
          {/* buildings */}
          <g fill="#A8D9E9"><rect x="70" y="190" width="120" height="200" /><rect x="200" y="150" width="90" height="240" /><rect x="420" y="170" width="110" height="220" /></g>
          <g fill="#82C5DF"><rect x="96" y="220" width="18" height="24" /><rect x="132" y="220" width="18" height="24" /><rect x="96" y="262" width="18" height="24" /><rect x="132" y="262" width="18" height="24" />
            <rect x="218" y="180" width="16" height="22" /><rect x="252" y="180" width="16" height="22" /><rect x="218" y="220" width="16" height="22" /><rect x="252" y="220" width="16" height="22" />
            <rect x="440" y="196" width="18" height="24" /><rect x="476" y="196" width="18" height="24" /><rect x="440" y="238" width="18" height="24" /></g>
          {/* tree */}
          <g fill="#287FA6"><circle cx="350" cy="180" r="40" /><circle cx="380" cy="205" r="34" /><circle cx="325" cy="210" r="30" /></g>
          <rect x="350" y="220" width="8" height="170" fill="#164B70" />
          <rect x="40" y="388" width="500" height="240" fill="#C9D9E2" />
          {/* truck */}
          <g className="cl-truck">
            <rect x="250" y="300" width="230" height="130" rx="8" fill="#F2F7FA" stroke="#164B70" strokeWidth="3" />
            <text x="365" y="352" textAnchor="middle" fontFamily="Caveat, cursive" fontSize="40" fontWeight="700" fill="#164B70">FOOD</text>
            <text x="365" y="394" textAnchor="middle" fontFamily="Caveat, cursive" fontSize="40" fontWeight="700" fill="#164B70">FOR ALL</text>
            <path d="M190 340 L250 340 L250 430 L176 430 L176 372 Z" fill="#E4EEF3" stroke="#164B70" strokeWidth="3" />
            <path d="M196 350 L240 350 L240 380 L188 380 Z" fill="#82C5DF" />
            <circle cx="214" cy="434" r="20" fill="#102F46" /><circle cx="214" cy="434" r="8" fill="#A8D9E9" />
            <circle cx="430" cy="434" r="20" fill="#102F46" /><circle cx="430" cy="434" r="8" fill="#A8D9E9" />
          </g>
          {/* volunteers with food boxes */}
          <g fill="#164B70">
            <g className="cl-p1"><circle cx="100" cy="392" r="11" /><path d="M86 404 h28 l6 56 h-40 z" /><rect x="112" y="414" width="26" height="20" rx="2" fill="#F5D98B" /></g>
            <g className="cl-p2"><circle cx="150" cy="398" r="10" /><path d="M138 409 h24 l5 52 h-34 z" /></g>
            <g><circle cx="510" cy="396" r="10" /><path d="M498 407 h24 l5 54 h-34 z" /></g>
          </g>
          <rect x="40" y="0" width="500" height="620" fill="url(#clDots)" />
          <rect x="40" y="0" width="500" height="620" filter="url(#clPaper)" />
        </g>
      </g>
      {/* butter curved frame + leaves */}
      <path d="M60 620 L60 220 C 60 100, 160 30, 290 30 C 420 30, 520 110, 520 230 L520 620" fill="none" stroke="#FFE28A" strokeWidth="10" />
      <g className="cl-leaves" fill="#287FA6">
        <path d="M500 560 C 470 500, 480 440, 520 400 C 540 460, 530 520, 500 560 Z" />
        <path d="M470 600 C 420 570, 400 520, 410 470 C 450 500, 470 550, 470 600 Z" opacity=".8" />
        <path d="M30 590 C 10 540, 20 490, 60 460 C 74 510, 64 556, 30 590 Z" opacity=".75" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ live impact card (real data only) */
function useImpact() {
  const [d, setD] = useState(undefined);
  useEffect(() => {
    if (!configured) { setD(null); return; }
    db.rpc('public_impact').then((r) => setD(!r.error && r.data && r.data[0] ? r.data[0] : null), () => setD(null));
  }, []);
  return d;
}

function ImpactCard() {
  const d = useImpact();
  const ref = useRef(null);
  const hasData = d && (Number(d.units) || Number(d.ngos) || Number(d.donations));
  const items = hasData ? [[d.units, 'Units shared'], [d.ngos, 'Verified NGOs'], [d.donations, 'Pickups done']] : [];
  useEffect(() => {
    if (!hasData || !ref.current) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tweens = [...ref.current.querySelectorAll('[data-n]')].map((el) => {
      const n = Number(el.getAttribute('data-n')) || 0;
      if (reduce) { el.textContent = n.toLocaleString('en-IN'); return null; }
      const o = { v: 0 };
      return gsap.to(o, { v: n, duration: 1.6, delay: 1.2, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString('en-IN'); } });
    });
    return () => tweens.forEach((t) => t && t.kill());
  }, [hasData]); // eslint-disable-line
  return (
    <a className="impact-card" href="#impact" ref={ref} aria-label="Our impact, live from the AnnSetu database">
      <span className="ic-pill">Our Impact <FaRegStar aria-hidden="true" /></span>
      {d === undefined ? <div className="ic-row"><span className="ic-skel" /><span className="ic-skel" /><span className="ic-skel" /></div>
        : !hasData ? <p className="ic-empty">Live numbers appear here after the first confirmed pickup. We never show invented figures.</p>
          : (
            <div className="ic-row">
              {items.map(([n, l]) => <div key={l} className="ic-item"><b data-n={Number(n) || 0}>0</b><span>{l}</span></div>)}
            </div>
          )}
    </a>
  );
}

/* ------------------------------------------------------------------ journey band (bottom wave) */
const BAND = [
  [FaStore, 'Donor', 'Shares food'],
  [FaHandHoldingHeart, 'NGO', 'Receives food'],
  [FaPersonWalkingArrowRight, 'Representative', 'Collects food'],
  [FaPeopleGroup, 'Community', 'Gets food'],
];
function JourneyBand() {
  return (
    <div className="band">
      <svg className="band-wave" viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 70 C 240 10, 420 120, 720 70 S 1200 20, 1440 80 L1440 220 L0 220 Z" fill="#F5D98B" />
        <path d="M0 70 C 240 10, 420 120, 720 70 S 1200 20, 1440 80" fill="none" stroke="#FFE28A" strokeWidth="6" />
      </svg>
      <div className="band-in">
        <p className="band-title">The AnnSetu <span>Journey</span>
          <svg viewBox="0 0 80 30" aria-hidden="true"><path d="M2 20 C 20 30, 50 28, 74 10 M64 8 L75 9 L70 19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </p>
        <ol className="band-steps">
          {BAND.map(([Icon, t, s], i) => (
            <li key={t} style={{ '--i': i }}>
              <span className="bs-ic"><Icon aria-hidden="true" /></span>
              <b>{t}</b><small>{s}</small>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ hero */
const LINE1 = ['Good', 'food', 'deserves\u00a0a'];
const LINE2 = ['second', 'journey.'];

export default function Hero({ donateHref }) {
  const ref = useRef(null);
  useGsap(ref, (reduced) => {
    const q = (s) => ref.current.querySelector(s);
    if (reduced) { gsap.set('.hd-meet', { opacity: 0 }); return undefined; }
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    // the hands drift in softly from their corners and stop just short of each other, as in the reference
    tl.fromTo('.hd-giver', { x: 150, y: -150, autoAlpha: 0 }, { x: 0, y: 0, autoAlpha: 1, duration: 2.1 }, 0.2)
      .fromTo('.hd-receiver', { x: -150, y: 150, autoAlpha: 0 }, { x: 0, y: 0, autoAlpha: 1, duration: 2.1 }, 0.35)
      .fromTo('.hd-meet', { opacity: 0, scale: 0.2, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(3)' }, 2.1)
      .to('.hd-meet', { opacity: 0, scale: 0.4, duration: 0.6 }, 2.8)
      .from('.hero-h .wi', { yPercent: 115, duration: 1.1, stagger: 0.07, ease: 'expo.out' }, 0.15)
      .from('.hero-kick, .hero-sub, .hero-cta > *', { autoAlpha: 0, y: 20, duration: 0.9, stagger: 0.09 }, 0.6)
      .fromTo('.collage', { clipPath: 'inset(100% 0 0 0 round 40px)' }, { clipPath: 'inset(0% 0 0 0 round 40px)', duration: 1.5, ease: 'expo.inOut', clearProps: 'clipPath' }, 0.3)
      .from('.band', { yPercent: 40, autoAlpha: 0, duration: 1.1 }, 0.9)
      .from('.impact-card', { y: 30, autoAlpha: 0, duration: 0.9 }, 1.1)
      .from('.hero-note', { autoAlpha: 0, rotate: -12, duration: 0.8 }, 1.6);
    // gentle idle motion (transform-only, long loops)
    const idle = [
      gsap.to('.hd-giver', { y: 7, x: -3, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 2.4 }),
      gsap.to('.hd-receiver', { y: -6, x: 3, duration: 3.6, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 2.5 }),
      gsap.to('.hd-tassel', { rotate: 6, transformOrigin: '214px 536px', duration: 1.8, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
      gsap.to('.hd-star', { scale: 1.25, opacity: 0.7, transformOrigin: '50% 50%', duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
      gsap.to('.hd-dot', { motionPath: { path: '#hdDotPath', align: '#hdDotPath', alignOrigin: [0.5, 0.5] }, duration: 5, ease: 'none', repeat: -1 }),
      gsap.to('.cl-scene', { scale: 1.03, transformOrigin: '50% 60%', duration: 14, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
      gsap.to('.cl-leaves', { rotate: 2, transformOrigin: '50% 100%', duration: 4, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
      gsap.to('.hb-shape', { x: (i) => (i % 2 ? 14 : -14), y: (i) => (i % 2 ? -10 : 10), duration: (i) => 12 + i * 3, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
      gsap.to('.hb-cloud', { x: (i) => (i % 2 ? 30 : -24), duration: (i) => 18 + i * 4, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
      gsap.to('.hb-leaf', { rotate: (i) => (i % 2 ? 3 : -3), transformOrigin: '50% 100%', duration: (i) => 3.5 + i, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
    ];
    // pause the idle loops while the hero is off-screen (saves battery)
    const io = new IntersectionObserver(([e]) => idle.forEach((t) => (e.isIntersecting ? t.resume() : t.pause())));
    io.observe(ref.current);
    void q;
    return () => io.disconnect();
  });

  return (
    <section className="hero-x" ref={ref} aria-labelledby="hero-h" data-dark>
      {/* layered background: curved ocean + butter shapes, clouds, leaves */}
      <div className="hero-bg" aria-hidden="true">
        <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
          <path className="hb-shape" d="M-80 120 C 200 40, 420 160, 560 380 C 660 540, 560 760, 340 940 L -80 940 Z" fill="#164B70" />
          <path className="hb-shape" d="M900 -60 C 1060 80, 1300 60, 1520 -40 L1520 420 C 1360 380, 1180 330, 1040 200 C 960 120, 920 40, 900 -60 Z" fill="#287FA6" opacity=".55" />
          <path className="hb-shape" d="M1180 150 C 1300 160, 1420 260, 1500 420 L1500 700 C 1380 660, 1260 560, 1220 420 C 1190 320, 1170 230, 1180 150 Z" fill="#F5D98B" opacity=".9" />
          <path className="hb-shape" d="M-60 600 C 120 560, 260 640, 380 760 L -60 760 Z" fill="#287FA6" opacity=".45" />
          <g className="hb-cloud" fill="#A8D9E9" opacity=".22"><ellipse cx="780" cy="860" rx="220" ry="60" /><ellipse cx="900" cy="830" rx="140" ry="50" /></g>
          <g fill="#287FA6" opacity=".5">
            <path className="hb-leaf" d="M30 760 C 0 700, 10 640, 60 600 C 76 660, 70 720, 30 760 Z" />
            <path className="hb-leaf" d="M90 800 C 50 760, 40 700, 70 650 C 104 690, 110 750, 90 800 Z" />
            <path className="hb-leaf" d="M1400 760 C 1360 700, 1370 640, 1420 600 C 1436 660, 1430 720, 1400 760 Z" />
          </g>
        </svg>
        <div className="hero-grain" />
      </div>

      <div className="hero-grid">
        <div className="hero-copy">
          <p className="hero-kick"><span>A better tomorrow, together</span></p>
          <h1 className="hero-h" id="hero-h" aria-label="Good food deserves a second journey.">
            <span className="hl" aria-hidden="true">{LINE1.map((w, i) => <span className="w" key={w + i}><span className="wi">{w}</span></span>)}</span>
            <span className="hl l2" aria-hidden="true">{LINE2.map((w) => <span className="w em" key={w}><span className="wi">{w}</span></span>)}</span>
          </h1>
          <p className="hero-sub">Connecting surplus food with the people who need it. One meaningful connection at a time.</p>
          <div className="hero-cta">
            <a className="btn hero-btn primary-hero has-arrow" href={donateHref}><span>Donate Surplus</span><FaArrowRight aria-hidden="true" /></a>
            <a className="btn hero-btn secondary-hero" href="#discover"><span>Explore Food</span><FaRegStar aria-hidden="true" /></a>
          </div>
        </div>
        <div className="hero-art">
          <HeroCollage />
          <HeroHands />
          <p className="hero-note" aria-hidden="true">Together<br />we can end<br />food waste.
            <svg viewBox="0 0 60 40"><path d="M4 6 C 20 30, 40 34, 54 22 M46 20 L55 22 L52 31" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </p>
        </div>
      </div>

      <div className="hero-foot">
        <JourneyBand />
        <ImpactCard />
        <a className="hero-scroll" href="#story"><span className="mouse" aria-hidden="true"><i /></span>Scroll to explore</a>
      </div>
    </section>
  );
}
