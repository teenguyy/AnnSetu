import type { Metadata } from "next";

import { Prose, PublicPage } from "@/components/site/public-page";

export const metadata: Metadata = { title: "Terms", description: "Terms of use for AnnSetu." };

export default function TermsPage() {
  return (
    <PublicPage kicker="Terms" title="Terms of use.">
      <Prose>
        <p>These terms summarise how AnnSetu works. They will be reviewed by the AnnSetu team before public launch.</p>
        <h2>What AnnSetu does</h2>
        <p>AnnSetu connects donors and receivers and records pickups. AnnSetu does not transport food; receivers’ own representatives collect it.</p>
        <h2>Donor responsibilities</h2>
        <ul>
          <li>List only food that is safe to eat, accurately described, with allergens and storage notes.</li>
          <li>Hand over food only after the representative shows the correct pickup code.</li>
        </ul>
        <h2>Receiver responsibilities</h2>
        <ul>
          <li>Request only what you can collect and distribute in time.</li>
          <li>Send a representative you have authorised, and keep their details up to date.</li>
        </ul>
        <h2>Verification and suspension</h2>
        <p>The AnnSetu team verifies organisations and may suspend accounts that put people at risk or misuse the platform. Suspension withdraws open listings and cancels open pickups.</p>
      </Prose>
    </PublicPage>
  );
}
