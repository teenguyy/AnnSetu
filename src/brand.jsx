import React from 'react';

/* AnnSetu identity.
   The monogram is a connected A + S: the A is a bridge pylon, its crossbar runs on as the
   bridge deck and turns into the S, ending at a coral "arrival" node. */
const A_PATH = 'M8 88 L31 12 L54 88';
const S_PATH = 'M15 64 H70 A12 12 0 0 0 70 40 H66 A12 12 0 0 1 66 16 H90';

export function Monogram({ size = 40, tone = 'brand', draw = false, className = '', title }) {
  const c = tone === 'reverse' ? ['var(--sun)', 'var(--sky)', 'var(--coral)']
    : tone === 'mono' ? ['currentColor', 'currentColor', 'currentColor']
      : ['var(--ocean-deep)', 'var(--ocean)', 'var(--coral)'];
  return (
    <svg className={'monogram' + (draw ? ' draw' : '') + (className ? ' ' + className : '')} width={size} height={size} viewBox="0 0 100 100"
      role={title ? 'img' : undefined} aria-hidden={title ? undefined : 'true'} aria-label={title}>
      <g fill="none" strokeWidth="10" strokeLinejoin="miter" strokeMiterlimit="10">
        <path className="mg-a" d={A_PATH} stroke={c[0]} pathLength="1" />
        <path className="mg-s" d={S_PATH} stroke={c[1]} pathLength="1" />
      </g>
      <circle className="mg-n" cx="91" cy="16" r="6.5" fill={c[2]} />
    </svg>
  );
}

export function Wordmark({ className = '' }) {
  return <span className={'wordmark ' + className} aria-hidden="true"><i>Ann</i><b>Setu</b></span>;
}

/* Navigation logo: monogram + live-text wordmark (crisp at any size, accessible name on the link). */
export function Logo({ href = 'index.html', tone = 'brand', size = 34, className = '' }) {
  return (
    <a className={'logo ' + (tone === 'reverse' ? 'reverse ' : '') + className} href={href} aria-label="AnnSetu home">
      <Monogram size={size} tone={tone} />
      <Wordmark />
    </a>
  );
}
