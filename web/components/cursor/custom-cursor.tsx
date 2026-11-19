"use client";

import { useEffect, useRef } from "react";

const INTERACTIVE = "a, button, [role='button'], summary, label[for], [data-cursor='hover']";
const TEXT = "input, textarea, select, [contenteditable='true']";
const TRAIL = 6;

/**
 * Desktop-only cursor: centre dot with four thin crosshair arms and a fine fading trail.
 * Over interactive targets it morphs into a soft ring around the target with a 2–4 px magnetic
 * pull. Text fields keep the native I-beam. Disabled on touch/coarse pointers; no trail with
 * reduced motion.
 */
export function CustomCursor() {
  const root = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const trail = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!fine.matches) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.documentElement.classList.add("has-custom-cursor");
    const el = root.current!;
    el.style.display = "block";

    const pos = { x: -100, y: -100 };
    const eased = { x: -100, y: -100 };
    const history = Array.from({ length: TRAIL }, () => ({ x: -100, y: -100 }));
    const ringBox = { x: 0, y: 0, w: 28, h: 28, r: 999 };
    let target: Element | null = null;
    let dragging = false;
    let lastX = 0;
    let raf = 0;
    let hidden = false;

    const onMove = (e: PointerEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      const t = e.target as Element | null;
      if (t?.closest(TEXT)) {
        el.dataset.mode = "text";
        target = null;
      } else {
        target = t?.closest(INTERACTIVE) ?? null;
        el.dataset.mode = dragging ? "drag" : target ? "hover" : "default";
        el.dataset.drop = t?.closest("[data-cursor-drop='true']") ? "valid" : "";
      }
      if (dragging) el.dataset.dir = e.clientX >= lastX ? "right" : "left";
      lastX = e.clientX;
      if (hidden) {
        hidden = false;
        el.style.opacity = "1";
      }
    };
    const onLeave = () => {
      hidden = true;
      el.style.opacity = "0";
    };
    const onDragStart = () => {
      dragging = true;
      el.dataset.mode = "drag";
    };
    const onDragEnd = () => {
      dragging = false;
      el.dataset.mode = "default";
      el.dataset.drop = "";
    };
    const onDragOver = (e: DragEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      el.dataset.dir = e.clientX >= lastX ? "right" : "left";
      lastX = e.clientX;
      el.dataset.drop = (e.target as Element | null)?.closest("[data-cursor-drop='true']") ? "valid" : "";
    };

    const tick = () => {
      const k = reduced ? 1 : 0.32;
      eased.x += (pos.x - eased.x) * k;
      eased.y += (pos.y - eased.y) * k;
      dot.current!.style.transform = `translate3d(${eased.x}px, ${eased.y}px, 0)`;

      let tx = eased.x - 14,
        ty = eased.y - 14,
        tw = 28,
        th = 28,
        tr = 999;
      if (target && el.dataset.mode === "hover") {
        const b = target.getBoundingClientRect();
        const cx = b.left + b.width / 2;
        const cy = b.top + b.height / 2;
        // magnetic pull: at most 4 px towards the pointer
        const px = Math.max(-4, Math.min(4, (pos.x - cx) * 0.08));
        const py = Math.max(-4, Math.min(4, (pos.y - cy) * 0.08));
        const pad = 6;
        tw = b.width + pad * 2;
        th = b.height + pad * 2;
        tx = b.left - pad + px;
        ty = b.top - pad + py;
        tr = Math.min(999, parseFloat(getComputedStyle(target).borderRadius) + pad || 14);
      }
      const ke = reduced ? 1 : 0.22;
      ringBox.x += (tx - ringBox.x) * ke;
      ringBox.y += (ty - ringBox.y) * ke;
      ringBox.w += (tw - ringBox.w) * ke;
      ringBox.h += (th - ringBox.h) * ke;
      ringBox.r = tr;
      const rs = ring.current!.style;
      rs.transform = `translate3d(${ringBox.x}px, ${ringBox.y}px, 0)`;
      rs.width = `${ringBox.w}px`;
      rs.height = `${ringBox.h}px`;
      rs.borderRadius = `${ringBox.r}px`;

      if (!reduced) {
        history.unshift({ x: eased.x, y: eased.y });
        history.length = TRAIL;
        trail.current.forEach((d, i) => {
          const p = history[Math.min(i * 1 + 1, TRAIL - 1)];
          d.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
        });
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("dragstart", onDragStart);
    window.addEventListener("dragend", onDragEnd);
    window.addEventListener("drop", onDragEnd);
    window.addEventListener("dragover", onDragOver);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("dragstart", onDragStart);
      window.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("drop", onDragEnd);
      window.removeEventListener("dragover", onDragOver);
      document.documentElement.classList.remove("has-custom-cursor");
    };
  }, []);

  return (
    <div ref={root} aria-hidden className="cursor-root" data-mode="default" style={{ display: "none" }}>
      {Array.from({ length: TRAIL }, (_, i) => (
        <div
          key={i}
          ref={(n) => {
            if (n) trail.current[i] = n;
          }}
          className="cursor-trail"
          style={{ opacity: 0.22 - i * 0.035 }}
        />
      ))}
      <div ref={ring} className="cursor-ring" />
      <div ref={dot} className="cursor-dot">
        <span className="arm arm-t" />
        <span className="arm arm-b" />
        <span className="arm arm-l" />
        <span className="arm arm-r" />
        <span className="chev">›</span>
      </div>
      <style>{`
        .cursor-root { position: fixed; inset: 0; pointer-events: none; z-index: 9999; mix-blend-mode: difference; transition: opacity .2s; }
        .cursor-dot, .cursor-ring, .cursor-trail { position: fixed; left: 0; top: 0; will-change: transform; }
        .cursor-dot { width: 0; height: 0; }
        .cursor-dot::before { content: ""; position: absolute; left: -3px; top: -3px; width: 6px; height: 6px; border-radius: 50%; background: #F4ECD8; }
        .cursor-dot .arm { position: absolute; background: #F4ECD8; opacity: .85; transition: opacity .2s, transform .2s; }
        .arm-t, .arm-b { left: -.5px; width: 1px; height: 6px; }
        .arm-l, .arm-r { top: -.5px; height: 1px; width: 6px; }
        .arm-t { top: -12px } .arm-b { top: 6px } .arm-l { left: -12px } .arm-r { left: 6px }
        .cursor-dot .chev { position: absolute; left: 8px; top: -14px; color: #F4ECD8; font: 600 18px/1 sans-serif; opacity: 0; transition: opacity .15s, transform .15s; }
        .cursor-ring { border: 1.5px solid rgba(244,236,216,.55); opacity: 0; transition: opacity .22s cubic-bezier(.22,1,.36,1), border-color .2s, background-color .2s; }
        .cursor-trail { width: 3px; height: 3px; margin: -1.5px 0 0 -1.5px; border-radius: 50%; background: #F4ECD8; }
        .cursor-root[data-mode="hover"] .cursor-ring { opacity: 1; }
        .cursor-root[data-mode="hover"] .arm { opacity: 0; transform: scale(.4); }
        .cursor-root[data-mode="text"] { opacity: 0 !important; }
        .cursor-root[data-mode="drag"] .arm { opacity: 0; }
        .cursor-root[data-mode="drag"] .chev { opacity: 1; }
        .cursor-root[data-mode="drag"][data-dir="left"] .chev { transform: scaleX(-1) translateX(20px); }
        .cursor-root[data-drop="valid"] .cursor-ring { opacity: 1; border-color: #FFE28A; background: rgba(255,226,138,.14); }
        .cursor-root[data-drop="valid"] { mix-blend-mode: normal; }
      `}</style>
    </div>
  );
}
