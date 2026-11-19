import type { Metadata } from "next";

import { FaqList } from "@/components/landing/join";
import { Container } from "@/components/landing/primitives";
import { PublicPage } from "@/components/site/public-page";
import { getLandingData } from "@/lib/landing-data";

export const metadata: Metadata = { title: "FAQ", description: "Answers to common questions about AnnSetu." };

export default async function FaqPage() {
  const { faqs } = await getLandingData();
  return (
    <PublicPage kicker="FAQ" title={<>Questions, <em className="text-sunshine">answered.</em></>}>
      <Container className="max-w-4xl">
        <FaqList faqs={faqs} />
        <section id="representatives" className="mt-14 rounded-[28px] bg-surface-2 p-8 ring-1 ring-line">
          <h2 className="font-display text-3xl font-semibold">For representatives</h2>
          <p className="mt-3 text-muted">
            Representatives collect food on behalf of a verified receiver. Your NGO adds you with your name, phone and email and sends an
            invitation. You can create an AnnSetu login (or use Google, Microsoft or Apple) to see today’s pickups, directions and the code
            to show the donor. Without an account, each assigned pickup comes with a private single-use link that expires after the pickup.
          </p>
        </section>
      </Container>
    </PublicPage>
  );
}
