import type { Metadata } from "next";
import { Suspense } from "react";

import { Container } from "@/components/landing/primitives";
import { LeaderboardTable } from "@/components/site/leaderboard-table";
import { PublicPage } from "@/components/site/public-page";

export const metadata: Metadata = { title: "Leaderboard", description: "Top verified donors and receivers on AnnSetu." };

export default function LeaderboardPage({ searchParams }: { searchParams: Promise<{ board?: string; window?: string }> }) {
  return (
    <PublicPage
      kicker="Leaderboard"
      title={<>The people <em className="text-sunshine">keeping food moving.</em></>}
      lead="The top verified donors and receivers by OTP-confirmed pickups. Only active, verified organisations appear."
    >
      <Container>
        <Suspense fallback={<p className="text-muted">Loading leaderboard…</p>}>
          <LeaderboardTable searchParams={searchParams} />
        </Suspense>
      </Container>
    </PublicPage>
  );
}
