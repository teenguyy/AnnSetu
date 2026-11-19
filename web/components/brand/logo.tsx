import { cn } from "@/lib/utils";

/** Wave (bridge deck) and its first half, which the food node travels along. */
const WAVE = "M8 70 C 26 52, 48 54, 74 78 C 88 90, 104 88, 114 72";
const WAVE_FIRST = "M8 70 C 26 52, 48 54, 74 78";

type MarkProps = {
  className?: string;
  animated?: boolean;
  /** "color" (default), "reverse" for dark backgrounds, "mono" single colour */
  variant?: "color" | "reverse" | "mono";
  title?: string;
};

/** The "A-bridge" mark: a cable-stayed pylon shaped like an A, a wave deck and a sunshine node. */
export function LogoMark({ className, animated = false, variant = "color", title = "AnnSetu" }: MarkProps) {
  const mono = variant === "mono";
  const pylon = mono ? "currentColor" : variant === "reverse" ? "#F4ECD8" : "#164B70";
  const cable = mono ? "currentColor" : variant === "reverse" ? "#82C5DF" : "#287FA6";
  const deck = mono ? "currentColor" : variant === "reverse" ? "#82C5DF" : "#287FA6";
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={title} className={cn("logo-mark", animated && "is-animated", className)}>
      <title>{title}</title>
      {/* cable stays */}
      <g stroke={cable} strokeWidth="1.6" strokeLinecap="round" opacity={mono ? 0.6 : 1}>
        <path d="M63 16 L22 66" />
        <path d="M63 16 L33 62" />
        <path d="M63 16 L44 60" />
        <path d="M66 16 L84 66" />
        <path d="M66 16 L95 72" />
        <path d="M66 16 L105 78" />
      </g>
      {/* pylon legs (slightly italic) with serif feet */}
      <g fill={pylon}>
        <path d="M58 10 h7 L35 100 h-7 Z" />
        <path d="M62 10 h12 L90 100 h-13 Z" />
        <rect x="20" y="99" width="24" height="4.5" rx="1" />
        <rect x="72" y="99" width="27" height="4.5" rx="1" />
      </g>
      {/* deck wave */}
      <path className="logo-wave" d={WAVE} fill="none" stroke={deck} strokeWidth="7" strokeLinecap="round" pathLength={1} />
      {/* food node travelling the bridge */}
      <g className="logo-node" style={{ offsetPath: `path("${WAVE_FIRST}")` }}>
        <circle r="6.5" fill={mono ? "none" : "#FFE28A"} stroke={mono ? "currentColor" : "#102F46"} strokeWidth="3" />
      </g>
      <style>{`
        .logo-node { offset-distance: 100%; offset-rotate: 0deg; }
        .logo-mark.is-animated .logo-wave { stroke-dasharray: 1; stroke-dashoffset: 1; animation: logo-draw .7s cubic-bezier(.65,0,.35,1) .1s forwards; }
        .logo-mark.is-animated .logo-node { offset-distance: 0%; opacity: 0; animation: logo-node .6s cubic-bezier(.22,1,.36,1) .65s forwards; }
        @keyframes logo-draw { to { stroke-dashoffset: 0; } }
        @keyframes logo-node { from { opacity: 1; offset-distance: 0%; } to { opacity: 1; offset-distance: 100%; } }
      `}</style>
    </svg>
  );
}

/** Full logo: mark, sunshine swoosh with sparkle, wordmark and tagline. */
export function Logo({
  className,
  tone = "dark",
  animated = false,
  showTagline = true,
}: {
  className?: string;
  /** background the logo sits on */
  tone?: "dark" | "light";
  animated?: boolean;
  showTagline?: boolean;
}) {
  const dark = tone === "dark";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="h-11 w-11 shrink-0" animated={animated} variant={dark ? "reverse" : "color"} />
      <span className="relative flex flex-col leading-none">
        <svg aria-hidden viewBox="0 0 140 18" className="absolute -top-3 left-0 h-3.5 w-[120%] overflow-visible">
          <path d="M2 15 C 40 2, 96 2, 132 10" fill="none" stroke="#FFE28A" strokeWidth="2" strokeLinecap="round" />
          <path d="M126 2 l1.4 3.6 3.6 1.4 -3.6 1.4 -1.4 3.6 -1.4 -3.6 -3.6 -1.4 3.6 -1.4z" fill="#FFE28A" />
        </svg>
        <span className="font-display text-[1.6rem] font-semibold italic tracking-tight">
          <span className={dark ? "text-cream" : "text-ink"}>Ann</span>
          <span className={dark ? "text-sunshine" : "text-deep-ocean"}>Setu</span>
        </span>
        {showTagline && (
          <span
            className={cn(
              "mt-1 whitespace-nowrap font-label text-[0.5rem] font-medium tracking-[0.3em] sm:text-[0.56rem] sm:tracking-[0.32em]",
              dark ? "text-light-blue" : "text-muted",
            )}
          >
            CONNECT · SHARE · NOURISH
          </span>
        )}
      </span>
    </span>
  );
}
