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

      {/* receiver */}
      <g className="hd-receiver">
        <g filter="url(#hgSoft)">
          <path d="M-80 572 L-30 690 L134 612 L108 528 Z" fill="#2F5577" />
          <g fill="none" stroke="#3E6A90" strokeWidth="3" opacity=".55"><path d="M-40 590 L112 540" /><path d="M-30 616 L120 566" /></g>
          <g filter="url(#hgGrain)">
            <path d="M110 526 C 152 506, 198 486, 240 470 L 256 518 C 214 530, 172 546, 130 566 Z" fill="url(#hgArmB)" />
            <path className="hd-palm" d="M236 468 C 262 456, 280 452, 290 446 C 294 428, 300 410, 310 398 C 316 390, 327 392, 324 403 C 320 418, 318 432, 324 444 C 350 436, 392 424, 432 418 C 447 416, 451 429, 438 433 C 420 437, 400 440, 382 444 C 410 444, 436 444, 452 446 C 465 448, 463 461, 450 461 C 428 462, 404 462, 386 462 C 410 466, 430 470, 441 474 C 451 478, 447 489, 436 487 C 418 484, 400 482, 384 480 C 398 486, 410 492, 415 496 C 421 503, 412 509, 404 505 C 384 498, 366 498, 350 502 C 320 512, 286 520, 256 518 C 246 516, 240 506, 236 468 Z" fill="url(#hgBot)" />
            <g fill="none" stroke="#5A5957" strokeWidth="1.6" opacity=".5" strokeLinecap="round">
              <path d="M268 492 C 294 486, 320 474, 340 458" /><path d="M286 508 C 308 502, 330 492, 350 480" />
              <path d="M352 450 C 360 448, 370 446, 380 445" /><path d="M360 464 C 368 463, 376 463, 384 463" /><path d="M362 480 C 368 480, 374 481, 382 481" />
            </g>
            <path d="M236 468 C 262 456, 280 452, 290 446 C 330 440, 360 470, 350 502 C 320 512, 286 520, 256 518 C 246 516, 240 506, 236 468 Z" fill="url(#hgDots)" />
          </g>
          <path d="M196 486 C 202 504, 208 522, 212 538" stroke="#2A221C" strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray="1 7" />
          <path d="M200 484 C 206 502, 212 520, 216 536" stroke="#5A4636" strokeWidth="2.4" fill="none" />
          <path className="hd-tassel" d="M214 536 C 216 552, 214 566, 210 576" stroke="#2A221C" strokeWidth="2" fill="none" />
          <circle cx="210" cy="578" r="3.5" fill="#2A221C" />
        </g>
      </g>

      {/* giver + apple */}
      <g className="hd-giver">
        <g className="hd-apple" filter="url(#hgSoft)">
          <g transform="translate(-26 22)">
            <path d="M432 238 C 404 220, 358 226, 350 270 C 342 312, 368 362, 406 370 C 420 373, 426 366, 434 366 C 442 366, 450 373, 464 370 C 500 362, 522 312, 514 270 C 506 226, 460 220, 432 238 Z" fill="url(#hgApple)" />
            <g opacity=".2" stroke="#FFD9A8" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M376 266 C 370 296, 376 324, 390 346" /><path d="M398 252 C 392 286, 394 318, 404 350" /><path d="M470 254 C 482 286, 484 318, 478 348" /><path d="M490 262 C 500 290, 500 318, 492 340" /></g>
            <ellipse className="hd-shine" cx="390" cy="276" rx="12" ry="24" fill="#fff" opacity=".33" transform="rotate(18 390 276)" />
            <path d="M432 240 C 433 228, 436 218, 442 210" stroke="#4A2E1A" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          </g>
        </g>
        <g filter="url(#hgSoft)">
          <path d="M650 -40 L720 30 L600 150 L548 92 Z" fill="#1C2C3A" />
          <path d="M626 70 L 606 150" stroke="#2C4256" strokeWidth="3" />
          <g filter="url(#hgGrain)">
            <path d="M560 92 C 586 104, 604 118, 612 136 C 596 150, 580 162, 566 172 L 520 128 C 534 116, 546 104, 560 92 Z" fill="url(#hgArmT)" />
            <path d="M440 194 C 414 194, 392 204, 374 222 C 362 234, 360 250, 369 255 C 378 260, 385 250, 391 239 C 401 223, 416 214, 434 212 Z" fill="url(#hgTop)" />
            <path d="M552 104 C 528 116, 500 136, 474 156 C 452 172, 432 184, 414 194 C 398 202, 386 214, 383 230 C 379 247, 385 264, 397 272 C 405 277, 415 273, 413 262 C 410 249, 411 236, 420 228 C 429 241, 435 259, 440 274 C 445 286, 458 284, 458 272 C 457 256, 453 238, 457 224 C 466 238, 474 252, 480 263 C 486 273, 497 269, 495 259 C 491 245, 489 232, 494 221 C 502 231, 508 240, 514 245 C 520 249, 527 243, 523 235 C 518 224, 521 210, 531 198 C 545 184, 560 172, 584 158 Z" fill="url(#hgTop)" />
            <g fill="none" stroke="#5A5957" strokeWidth="1.6" opacity=".55" strokeLinecap="round">
              <path d="M418 226 C 412 214, 418 204, 430 200" /><path d="M455 222 C 452 210, 458 202, 470 198" /><path d="M492 219 C 492 208, 498 202, 508 198" />
              <path d="M398 250 C 402 252, 407 252, 410 250" /><path d="M440 258 C 444 261, 450 261, 454 258" /><path d="M482 248 C 486 250, 490 250, 493 248" />
              <path d="M470 176 C 486 168, 504 166, 520 170" />
            </g>
            <path d="M552 104 C 528 116, 500 136, 474 156 C 452 172, 432 184, 414 194 C 440 210, 500 220, 531 198 C 545 184, 560 172, 584 158 Z" fill="url(#hgDots)" />
          </g>
        </g>
      </g>
      {/* the little spark that appears when the hands come closest */}
      <g className="hd-meet" transform="translate(372 418)" opacity="0">
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
      gsap.to('.hd-apple', { rotate: 3, transformOrigin: '420px 300px', duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 2.4 }),
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
