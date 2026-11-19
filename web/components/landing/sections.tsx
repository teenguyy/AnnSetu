import { Bell, MapPinned, QrCode, ShieldCheck, Smartphone, Soup, Store, Users } from "lucide-react";
import QRCode from "qrcode";

import { ButtonLink } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import type { AppSection as AppSettings, Snapshot, Testimonial } from "@/lib/landing-data";
import { compactNumber, formatDate } from "@/lib/utils";

import { Container, Kicker, SectionTitle, WaveDivider } from "./primitives";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function Experiences() {
  const panels = [
    {
      key: "give",
      kicker: "For donors",
      title: "Give",
      lead: "Restaurants, hotels, canteens, caterers, event organisers and community kitchens.",
      steps: ["Verify your kitchen once", "List surplus in under a minute, with photos", "Accept requests from nearby NGOs", "Confirm pickup with the 4-digit code"],
      cta: { href: "/sign-up?role=donor", label: "Join as a donor" },
      cls: "bg-butter text-ink rounded-[40px_120px_40px_40px]",
      icon: Store,
      btn: "solid" as const,
    },
    {
      key: "receive",
      kicker: "For receivers",
      title: "Receive",
      lead: "NGOs, shelters, orphanages, old-age homes, community kitchens and local groups.",
      steps: ["Verify your organisation (no certificate? we review manually)", "Discover food near you, nearest first", "Request and assign your representative", "Collect, then record your impact"],
      cta: { href: "/sign-up?role=ngo", label: "Join as a receiver" },
      cls: "bg-ocean text-cream rounded-[120px_40px_40px_40px]",
      icon: Users,
      btn: "primary" as const,
    },
  ];
  return (
    <section aria-labelledby="exp-title" className="bg-bg py-24 text-text">
      <Container>
        <Kicker className="text-ocean">Two sides of one bridge</Kicker>
        <SectionTitle id="exp-title">Give, or receive.</SectionTitle>
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {panels.map((p) => (
            <article key={p.key} className={`p-8 md:p-10 ${p.cls}`}>
              <p.icon className="size-8" aria-hidden />
              <p className="mt-4 font-label text-sm font-semibold tracking-[0.18em] uppercase opacity-80">{p.kicker}</p>
              <h3 className="font-display text-5xl font-semibold">{p.title}</h3>
              <p className="mt-3 max-w-md text-lg opacity-90">{p.lead}</p>
              <ol className="mt-6 space-y-3">
                {p.steps.map((s, i) => (
                  <li key={s} className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-current/10 font-label text-sm font-bold ring-1 ring-current/30">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>
              <ButtonLink href={p.cta.href} variant={p.btn} size="lg" arrow className="mt-8">
                {p.cta.label}
              </ButtonLink>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function RealImpact({ snapshot }: { snapshot: Snapshot | null }) {
  const has = Boolean(snapshot && snapshot.completed_pickups > 0);
  const stats = snapshot
    ? [
        { value: snapshot.meals_est, label: "Meals (est.)", method: snapshot.meals_method },
        { value: snapshot.kg, label: "Kg redistributed" },
        { value: snapshot.completed_pickups, label: "Completed pickups", method: "Only pickups confirmed with the donor’s 4-digit code count." },
        { value: snapshot.verified_donors, label: "Verified donors" },
        { value: snapshot.verified_receivers, label: "Verified receivers" },
        { value: snapshot.cities, label: "Cities served" },
      ]
    : [];
  return (
    <section aria-labelledby="impact-title" className="relative bg-ink text-cream">
      <WaveDivider fill="var(--ink)" className="absolute inset-x-0 bottom-full" />
      <Container className="py-20">
        <Kicker className="text-sunshine">Real impact</Kicker>
        <SectionTitle id="impact-title">Every number here is real.</SectionTitle>
        {has && snapshot ? (
          <>
            <dl className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-[28px] bg-cream/10 md:grid-cols-3">
              {stats.map((s) => (
                <div key={s.label} className="bg-ink p-6 md:p-8">
                  <dd className="font-stat text-[clamp(2.2rem,5vw,3.6rem)] font-bold text-sunshine">
                    <CountUp value={s.value} format={compactNumber} />
                  </dd>
                  <dt className="mt-1 text-cream/85">
                    {s.label}
                    {s.method && <span className="mt-1 block text-xs text-cream/60">{s.method}</span>}
                  </dt>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-cream/65">
              Updated {formatDate(snapshot.generated_at)} · refreshed weekly
              {snapshot.co2_kg_est != null && ` · CO₂ (est.) ${compactNumber(snapshot.co2_kg_est)} kg: ${snapshot.co2_method}`}
            </p>
          </>
        ) : (
          <div className="mt-10 max-w-2xl rounded-[28px] bg-cream/[.06] p-8 ring-1 ring-cream/10">
            <p className="text-lg">AnnSetu’s impact counter starts at zero and only moves when a donor confirms a real pickup with its code.</p>
            <p className="mt-3 text-cream/75">
              Meals are estimated as portions plus kilograms ÷ 0.42 (WRAP’s 420 g meal equivalent), always labelled “est.”.
            </p>
            <ButtonLink href="/impact" variant="outline" size="md" className="mt-6">
              How we measure impact
            </ButtonLink>
          </div>
        )}
      </Container>
    </section>
  );
}

export function Stories({ testimonials }: { testimonials: Testimonial[] }) {
  return (
    <section aria-labelledby="stories-title" className="bg-bg py-24 text-text">
      <Container>
        <Kicker className="text-ocean">Community stories</Kicker>
        <SectionTitle id="stories-title">Told by the people on the bridge.</SectionTitle>
        {testimonials.length > 0 ? (
          <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <li key={t.id} className="grain overflow-hidden rounded-[28px] bg-surface-2 p-7 shadow-soft ring-1 ring-line">
                <blockquote className="relative z-[2]">
                  <p className="font-display text-xl leading-snug">“{t.quote}”</p>
                  <footer className="mt-5 text-sm text-muted">
                    <strong className="font-label text-text">{t.author_name}</strong>
                    {t.author_role && `, ${t.author_role}`}
                    {t.org_name && ` · ${t.org_name}`}
                  </footer>
                </blockquote>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-10 max-w-2xl rounded-[28px] bg-surface-2 p-7 text-muted ring-1 ring-line">
            Stories appear here once partners share them and the AnnSetu team publishes them. We never write testimonials ourselves.
          </p>
        )}
      </Container>
    </section>
  );
}

const appFeatures = [
  { icon: Soup, text: "List surplus with photos from your phone’s camera" },
  { icon: MapPinned, text: "Turn-by-turn directions for representatives" },
  { icon: Bell, text: "Instant alerts for requests and pickups" },
  { icon: ShieldCheck, text: "Secure sign-in and OTP-confirmed handovers" },
];

export async function AppSection({ app }: { app: AppSettings }) {
  const playUrl = app.play_store_url?.startsWith("https://") ? app.play_store_url : null;
  const available = app.state === "available" && Boolean(playUrl || app.apk_path);
  const target = available ? (playUrl ?? `${siteUrl}/app`) : `${siteUrl}/app`;
  const qr = await QRCode.toString(target, { type: "svg", margin: 1, color: { dark: "#102F46", light: "#F4ECD8" } });
  return (
    <section id="app" aria-labelledby="app-title" className="relative bg-deep-ocean text-cream">
      <WaveDivider fill="var(--deep-ocean)" className="absolute inset-x-0 bottom-full" />
      <Container className="grid gap-12 py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <Kicker className="text-sunshine">The AnnSetu app</Kicker>
          <SectionTitle id="app-title">The bridge, in your pocket.</SectionTitle>
          <ul className="mt-8 space-y-4">
            {appFeatures.map((f) => (
              <li key={f.text} className="flex items-center gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-cream/10">
                  <f.icon className="size-5 text-sunshine" aria-hidden />
                </span>
                <span className="text-lg">{f.text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            {available ? (
              <ButtonLink href={playUrl ?? "/app"} size="xl" arrow icon={<Smartphone className="size-5" aria-hidden />}>
                Get it on Google Play
              </ButtonLink>
            ) : (
              <span className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-cream/10 px-6 font-label font-semibold ring-2 ring-cream/40">
                <Smartphone className="size-5" aria-hidden /> Android app coming soon
              </span>
            )}
            <div className="flex items-center gap-3">
              <span className="block size-24 overflow-hidden rounded-[14px] bg-cream p-1" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="max-w-[10rem] text-sm text-cream/80">
                <QrCode className="mb-1 size-4" aria-hidden />
                Scan to {available ? "download" : "open the app page"}
              </p>
            </div>
          </div>
        </div>
        <div className="relative mx-auto w-[260px]">
          <div className="rounded-[44px] bg-ink p-3 shadow-[0_40px_80px_-30px_rgba(0,0,0,.7)] ring-1 ring-cream/15">
            <div className="flex aspect-[9/19] flex-col items-center justify-center gap-4 overflow-hidden rounded-[34px] bg-[#0f3a59] p-6 text-center">
              <Smartphone className="size-10 text-sunshine" aria-hidden />
              <p className="font-display text-2xl">{available ? "AnnSetu for Android" : "Screenshots arrive with the first release"}</p>
              <p className="text-sm text-cream/75">Same account, same verified network, built for the street.</p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
