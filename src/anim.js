/* Shared animation kit: GSAP + ScrollTrigger for scroll storytelling, with reduced-motion fallbacks.
   Every helper is scoped with gsap.context() and reverted on cleanup, so timelines, ScrollTriggers
   and their listeners never leak between React renders. */
import { useLayoutEffect, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
export { gsap, ScrollTrigger };

const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
export const reducedMotion = () => !!(mq && mq.matches);

const useIso = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/* Run GSAP code scoped to a ref. fn(ctx, reduced) may return a cleanup. */
export function useGsap(scope, fn, deps = []) {
  useIso(() => {
    if (!scope.current) return undefined;
    let extra;
    const ctx = gsap.context(() => { extra = fn(reducedMotion()); }, scope);
    return () => { if (typeof extra === 'function') extra(); ctx.revert(); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

/* Standard section reveals, driven by data attributes:
   [data-reveal]          fade + rise
   [data-reveal="clip"]   typography clipped from below
   [data-reveal="mask"]   image / block mask wipe
   [data-stagger] > *     staggered children
   [data-parallax="0.2"]  subtle parallax drift */
export function revealAll(reduced) {
  const q = gsap.utils.toArray;
  if (reduced) {
    gsap.set(q('[data-reveal], [data-stagger] > *'), { clearProps: 'all', autoAlpha: 1 });
    return;
  }
  q('[data-reveal]').forEach((el) => {
    const kind = el.getAttribute('data-reveal');
    const st = { trigger: el, start: 'top 86%', once: true };
    if (kind === 'clip') {
      gsap.fromTo(el, { clipPath: 'inset(0 0 100% 0)', yPercent: 18 }, { clipPath: 'inset(0 0 0% 0)', yPercent: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: st });
    } else if (kind === 'mask') {
      gsap.fromTo(el, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.3, ease: 'expo.inOut', scrollTrigger: st });
    } else {
      gsap.fromTo(el, { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: st });
    }
  });
  q('[data-stagger]').forEach((box) => {
    gsap.fromTo(box.children, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: box, start: 'top 85%', once: true } });
  });
  q('[data-parallax]').forEach((el) => {
    const amt = parseFloat(el.getAttribute('data-parallax')) || 0.15;
    gsap.to(el, { yPercent: -amt * 100, ease: 'none', scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}

/* Count a number up when it scrolls into view (real values only). */
export function countUp(el, value, reduced) {
  const n = Number(value) || 0;
  const fmt = (v) => Math.round(v).toLocaleString('en-IN');
  if (reduced) { el.textContent = fmt(n); return; }
  const o = { v: 0 };
  el.textContent = '0';
  gsap.to(o, { v: n, duration: 1.8, ease: 'power2.out', onUpdate: () => { el.textContent = fmt(o.v); }, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
}
