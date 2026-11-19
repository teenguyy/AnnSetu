import type { Metadata } from "next";

import { ContactForm } from "@/components/landing/contact-form";
import { Container } from "@/components/landing/primitives";
import { PublicPage } from "@/components/site/public-page";

export const metadata: Metadata = { title: "Contact", description: "Write to the AnnSetu team." };

export default function ContactPage() {
  return (
    <PublicPage kicker="Contact" title={<>Let’s <em className="text-sunshine">talk.</em></>} lead="Partnerships, questions, press or feedback. Messages go to the AnnSetu team’s inbox and we reply by email.">
      <Container>
        <ContactForm className="max-w-2xl" />
      </Container>
    </PublicPage>
  );
}
