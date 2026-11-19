"use client";

import { useEffect, useRef, useState } from "react";

/** Counts up once when visible; renders the final value immediately with reduced motion. */
export function CountUp({ value, className, format }: { value: number; className?: string; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  const fmt = format ?? ((n: number) => new Intl.NumberFormat("en-IN").format(Math.round(n)));

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShown(0);
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const step = (t: number) => {
          const p = Math.min((t - start) / 1400, 1);
          setShown(value * (1 - Math.pow(1 - p, 3)));
          if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return (
    <span ref={ref} className={className} aria-label={fmt(value)}>
      <span aria-hidden>{fmt(shown)}</span>
    </span>
  );
}
