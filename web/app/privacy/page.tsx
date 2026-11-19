import type { Metadata } from "next";

import { Prose, PublicPage } from "@/components/site/public-page";

export const metadata: Metadata = { title: "Privacy", description: "How AnnSetu handles your data." };

export default function PrivacyPage() {
  return (
    <PublicPage kicker="Privacy" title="Your data, handled with care.">
      <Prose>
        <p>This page explains what AnnSetu collects, why, and who can see it. It will be reviewed by the AnnSetu team before public launch.</p>
        <h2>What we collect</h2>
        <ul>
          <li>Account details: name, email, phone and sign-in provider.</li>
          <li>Organisation details you enter in the profile wizard, including address and map location.</li>
          <li>Verification documents you upload (stored privately).</li>
          <li>Listings, requests, pickup events, messages and feedback you create.</li>
          <li>Live location from a representative, only during an active pickup, only with consent, and deleted when the pickup ends.</li>
        </ul>
        <h2>Who can see it</h2>
        <ul>
          <li>Verified partners in a pickup see the contact details needed to complete it.</li>
          <li>The pickup code is visible only to the receiver organisation and its assigned representative.</li>
          <li>AnnSetu admins can see verification documents and, only when a report references a pickup, that pickup’s chat. Every admin action is logged with the admin’s name.</li>
        </ul>
        <h2>AI document review</h2>
        <p>Uploaded documents are read by Google Gemini, from our server only, to summarise them for an admin. Only the document and the organisation fields needed for comparison are sent. AI never approves anyone; a person decides.</p>
        <h2>Your choices</h2>
        <ul>
          <li>Choose which notifications you receive by email in Settings.</li>
          <li>Opt out of chatbot conversation logging.</li>
          <li>Ask us to export or delete your account through the contact page.</li>
        </ul>
      </Prose>
    </PublicPage>
  );
}
