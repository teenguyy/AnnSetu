import { DiscoveryPreview } from "@/components/landing/discovery-preview";
import { FiveStops } from "@/components/landing/five-stops";
import { Hero } from "@/components/landing/hero";
import { Join } from "@/components/landing/join";
import { Mission } from "@/components/landing/mission";
import { Paradox } from "@/components/landing/paradox";
import { Container, Kicker, SectionTitle } from "@/components/landing/primitives";
import { AppSection, Experiences, RealImpact, Stories } from "@/components/landing/sections";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getLandingData } from "@/lib/landing-data";

export default async function HomePage() {
  const data = await getLandingData();
  return (
    <>
      <SiteHeader faqs={data.faqs.map((f) => ({ id: f.id, question: f.question }))} />
      <main id="main">
        <Hero snapshot={data.snapshot} />
        <Paradox facts={data.facts} />
        <Mission />
        <FiveStops />
        <section id="discover" aria-labelledby="discover-title" className="bg-bg py-24 text-text">
          <Container>
            <Kicker className="text-ocean">Live food discovery</Kicker>
            <SectionTitle id="discover-title">Surplus food, right now.</SectionTitle>
            <p className="mt-4 max-w-2xl text-lg text-muted">
              A privacy-safe preview of what donors have listed. Verified receivers see full details, distance and safety notes.
            </p>
            <DiscoveryPreview listings={data.preview} configured={data.configured} />
          </Container>
        </section>
        <Experiences />
        <RealImpact snapshot={data.snapshot} />
        <Stories testimonials={data.testimonials} />
        <AppSection app={data.app} />
        <Join faqs={data.faqs} />
      </main>
      <SiteFooter />
    </>
  );
}
