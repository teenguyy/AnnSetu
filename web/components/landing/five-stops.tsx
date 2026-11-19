"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

const STOPS = [
  { name: "Donor", text: "Donor lists surplus with quantity, safety notes and pickup deadline." },
  { name: "AnnSetu", text: "AnnSetu shows it only to verified, active receivers, nearest first." },
  { name: "NGO", text: "The NGO requests a quantity and assigns a representative; the donor accepts and the food is reserved." },
  { name: "Collection", text: "The representative collects; the donor confirms with a 4-digit code." },
  { name: "Community", text: "Meals reach people; impact, badges and certificates are recorded automatically." },
];

type RouteDef = {
  viewBox: string;
  d: string;
  nodes: readonly (readonly [number, number])[];
  label: (i: number) => number;
};

const DESKTOP: RouteDef = {
  viewBox: "0 0 1200 420",
  d: "M90 320 C 200 320, 250 110, 360 110 C 470 110, 520 330, 630 330 C 740 330, 790 110, 900 110 C 1000 110, 1040 250, 1130 250",
  nodes: [[90, 320], [360, 110], [630, 330], [900, 110], [1130, 250]],
  label: (i: number) => (i % 2 === 0 ? 46 : -34),
};
const MOBILE: RouteDef = {
  viewBox: "0 0 360 900",
  d: "M60 60 C 60 160, 300 140, 300 240 C 300 340, 60 320, 60 420 C 60 520, 300 500, 300 600 C 300 700, 180 720, 180 820",
  nodes: [[60, 60], [300, 240], [60, 420], [300, 600], [180, 820]],
  label: () => 40,
};

const TRAVEL_MS = 1500;
const HOLD_MS = 1700;
const REST_MS = 2600;

type Geometry = { lengths: number[]; path: SVGPathElement };

function measure(path: SVGPathElement, nodes: readonly (readonly [number, number])[]): number[] {
  const total = path.getTotalLength();
  return nodes.map(([x, y], i) => {
    if (i === 0) return 0;
    if (i === nodes.length - 1) return total;
    let best = 0;
    let bestD = Infinity;
    for (let s = 0; s <= 600; s++) {
      const l = (s / 600) * total;
      const p = path.getPointAtLength(l);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = l;
      }
    }
    return best;
  });
}

