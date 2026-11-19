import type { Metadata } from "next";

import { FiveStops } from "@/components/landing/five-stops";
import { PublicPage } from "@/components/site/public-page";

export const metadata: Metadata = { title: "How it works", description: "Five stops from surplus to served." };

export default function HowItWorksPage() {
  return (
    <PublicPage kicker="How it works" title={<>Five stops from surplus <em className="text-sunshine">to served.</em></>}>
      <div className="-mb-24 -mt-10">
        <FiveStops />
      </div>
    </PublicPage>
  );
}
