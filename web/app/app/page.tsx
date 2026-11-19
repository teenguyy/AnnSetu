import type { Metadata } from "next";

import { AppSection } from "@/components/landing/sections";
import { PublicPage } from "@/components/site/public-page";
import { getLandingData } from "@/lib/landing-data";

export const metadata: Metadata = { title: "Get the app", description: "AnnSetu for Android." };

export default async function AppPage() {
  const { app } = await getLandingData();
  return (
    <PublicPage kicker="Get the app" title={<>AnnSetu <em className="text-sunshine">for Android.</em></>}>
      <div className="-mb-24 pt-14">
        <AppSection app={app} />
      </div>
    </PublicPage>
  );
}
