import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/landing/primitives";
import { RealImpact } from "@/components/landing/sections";
import { PublicPage } from "@/components/site/public-page";
import { getLandingData } from "@/lib/landing-data";
import { compactNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Impact", description: "Real, OTP-confirmed impact: meals, kilograms and pickups." };

export default async function ImpactPage() {
  const { snapshot } = await getLandingData();
  return (
    <PublicPage kicker="Impact" title={<>Counted honestly, <em className="text-sunshine">every time.</em></>}>
      <div className="-mt-10 pt-20">
        <RealImpact snapshot={snapshot} />
      </div>
      <Container className="mt-16 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-semibold">How we measure</h2>
          <ul className="mt-5 space-y-3 text-muted">
            <li>Only pickups the donor confirms with the receiver’s 4-digit code are counted.</li>
            <li>Meals (est.) = portions + kilograms ÷ 0.42, using WRAP’s 420 g meal equivalent. Packs are not converted.</li>
            <li>CO₂ (est.) = kilograms × an emissions factor published by FAO (2013, Food Wastage Footprint). The factor is shown wherever the estimate appears.</li>
            <li>Numbers refresh weekly; each refresh is dated.</li>
          </ul>
        </div>
        <div>
          <h2 className="font-display text-3xl font-semibold">Top donors this week</h2>
          {snapshot && snapshot.top_donors_week.length > 0 ? (
            <ol className="mt-5 divide-y divide-line overflow-hidden rounded-[24px] bg-surface-2 ring-1 ring-line">
              {snapshot.top_donors_week.map((d, i) => (
                <li key={d.name} className="flex items-center justify-between px-5 py-4">
                  <span><span className="mr-3 font-stat font-bold text-ocean">{i + 1}</span>{d.name}{d.city ? `, ${d.city}` : ""}</span>
                  <span className="font-label font-semibold">{compactNumber(d.units)} units</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-5 rounded-[24px] bg-surface-2 p-6 text-muted ring-1 ring-line">No completed pickups this week yet.</p>
          )}
          <Link href="/leaderboard" className="mt-4 inline-block font-label font-semibold text-[var(--link)] underline-offset-4 hover:underline">
            See the full leaderboard →
          </Link>
        </div>
      </Container>
    </PublicPage>
  );
}
