/* AnnSetu cursor: a minimal crosshair with connection nodes.
   - Desktop fine pointers only (never on touch / coarse pointers).
   - The centre point tracks the pointer exactly; the crosshair follows with slight easing.
   - Hover: arms widen and four connection nodes appear, linked by fine lines.
   - Drag: a directional chevron shows travel direction; valid drop targets turn it sunshine yellow.
   - Text fields keep the native I-beam (the decorative cursor hides there), so selection and typing are unchanged.
   - prefers-reduced-motion: no easing, no trail. */

const HOVER = 'a[href], button:not(:disabled), [role="button"], [role="tab"], [role="switch"], summary, label[for], .chip, [data-cursor="hover"]';
const TEXT = 'input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, select, [contenteditable="true"]';
const GRAB = '[data-draggable="true"]';

let started = false;

export function setCursorMode(mode) {
  window.dispatchEvent(new CustomEvent('annsetu:cursor', { detail: mode }));
}

export function initCursor() {
  if (started || typeof window === 'undefined') return;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let teardown = null;
  const apply = () => {
    if (teardown) { teardown(); teardown = null; }
    if (fine.matches) teardown = mount(reduce);
  };
  fine.addEventListener?.('change', apply);
  reduce.addEventListener?.('change', apply);
  apply();
  started = true;
}

function mount(reduce) {
  const root = document.documentElement;
  const el = document.createElement('div');
  el.className = 'cx is-hidden';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <span class="cx-dot"></span>
    <svg class="cx-hair" viewBox="-32 -32 64 64" width="64" height="64">
      <g class="cx-links"><path d="M-13 -13 L13 -13 L13 13 L-13 13 Z"/></g>
      <g class="cx-arms"><path d="M0 -7 V-17"/><path d="M7 0 H17"/><path d="M0 7 V17"/><path d="M-7 0 H-17"/></g>
      <g class="cx-nodes"><circle cx="-13" cy="-13" r="2.4"/><circle cx="13" cy="-13" r="2.4"/><circle cx="13" cy="13" r="2.4"/><circle cx="-13" cy="13" r="2.4"/></g>
      <g class="cx-dir"><path d="M-6 -7 L4 0 L-6 7"/></g>
    </svg>`;
  const trail = document.createElement('canvas');
  trail.className = 'cx-trail';
  trail.setAttribute('aria-hidden', 'true');
  document.body.append(trail, el);
  root.classList.add('has-cx');
  const dot = el.querySelector('.cx-dot');
  const hair = el.querySelector('.cx-hair');
  const dirG = el.querySelector('.cx-dir');
  const ctx = trail.getContext('2d');
  let dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = () => { dpr = Math.min(2, window.devicePixelRatio || 1); trail.width = innerWidth * dpr; trail.height = innerHeight * dpr; };
  size();

  let x = -100, y = -100, hx = x, hy = y, vx = 0, vy = 0, angle = 0;
  let raf = 0, visible = false, mode = '';
  const pts = [];

  const tick = () => {
    const still = reduce.matches;
    const k = still ? 1 : 0.24;
    hx += (x - hx) * k; hy += (y - hy) * k;
    dot.style.transform = `translate3d(${x}px,${y}px,0)`;
    hair.style.transform = `translate3d(${hx - 32}px,${hy - 32}px,0)`;
    const sp = Math.hypot(vx, vy);
    if (sp > 0.6) angle = Math.atan2(vy, vx) * 57.2958;
    dirG.style.transform = `rotate(${angle}deg) translateX(20px)`;
    vx *= 0.82; vy *= 0.82;
    // fading connection trail
    ctx.clearRect(0, 0, trail.width, trail.height);
    if (!still && visible) {
      pts.push([hx, hy]);
      if (pts.length > 16) pts.shift();
      for (let i = 1; i < pts.length; i++) {
        const a = i / pts.length;
        ctx.strokeStyle = `rgba(130,197,223,${(a * 0.55).toFixed(3)})`;
        ctx.lineWidth = a * 1.6 * dpr;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1][0] * dpr, pts[i - 1][1] * dpr);
        ctx.lineTo(pts[i][0] * dpr, pts[i][1] * dpr);
        ctx.stroke();
      }
    } else pts.length = 0;
    const settled = Math.abs(x - hx) < 0.1 && Math.abs(y - hy) < 0.1 && sp < 0.05;
    if (settled && pts.length) pts.shift();
    raf = settled && !pts.length ? 0 : requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  const setCls = (c, on) => el.classList.toggle(c, on);
  const onMove = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    vx = e.clientX - x; vy = e.clientY - y;
    x = e.clientX; y = e.clientY;
    if (!visible) { visible = true; hx = x; hy = y; setCls('is-hidden', false); }
    kick();
  };
  const onOver = (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    setCls('is-text', !!t.closest(TEXT));
    setCls('on-dark', document.documentElement.dataset.theme === 'dark' || !!t.closest('[data-dark]'));
    setCls('is-grab', !!t.closest(GRAB));
    setCls('is-hover', !!t.closest(HOVER) || !!t.closest(GRAB));
  };
  const onDown = (e) => { if (!e.pointerType || e.pointerType === 'mouse') setCls('is-down', true); };
  const onUp = () => setCls('is-down', false);
  const onLeave = (e) => { if (!e.relatedTarget) { visible = false; setCls('is-hidden', true); } };
  const onMode = (e) => {
    mode = e.detail || '';
    setCls('is-drag', mode === 'drag' || mode === 'drop');
    setCls('is-drop', mode === 'drop');
  };

  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onDown, { passive: true });
  addEventListener('pointerup', onUp, { passive: true });
  document.addEventListener('pointerover', onOver, { passive: true });
  document.addEventListener('mouseout', onLeave);
  addEventListener('resize', size);
  addEventListener('annsetu:cursor', onMode);

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerdown', onDown);
    removeEventListener('pointerup', onUp);
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('mouseout', onLeave);
    removeEventListener('resize', size);
    removeEventListener('annsetu:cursor', onMode);
    el.remove(); trail.remove();
    root.classList.remove('has-cx');
  };
}
