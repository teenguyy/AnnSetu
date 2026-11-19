import { BadgeCheck, MapPin, ShieldCheck } from "lucide-react";

import { LogoMark } from "@/components/brand/logo";

import { Container, Kicker, SectionTitle, WaveDivider } from "./primitives";

const pillars = [
  { icon: BadgeCheck, title: "Verified", body: "Every donor and receiver is checked by the AnnSetu team before they can list or request food." },
  { icon: ShieldCheck, title: "Accountable", body: "Each pickup is confirmed with a 4-digit code, and every admin action is recorded with a name." },
  { icon: MapPin, title: "Local", body: "Food goes to verified receivers nearby, nearest first, collected by their own representatives." },
];

export function Mission() {
  return (
    <section aria-labelledby="mission-title" className="relative bg-deep-ocean text-cream">
      <WaveDivider fill="var(--deep-ocean)" className="absolute inset-x-0 bottom-full" />
      <Container className="grid gap-14 py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <Kicker className="text-sunshine">Our mission</Kicker>
          <SectionTitle id="mission-title">
            A bridge, <em className="text-sunshine">not</em> a delivery fleet.
          </SectionTitle>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-cream/85">
            AnnSetu doesn’t drive trucks. We make the connection: donors list surplus, verified receivers request it, and their own
            representatives collect it, so food moves quickly through people who already serve their communities.
          </p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-3">
            {pillars.map((p) => (
              <li key={p.title} className="rounded-[24px] bg-ink/40 p-5 ring-1 ring-cream/10">
                <p.icon className="size-6 text-sunshine" aria-hidden />
                <p className="mt-3 font-label text-lg font-semibold">{p.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-cream/80">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative mx-auto grid w-full max-w-md place-items-center rounded-[40px] bg-[#0f3a59] p-10 ring-1 ring-cream/10">
          <LogoMark animated variant="reverse" className="h-44 w-44" />
          <p className="mt-6 text-center font-display text-3xl">
            <span lang="hi">अन्न</span> <span className="text-cream/60">+</span> <span lang="hi">सेतु</span>
          </p>
          <p className="mt-3 text-center text-cream/85">
            <strong className="font-label text-sunshine">Ann</strong> means food, grain. <strong className="font-label text-sunshine">Setu</strong> means
            bridge. Together: a bridge for food.
          </p>
        </div>
      </Container>
    </section>
  );
}
