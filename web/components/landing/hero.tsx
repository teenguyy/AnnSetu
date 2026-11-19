import { Fragment } from "react";
import { HandHeart, Sparkle, Store, UserCheck, Users } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import type { Snapshot } from "@/lib/landing-data";
import { compactNumber, formatDate } from "@/lib/utils";

import { HeroCollage } from "./hero-collage";
import { HeroHands } from "./hero-hands";

const HEADLINE = ["Good", "food", "deserves", "a"];

const steps = [
  { icon: Store, title: "Donor", sub: "Shares food" },
  { icon: HandHeart, title: "NGO", sub: "Receives food" },
  { icon: UserCheck, title: "Representative", sub: "Collects food" },
  { icon: Users, title: "Community", sub: "Gets food" },
];

function Backdrop() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1440 900">
      <g className="hero-drift-a">
        <path d="M980 -40 C 1180 40, 1300 160, 1480 120 V -40 Z" fill="#287FA6" opacity=".55" />
        <path d="M1060 260 C 1200 200, 1320 260, 1480 220 V 620 C 1360 640, 1220 560, 1120 600 Z" fill="#F5D98B" opacity=".92" />
      </g>
      <g className="hero-drift-b">
        <path d="M-60 520 C 120 470, 260 560, 420 520 C 520 496, 560 560, 600 640 V 900 H -60 Z" fill="#164B70" opacity=".7" />
        <circle cx="1180" cy="120" r="120" fill="#82C5DF" opacity=".16" />
      </g>
      <g className="hero-clouds" fill="#E8F4F9" opacity=".22">
        <ellipse cx="760" cy="760" rx="200" ry="46" />
        <ellipse cx="880" cy="740" rx="130" ry="40" />
        <ellipse cx="1240" cy="800" rx="180" ry="40" />
      </g>
      <g className="hero-leaves" fill="#102F46" opacity=".55">
        <path d="M1400 640 C 1340 600, 1330 520, 1380 470 C 1420 520, 1430 590, 1400 640 Z" />
        <path d="M1420 700 C 1360 690, 1320 640, 1330 590 C 1380 610, 1410 650, 1420 700 Z" />
        <path d="M30 330 C 90 300, 140 320, 160 370 C 110 380, 60 370, 30 330 Z" />
      </g>
    </svg>
  );
}

