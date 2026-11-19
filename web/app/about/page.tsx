import type { Metadata } from "next";

import { Mission } from "@/components/landing/mission";
import { Paradox } from "@/components/landing/paradox";
import { PublicPage } from "@/components/site/public-page";
import { getLandingData } from "@/lib/landing-data";

export const metadata: Metadata = { title: "About", description: "AnnSetu is a bridge for food, not a delivery fleet." };

export default async function AboutPage() {
  const { facts } = await getLandingData();
  return (
    <PublicPage
      kicker="About AnnSetu"
      title={<>A bridge <em className="text-sunshine">for food.</em></>}
      lead="AnnSetu connects verified donors with verified receivers. We coordinate pickups; receivers’ own representatives collect the food."
    >
      <div className="-mt-10">
        <Paradox facts={facts} />
        <div className="pt-20">
          <Mission />
        </div>
      </div>
    </PublicPage>
  );
}
