import React, { useId } from 'react';

/* AnnSetu identity: the "A-bridge".
   A cable-stayed bridge pylon shaped like an A; a wave-shaped deck runs through it
   (the journey), carrying a sunshine node (the food). */
const WAVE = 'M3 64 C 18 53, 32 52, 46 61 S 76 79, 97 64';
const TONES = {
  brand: { leg: '#164B70', cable: '#287FA6', wave: '#287FA6', node: '#FFE28A', ring: '#164B70' },
  reverse: { leg: '#A8D9E9', cable: '#82C5DF', wave: '#82C5DF', node: '#FFE28A', ring: '#102F46' },
  mono: { leg: 'currentColor', cable: 'currentColor', wave: 'currentColor', node: 'currentColor', ring: 'currentColor' },
};

export function Monogram({ size = 40, tone = 'brand', draw = false, className = '', title }) {
  const id = useId().replace(/:/g, '');
  const c = TONES[tone] || TONES.brand;
  return (
    <svg className={'monogram' + (draw ? ' draw' : '') + (className ? ' ' + className : '')} width={size} height={size} viewBox="0 0 100 100"
      role={title ? 'img' : undefined} aria-hidden={title ? undefined : 'true'} aria-label={title}>
      <defs>
        {/* cut a clean gap in the pylon where the deck passes in front of it */}
        <mask id={`gap${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill="#fff" />
          <path d={WAVE} fill="none" stroke="#000" strokeWidth="10" />
        </mask>
      </defs>
      <g mask={`url(#gap${id})`}>
        <g className="mg-cables" stroke={c.cable} strokeWidth="1.3" strokeLinecap="round" fill="none">
          <path d="M49 18 L18 56" /><path d="M49 18 L27 55" /><path d="M49 18 L37 57" />
          <path d="M50 18 L64 72" /><path d="M50 18 L76 74" /><path d="M50 18 L86 69" />
        </g>
        <g className="mg-a" fill={c.leg}>
          <path d="M45.5 15 L49.5 15 L33 87 L28.5 87 Z" />
          <path d="M48.5 15 L56 15 L74 87 L64.5 87 Z" />
          <rect x="20" y="85.5" width="14" height="2.6" />
          <rect x="60" y="85.5" width="20" height="2.6" />
        </g>
      </g>
      <path className="mg-s" d={WAVE} fill="none" stroke={c.wave} strokeWidth="5.2" pathLength="1" />
      <circle className="mg-n" cx="49.5" cy="63.3" r="4.8" fill={c.node} stroke={c.ring} strokeWidth="2.2" />
    </svg>
  );
}

export function Wordmark({ className = '', tagline = false }) {
  return (
    <span className={'wordmark ' + className} aria-hidden="true">
      <span className="wm-name"><i>Ann</i><b>Setu</b></span>
      {tagline ? <span className="wm-tag">Connect · Share · Nourish</span> : null}
    </span>
  );
}

/* Logo: mark + serif wordmark, with the sunshine swoosh and sparkle from the brand reference. */
export function Logo({ href = 'index.html', tone = 'brand', size = 38, className = '', tagline = false }) {
  return (
    <a className={'logo ' + (tone === 'reverse' ? 'reverse ' : '') + className} href={href} aria-label="AnnSetu home">
      <Monogram size={size} tone={tone} />
      <span className="logo-text">
        <svg className="logo-swoosh" viewBox="0 0 120 20" aria-hidden="true">
          <path d="M4 16 C 30 2, 78 0, 112 8" fill="none" strokeWidth="2.4" strokeLinecap="round" />
          <path className="spark" d="M112 1 l1.6 4.4 4.4 1.6 -4.4 1.6 -1.6 4.4 -1.6 -4.4 -4.4 -1.6 4.4 -1.6 z" />
        </svg>
        <Wordmark tagline={tagline} />
      </span>
    </a>
  );
}