export function Hero({ snapshot }: { snapshot: Snapshot | null }) {
  const hasImpact = Boolean(snapshot && snapshot.completed_pickups > 0);
  return (
    <section aria-labelledby="hero-title" className="grain relative isolate overflow-hidden bg-ink text-cream">
      <Backdrop />
      <div className="relative z-[2] mx-auto grid min-h-[100svh] max-w-[1320px] grid-cols-1 gap-y-6 px-5 pb-10 pt-28 md:px-8 lg:grid-cols-12 lg:pt-32">
        {/* hands: above the text on mobile, centre column on desktop */}
        <div className="order-1 mx-auto -mt-28 w-[min(78vw,340px)] lg:order-2 lg:col-span-4 lg:col-start-6 lg:-mt-32 lg:w-full lg:max-w-[460px] lg:self-start">
          <HeroHands className="h-auto w-full lg:overflow-visible" />
        </div>

        <div className="order-2 lg:order-1 lg:col-span-5 lg:row-start-1 lg:self-center">
          <p className="hero-rise flex items-center gap-3 font-label text-[13px] font-semibold tracking-[0.22em] text-sunshine">
            A BETTER TOMORROW, TOGETHER <span aria-hidden className="h-px w-16 bg-sunshine/70" />
          </p>
          <h1 id="hero-title" className="font-display mt-5 text-[clamp(2.9rem,6.4vw,5.6rem)] font-semibold leading-[0.98] text-cream">
            {HEADLINE.map((w, i) => (
              <Fragment key={w + i}>
                <span className="hero-word" style={{ animationDelay: `${0.15 + i * 0.09}s` }}>
                  {w}
                </span>{" "}
              </Fragment>
            ))}
            <em className="hero-word block font-medium text-sunshine" style={{ animationDelay: "0.55s" }}>
              second journey.
            </em>
          </h1>
          <p className="hero-rise mt-6 max-w-md text-lg leading-relaxed text-cream/85" style={{ animationDelay: "0.75s" }}>
            Connecting surplus food with the people who need it. One meaningful connection at a time.
          </p>
          <div className="hero-rise mt-8 flex flex-wrap gap-4" style={{ animationDelay: "0.9s" }}>
            <ButtonLink href="/donate" size="xl" arrow>
              Donate Surplus
            </ButtonLink>
            <ButtonLink href="/explore" variant="outline" size="xl" icon={<Sparkle className="size-4" aria-hidden />}>
              Explore Food
            </ButtonLink>
          </div>
        </div>

        {/* collage: right column on desktop, curved card below on mobile */}
        <div className="relative order-3 lg:col-span-3 lg:col-start-10 lg:row-start-1 lg:self-center">
          <HeroCollage className="mx-auto h-auto w-full max-w-[380px] drop-shadow-[0_24px_40px_rgba(0,0,0,.35)]" />
          <p className="absolute bottom-2 left-8 flex rotate-[-3deg] items-end gap-1 whitespace-nowrap font-hand text-[1.35rem] leading-none text-cream drop-shadow-[0_2px_6px_rgba(16,47,70,.9)] lg:left-5">
            Together we can end food waste.
            <svg aria-hidden viewBox="0 0 80 40" className="hero-arrow h-6 w-10 shrink-0">
              <path d="M4 6 C 30 4, 52 14, 66 32 M58 30 L67 33 L66 23" fill="none" stroke="#FFE28A" strokeWidth="3" strokeLinecap="round" pathLength={1} />
            </svg>
          </p>
        </div>

        {/* journey band + impact card */}
        <div className="relative z-[3] order-4 mt-6 grid gap-5 lg:col-span-12 lg:grid-cols-12 lg:items-end">
          <div className="relative overflow-hidden rounded-[32px] bg-butter px-6 py-6 text-ink lg:col-span-8">
            <svg aria-hidden viewBox="0 0 800 40" preserveAspectRatio="none" className="absolute inset-x-0 -top-px h-6 w-full">
              <path d="M0 0 H800 V10 C 640 40, 480 0, 320 18 C 180 34, 80 8, 0 22 Z" fill="#102F46" />
            </svg>
            <div className="relative flex flex-col gap-5 pt-3 md:flex-row md:items-center">
              <p className="shrink-0 font-hand text-[1.75rem] leading-none text-deep-ocean">
                The AnnSetu
                <br />
                Journey <span aria-hidden>↝</span>
              </p>
              <ol className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
                {steps.map((s, i) => (
                  <li key={s.title} className="journey-step relative flex flex-col items-center text-center" style={{ animationDelay: `${i * 1.2}s` }}>
                    <span className="journey-dot grid size-14 place-items-center rounded-full bg-cream text-deep-ocean ring-2 ring-ink/15">
                      <s.icon className="size-6" aria-hidden />
                    </span>
                    <span className="mt-2 font-label text-sm font-semibold">{s.title}</span>
                    <span className="text-xs text-ink/75">{s.sub}</span>
                    {i < steps.length - 1 && (
                      <span aria-hidden className="absolute right-[-14%] top-6 hidden text-ink/50 sm:block">
                        →
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="relative lg:col-span-4">
            <span className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-sunshine px-4 py-1.5 font-label text-sm font-semibold text-ink shadow-[0_0_0_2px_var(--ink)]">
              Our Impact ✦
            </span>
            <div className="rounded-[28px] bg-[#0B2234] px-6 pb-5 pt-8 ring-1 ring-cream/10">
              {hasImpact && snapshot ? (
                <>
                  <dl className="grid grid-cols-3 divide-x divide-cream/15 text-center">
                    <div className="px-2">
                      <dd className="font-stat text-3xl font-bold text-sunshine">
                        <CountUp value={snapshot.meals_est} format={compactNumber} />
                      </dd>
                      <dt className="mt-1 text-xs text-cream/80" title={snapshot.meals_method}>
                        Meals saved (est.)
                      </dt>
                    </div>
                    <div className="px-2">
                      <dd className="font-stat text-3xl font-bold text-sunshine">
                        <CountUp value={snapshot.verified_receivers} />
                      </dd>
                      <dt className="mt-1 text-xs text-cream/80">Verified NGOs</dt>
                    </div>
                    <div className="px-2">
                      <dd className="font-stat text-3xl font-bold text-sunshine">
                        {snapshot.co2_kg_est != null ? <CountUp value={snapshot.co2_kg_est} format={compactNumber} /> : "—"}
                      </dd>
                      <dt className="mt-1 text-xs text-cream/80" title={snapshot.co2_method ?? undefined}>
                        Kg CO₂ prevented (est.)
                      </dt>
                    </div>
                  </dl>
                  <p className="mt-3 text-center text-[11px] text-cream/60">Updated {formatDate(snapshot.generated_at)} · estimates explained on Impact</p>
                </>
              ) : (
                <p className="py-2 text-center text-sm leading-relaxed text-cream/85">
                  Our numbers start with the first OTP-confirmed pickups. Every figure here will be real, never estimated without saying so.
                </p>
              )}
            </div>
          </div>
        </div>

        <a href="#paradox" className="order-5 hidden items-center gap-3 self-end text-sm text-cream/70 hover:text-cream lg:col-span-3 lg:flex">
          <span aria-hidden className="relative h-9 w-6 rounded-full border-2 border-cream/60">
            <span className="hero-wheel absolute left-1/2 top-1.5 h-2 w-1 -translate-x-1/2 rounded-full bg-cream/80" />
          </span>
          Scroll to explore
        </a>
      </div>

      <style>{`
        .hero-word { display: inline-block; opacity: 0; transform: translateY(.45em); animation: hero-in .9s cubic-bezier(.22,1,.36,1) forwards; }
        .hero-rise { opacity: 0; transform: translateY(16px); animation: hero-in .8s cubic-bezier(.22,1,.36,1) forwards; }
        @keyframes hero-in { to { opacity: 1; transform: none; } }
        .hero-drift-a { animation: drift 26s ease-in-out infinite alternate; }
        .hero-drift-b { animation: drift 32s ease-in-out infinite alternate-reverse; }
        .hero-clouds { animation: clouds 60s linear infinite alternate; }
        .hero-leaves path { transform-box: fill-box; transform-origin: bottom center; animation: sway 7s ease-in-out infinite alternate; }
        @keyframes drift { to { transform: translate(-10px, 8px); } }
        @keyframes clouds { to { transform: translateX(-60px); } }
        @keyframes sway { from { transform: rotate(-1.5deg); } to { transform: rotate(1.5deg); } }
        .hero-arrow path { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 1.2s 1.4s ease forwards; }
        @keyframes draw { to { stroke-dashoffset: 0; } }
        .journey-step .journey-dot { animation: step-glow 4.8s ease-in-out infinite; }
        @keyframes step-glow { 0%, 20%, 100% { background: var(--cream); } 8%, 14% { background: var(--sunshine); box-shadow: 0 0 0 6px rgba(255,226,138,.45); } }
        .hero-wheel { animation: wheel 1.8s ease-in-out infinite; }
        @keyframes wheel { 0% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, 10px); } }
      `}</style>
    </section>
  );
}