function Thali() {
  return (
    <g>
      <g className="fs-steam" stroke="#F4ECD8" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".85">
        <path d="M-7 -20 c -4 -5, 4 -8, 0 -14" />
        <path d="M0 -22 c -4 -5, 4 -8, 0 -14" />
        <path d="M7 -20 c -4 -5, 4 -8, 0 -14" />
      </g>
      <ellipse cx="0" cy="-9" rx="15" ry="7" fill="#E87968" />
      <circle cx="-6" cy="-11" r="3.2" fill="#F5D98B" />
      <circle cx="5" cy="-12" r="2.6" fill="#F4ECD8" />
      <path d="M-20 -8 H20 C 18 6, 9 13, 0 13 C -9 13, -18 6, -20 -8 Z" fill="#FFE28A" stroke="#102F46" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M-11 13 H11" stroke="#102F46" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

function Route({
  geo,
  step,
  drawn,
  marker,
  refPath,
  refMarker,
}: {
  geo: RouteDef;
  step: number;
  drawn: boolean;
  marker: boolean;
  refPath: (el: SVGPathElement | null) => void;
  refMarker: (el: SVGGElement | null) => void;
}) {
  return (
    <svg viewBox={geo.viewBox} className="h-auto w-full overflow-visible" aria-hidden>
      <path d={geo.d} fill="none" stroke="rgba(244,236,216,.12)" strokeWidth="10" strokeLinecap="round" />
      <path
        ref={refPath}
        d={geo.d}
        fill="none"
        stroke="#FFE28A"
        strokeWidth="4"
        strokeLinecap="round"
        pathLength={1}
        style={{ strokeDasharray: 1, strokeDashoffset: drawn ? 0 : 1, transition: "stroke-dashoffset 1.6s cubic-bezier(.65,0,.35,1)" }}
      />
      {geo.nodes.map(([x, y], i) => {
        const lit = i <= step;
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            <circle r="26" fill={lit ? "rgba(255,226,138,.22)" : "rgba(130,197,223,.12)"} style={{ transition: "fill .5s" }} />
            <circle r="15" fill={lit ? "#FFE28A" : "#164B70"} stroke={lit ? "#102F46" : "#82C5DF"} strokeWidth="3" style={{ transition: "fill .5s, stroke .5s" }} />
            <text
              y={geo.label(i)}
              textAnchor="middle"
              className="font-label"
              fontSize="18"
              fontWeight="700"
              letterSpacing="2"
              fill={lit ? "#FFE28A" : "rgba(244,236,216,.6)"}
              style={{ transition: "fill .5s" }}
            >
              {STOPS[i].name.toUpperCase()}
            </text>
          </g>
        );
      })}
      <g ref={refMarker} style={{ opacity: marker ? 1 : 0, transition: "opacity .4s" }}>
        <Thali />
      </g>
    </svg>
  );
}

export function FiveStops() {
  const section = useRef<HTMLElement>(null);
  const paths = useRef<{ d: SVGPathElement | null; m: SVGPathElement | null }>({ d: null, m: null });
  const markers = useRef<{ d: SVGGElement | null; m: SVGGElement | null }>({ d: null, m: null });
  const geo = useRef<{ d?: Geometry; m?: Geometry }>({});
  const [stepState, setStep] = useState(-1);
  const [drawnState, setDrawn] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(false);
  const reduced = useReducedMotion();
  // reduced motion: everything static and fully visible
  const step = reduced ? STOPS.length - 1 : stepState;
  const drawn = reduced || drawnState;
  const pos = useRef(0); // stop index the marker is at (fractional while travelling)
  const raf = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const place = useCallback((at: number) => {
    pos.current = at;
    for (const k of ["d", "m"] as const) {
      const g = geo.current[k];
      const marker = markers.current[k];
      if (!g || !marker) continue;
      const i = Math.min(Math.floor(at), g.lengths.length - 2);
      const t = at - i;
      const len = g.lengths[i] + (g.lengths[i + 1] - g.lengths[i]) * t;
      const p = g.path.getPointAtLength(len);
      const ahead = g.path.getPointAtLength(Math.min(len + 2, g.path.getTotalLength()));
      const angle = Math.max(-18, Math.min(18, (Math.atan2(ahead.y - p.y, ahead.x - p.x) * 180) / Math.PI * (k === "d" ? 0.35 : 0)));
      marker.setAttribute("transform", `translate(${p.x} ${p.y - 30}) rotate(${angle})`);
    }
  }, []);

  // measure both routes once mounted
  useEffect(() => {
    for (const [k, def] of [["d", DESKTOP], ["m", MOBILE]] as const) {
      const p = paths.current[k];
      if (p) geo.current[k] = { path: p, lengths: measure(p, def.nodes) };
    }
    place(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? STOPS.length - 1 : 0);
    const io = new IntersectionObserver(([e]) => setInView(Boolean(e?.isIntersecting)), { threshold: 0.35 });
    if (section.current) io.observe(section.current);
    return () => io.disconnect();
  }, [place]);

  // auto-play when visible
  useEffect(() => {
    if (reduced || !inView || !playing) return;
    const firstRun = !drawnState;
    const travel = (from: number) => {
      const start = performance.now();
      const frame = (now: number) => {
        const p = Math.min((now - start) / TRAVEL_MS, 1);
        const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        place(from + eased);
        if (p < 1) raf.current = requestAnimationFrame(frame);
        else {
          setStep(from + 1);
          timer.current = setTimeout(next, from + 1 === STOPS.length - 1 ? REST_MS : HOLD_MS);
        }
      };
      raf.current = requestAnimationFrame(frame);
    };
    const next = () => {
      const at = Math.round(pos.current);
      if (at >= STOPS.length - 1) {
        setStep(0);
        place(0);
        timer.current = setTimeout(next, HOLD_MS);
      } else travel(at);
    };
    timer.current = setTimeout(
      () => {
        if (firstRun) {
          setDrawn(true);
          setStep(0);
          timer.current = setTimeout(next, 1800);
        } else next();
      },
      firstRun ? 0 : 600,
    );
    return () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, playing, reduced]);

  const goTo = (i: number) => {
    setPlaying(false);
    setDrawn(true);
    setStep(i);
    place(i);
  };

  const active = Math.max(step, 0);

  return (
    <section ref={section} aria-labelledby="stops-title" className="grain relative overflow-hidden bg-ink py-24 text-cream">
      <div className="relative z-[2] mx-auto max-w-[1320px] px-5 md:px-8">
        <p className="font-label text-[13px] font-semibold tracking-[0.22em] text-sky">03 / THE JOURNEY</p>
        <h2 id="stops-title" className="font-display mt-4 text-[clamp(2.4rem,5vw,4.6rem)] font-semibold leading-[1.02]">
          Five stops from <em className="text-sunshine">surplus</em> to <em className="text-sunshine">served.</em>
        </h2>

        <div className="mt-12 hidden md:block">
          <Route geo={DESKTOP} step={step} drawn={drawn} marker={drawn} refPath={(el) => (paths.current.d = el)} refMarker={(el) => (markers.current.d = el)} />
        </div>
        <div className="mx-auto mt-10 max-w-sm md:hidden">
          <Route geo={MOBILE} step={step} drawn={drawn} marker={drawn} refPath={(el) => (paths.current.m = el)} refMarker={(el) => (markers.current.m = el)} />
        </div>

        <ol className="mt-10 grid gap-4 md:grid-cols-5">
          {STOPS.map((s, i) => (
            <li
              key={s.name}
              className={cn(
                "rounded-[22px] border-t-2 p-4 transition-colors duration-500",
                i === active ? "border-sunshine bg-cream/[.07]" : "border-sky/30",
                !reduced && i > step && "opacity-60",
              )}
              aria-current={i === active ? "step" : undefined}
            >
              <p className="flex items-baseline gap-2">
                <span className="font-label text-xs text-sky">0{i + 1}</span>
                <span className="font-display text-xl font-semibold">{s.name}</span>
              </p>
              <p className="mt-1 text-sm leading-relaxed text-cream/85">{s.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            disabled={reduced}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-label text-sm font-semibold text-cream ring-2 ring-cream/70 hover:bg-cream hover:text-ink disabled:opacity-40"
          >
            {playing && !reduced ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {playing && !reduced ? "Pause" : "Play"}
          </button>
          <div role="group" aria-label="Journey steps" className="flex gap-2">
            {STOPS.map((s, i) => (
              <button
                key={s.name}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Step ${i + 1}: ${s.name}`}
                aria-pressed={i === active}
                className="grid size-11 place-items-center rounded-full"
              >
                <span className={cn("block size-3 rounded-full transition-colors", i === active ? "bg-sunshine" : "bg-cream/35")} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        .fs-steam path { animation: steam 1.6s ease-in-out infinite; }
        .fs-steam path:nth-child(2) { animation-delay: .3s; }
        .fs-steam path:nth-child(3) { animation-delay: .6s; }
        @keyframes steam { 0% { opacity: 0; transform: translateY(4px); } 40% { opacity: .9; } 100% { opacity: 0; transform: translateY(-6px); } }
      `}</style>
    </section>
  );
}
