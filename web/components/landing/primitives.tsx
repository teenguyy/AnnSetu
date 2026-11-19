import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Organic curved divider echoing the logo's wave. `fill` is the colour of the section below. */
export function WaveDivider({ fill, flip = false, className }: { fill: string; flip?: boolean; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 90"
      preserveAspectRatio="none"
      className={cn("block h-[48px] w-full md:h-[80px]", flip && "rotate-180", className)}
    >
      <path d="M0 60 C 240 10, 420 10, 640 46 C 860 82, 1080 86, 1260 50 C 1340 34, 1400 30, 1440 34 V90 H0 Z" fill={fill} />
    </svg>
  );
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-3 font-label text-[13px] font-semibold tracking-[0.22em] uppercase", className)}>
      {children}
      <span aria-hidden className="h-px w-12 bg-current opacity-60" />
    </p>
  );
}

export function SectionTitle({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cn("font-display mt-4 text-[clamp(2.2rem,4.6vw,4rem)] font-semibold leading-[1.02]", className)}>
      {children}
    </h2>
  );
}

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto max-w-[1320px] px-5 md:px-8", className)}>{children}</div>;
}
