import type { ReactNode } from "react";

import { Container, Kicker } from "@/components/landing/primitives";
import { getLandingData } from "@/lib/landing-data";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** Shared chrome for public pages: solid header, ink title band with a wave edge, footer. */
export async function PublicPage({
  kicker,
  title,
  lead,
  children,
}: {
  kicker: string;
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
}) {
  const { faqs } = await getLandingData();
  return (
    <>
      <SiteHeader faqs={faqs.map((f) => ({ id: f.id, question: f.question }))} />
      <main id="main" className="bg-bg text-text">
        <section className="grain relative overflow-hidden bg-ink pb-24 pt-36 text-cream">
          <Container className="relative z-[2]">
            <Kicker className="text-sunshine">{kicker}</Kicker>
            <h1 className="font-display mt-4 max-w-4xl text-[clamp(2.6rem,5.5vw,4.8rem)] font-semibold leading-[1.02]">{title}</h1>
            {lead && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-cream/85">{lead}</p>}
          </Container>
          <svg aria-hidden viewBox="0 0 1440 90" preserveAspectRatio="none" className="absolute inset-x-0 -bottom-px h-[48px] w-full md:h-[72px]">
            <path d="M0 60 C 240 10, 420 10, 640 46 C 860 82, 1080 86, 1260 50 C 1340 34, 1400 30, 1440 34 V90 H0 Z" fill="var(--bg)" />
          </svg>
        </section>
        <div className="pb-24 pt-10">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <Container>
      <div className="max-w-3xl space-y-5 text-lg leading-relaxed text-text [&_a]:text-[var(--link)] [&_a]:underline [&_h2]:font-display [&_h2]:pt-6 [&_h2]:text-3xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted [&_ul]:space-y-2 [&_ul]:text-muted">
        {children}
      </div>
    </Container>
  );
}
