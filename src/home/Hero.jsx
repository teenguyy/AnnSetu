import React, { useRef } from 'react';
import { gsap, useGsap } from '../anim.js';
import { Arrow } from '../ui.jsx';

const LINE1 = ['Good', 'food', 'deserves'];
const LINE2 = ['a', 'second', 'journey.'];

/* Original cinematic visual: a sunrise over the ocean, crossed by a bridge (setu).
   A small coral marker travels the deck: one surplus meal on its second journey. */
export function HeroVisual() {
  const bars = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <svg className="hv" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A bridge silhouetted against a rising sun over the ocean">
      <defs>
        <linearGradient id="hvSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#102F46" />
          <stop offset=".55" stopColor="#164B70" />
          <stop offset="1" stopColor="#287FA6" />
        </linearGradient>
        <linearGradient id="hvSea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#164B70" />
          <stop offset="1" stopColor="#102F46" />
        </linearGradient>
        <clipPath id="hvAbove"><rect x="0" y="0" width="400" height="318" /></clipPath>
        <filter id="hvGrain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0" />
        </filter>
      </defs>
      <g className="hv-zoom">
        <rect width="400" height="318" fill="url(#hvSky)" />
        <g className="hv-rings" fill="none" stroke="#FFE28A">
          <circle cx="200" cy="318" r="150" opacity=".16" />
          <circle cx="200" cy="318" r="188" opacity=".1" />
          <circle cx="200" cy="318" r="230" opacity=".06" />
        </g>
        <g clipPath="url(#hvAbove)"><circle className="hv-sun" cx="200" cy="318" r="112" fill="#FFE28A" /></g>
        <rect y="318" width="400" height="182" fill="url(#hvSea)" />
        <g className="hv-reflect">
          {bars.map((b) => (
            <rect key={b} x={200 - (100 - b * 11)} y={326 + b * 17} width={(100 - b * 11) * 2} height={5 - b * 0.4} rx="2" fill={b < 3 ? '#FFE28A' : b < 6 ? '#F5D98B' : '#A8D9E9'} style={{ '--b': b }} />
          ))}
        </g>
        <g className="hv-horizon" stroke="#A8D9E9" strokeWidth="1" opacity=".35">
          <path d="M0 318 H400" /><path d="M24 372 H120" /><path d="M290 402 H380" /><path d="M40 444 H150" />
        </g>
        {/* the bridge */}
        <g className="hv-bridge" stroke="#102F46" fill="none">
          <path d="M-10 262 H410" strokeWidth="7" />
          <path id="hvArch" d="M18 318 Q200 96 382 318" strokeWidth="6" />
          <g strokeWidth="1.6">
            {[60, 95, 130, 165, 200, 235, 270, 305, 340].map((x) => {
              const t = (x - 18) / 364;
              const y = (1 - t) * (1 - t) * 318 + 2 * (1 - t) * t * 96 + t * t * 318;
              return <path key={x} d={`M${x} ${Math.min(y, 262)} V262`} />;
            })}
          </g>
          <path d="M18 262 V330 M382 262 V330" strokeWidth="9" />
        </g>
        <path id="hvDeck" d="M-10 254 H410" fill="none" stroke="none" />
        <g className="hv-marker">
          <circle r="5.5" fill="#E87968" />
          <circle r="11" fill="none" stroke="#E87968" strokeOpacity=".45" />
        </g>
        <rect width="400" height="500" filter="url(#hvGrain)" />
      </g>
      <g className="hv-cap" fill="#A8D9E9" fontFamily="Space Grotesk, sans-serif" fontSize="10" letterSpacing="2">
        <text x="20" y="484">FIG. 01</text>
        <text x="380" y="484" textAnchor="end">SURPLUS → COMMUNITY</text>
      </g>
    </svg>
  );
}

export default function Hero({ donateHref }) {
  const ref = useRef(null);
  useGsap(ref, (reduced) => {
    const marker = ref.current.querySelector('.hv-marker');
    if (reduced) {
      gsap.set(marker, { x: 200, y: 254 });
      return;
    }
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from('.hero-h .wi', { yPercent: 115, duration: 1.15, stagger: 0.07 }, 0.15)
      .fromTo('.hero-frame', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut', clearProps: 'clipPath' }, 0.1)
      .from('.hv-zoom', { scale: 1.18, transformOrigin: '50% 60%', duration: 2.2 }, 0.1)
      .from('.hv-sun', { y: 60, duration: 2.4, ease: 'power3.out' }, 0.3)
      .from('.hero-sub, .hero-cta > *, .hero-note', { autoAlpha: 0, y: 22, duration: 0.9, stagger: 0.09 }, 0.75)
      .from('.hero-kick', { autoAlpha: 0, x: -16, duration: 0.8 }, 0.2);
    gsap.fromTo(marker, { motionPath: { path: '#hvDeck', align: '#hvDeck', alignOrigin: [0.5, 0.5], start: 0, end: 0 } },
      { motionPath: { path: '#hvDeck', align: '#hvDeck', alignOrigin: [0.5, 0.5], start: 0, end: 1 }, duration: 9, ease: 'none', repeat: -1, delay: 1.6 });
    gsap.to('.hero-frame', { yPercent: -8, ease: 'none', scrollTrigger: { trigger: ref.current, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero-copy', { yPercent: 12, autoAlpha: 0.2, ease: 'none', scrollTrigger: { trigger: ref.current, start: 'top top', end: 'bottom top', scrub: true } });
    return undefined;
  });

  return (
    <section className="hero-x" ref={ref} aria-labelledby="hero-h" data-dark>
      <div className="hero-shapes" aria-hidden="true"><i className="s1" /><i className="s2" /><i className="s3" /></div>
      <div className="hero-grid">
        <div className="hero-copy">
          <p className="hero-kick"><span className="dot" />Surplus food, redistributed</p>
          <h1 className="hero-h" id="hero-h" aria-label="Good food deserves a second journey.">
            <span className="hl" aria-hidden="true">{LINE1.map((w) => <span className="w" key={w}><span className="wi">{w}</span></span>)}</span>
            <span className="hl l2" aria-hidden="true">{LINE2.map((w) => <span className={'w' + (w === 'second' ? ' em' : '')} key={w}><span className="wi">{w}</span></span>)}</span>
          </h1>
          <p className="hero-sub">Connecting surplus food with the people who need it. One meaningful connection at a time.</p>
          <div className="hero-cta">
            <a className="btn sun lg has-arrow" href={donateHref}><span>Donate surplus</span><Arrow /></a>
            <a className="btn line lg has-arrow" href="#discover"><span>Explore food</span><Arrow /></a>
          </div>
        </div>
        <figure className="hero-frame">
          <HeroVisual />
          <figcaption className="hero-note" aria-hidden="true">from a kitchen, to a community</figcaption>
        </figure>
      </div>
      <a className="hero-scroll" href="#story" aria-label="Scroll to the story"><span /></a>
    </section>
  );
}
