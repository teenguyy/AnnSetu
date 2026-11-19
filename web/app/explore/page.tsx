import type { Metadata } from "next";

import { DiscoveryPreview } from "@/components/landing/discovery-preview";
import { Container } from "@/components/landing/primitives";
import { PublicPage } from "@/components/site/public-page";
import { getLandingData } from "@/lib/landing-data";

export const metadata: Metadata = { title: "Explore food", description: "Surplus food listed by verified donors near you." };

export default async function ExplorePage() {
  const data = await getLandingData();
  return (
    <PublicPage
      kicker="Explore food"
      title={<>Surplus food, <em className="text-sunshine">right now.</em></>}
      lead="A privacy-safe preview of current listings. Verified receivers sign in to see distance, safety notes and photos, and to request food for their representative to collect."
    >
      <Container>
        <DiscoveryPreview listings={data.preview} configured={data.configured} />
      </Container>
    </PublicPage>
  );
}
