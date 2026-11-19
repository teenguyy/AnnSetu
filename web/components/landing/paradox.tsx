import { ExternalLink } from "lucide-react";

import type { Fact } from "@/lib/landing-data";
import { formatDate } from "@/lib/utils";

import { Container, Kicker, SectionTitle } from "./primitives";

/** Food waste vs hunger, with admin-curated facts that always show their source and check date. */
export function Paradox({ facts }: { facts: Fact[] }) {
  return (
    <section id="paradox" aria-labelledby="paradox-title" className="relative overflow-hidden bg-bg py-24 text-text">
      <Container>
        <Kicker className="text-ocean">The paradox</Kicker>
        <SectionTitle id="paradox-title" className="max-w-3xl">
          Food is wasted <em className="text-ocean">while</em> people go hungry.
        </SectionTitle>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          The problem isn’t a lack of food. It’s the missing bridge between the kitchen with too much and the community with too little.
        </p>

        {facts.length > 0 ? (
          <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {facts.map((f) => (
              <li key={f.id} className="flex flex-col rounded-[28px] bg-surface-2 p-7 shadow-soft ring-1 ring-line">
                {f.stat_value && <p className="font-stat text-4xl font-bold text-deep-ocean dark:text-sky">{f.stat_value}</p>}
                <p className="mt-3 font-display text-xl font-semibold">{f.headline}</p>
                {f.detail && <p className="mt-2 text-muted">{f.detail}</p>}
                <p className="mt-auto pt-5 text-sm text-muted">
                  Source:{" "}
                  <a href={f.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-[var(--link)] underline-offset-4 hover:underline">
                    {f.source_name}
                    <ExternalLink className="size-3.5" aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                  <br />
                  Last verified {formatDate(f.verified_at)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-12 rounded-[28px] bg-surface-2 p-7 text-muted ring-1 ring-line">
            Sourced facts will appear here once the AnnSetu team has verified them.
          </p>
        )}
      </Container>

      <div aria-hidden className="mt-20 overflow-hidden whitespace-nowrap py-2">
        <div className="paradox-marquee inline-block font-display text-[clamp(3rem,9vw,8rem)] font-semibold italic leading-none text-transparent [-webkit-text-stroke:1.5px_var(--ocean)]">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="mx-6">
              waste · hunger ·
            </span>
          ))}
        </div>
      </div>
      <style>{`
        .paradox-marquee { animation: marquee 40s linear infinite; }
        @keyframes marquee { to { transform: translateX(-50%); } }
      `}</style>
    </section>
  );
}
