import Link from "next/link";

import { publicRpc } from "@/lib/public-rpc";
import { cn, compactNumber } from "@/lib/utils";

type Row = {
  rank: number;
  org_name: string;
  city: string | null;
  units: number;
  pickups: number;
  partners: number;
  meals_est: number;
};

const BOARDS = { donor: "Donors", ngo: "Receivers" } as const;
const WINDOWS = { month: "This month", year: "This year", all: "All time" } as const;

export async function LeaderboardTable({ searchParams }: { searchParams: Promise<{ board?: string; window?: string }> }) {
  const sp = await searchParams;
  const board = sp.board === "ngo" ? "ngo" : "donor";
  const window = sp.window === "year" || sp.window === "all" ? sp.window : "month";
  const rows = await publicRpc<Row[]>("public_leaderboard", { p_board: board, p_window: window });

  const tab = (active: boolean) =>
    cn("inline-flex min-h-11 items-center rounded-full px-5 font-label text-sm font-semibold ring-1", active ? "bg-ink text-cream ring-ink dark:bg-sunshine dark:text-ink" : "bg-surface-2 ring-line hover:ring-ocean");

  return (
    <div>
      <div className="flex flex-wrap gap-6">
        <nav aria-label="Board" className="flex gap-2">
          {Object.entries(BOARDS).map(([k, label]) => (
            <Link key={k} href={`/leaderboard?board=${k}&window=${window}`} aria-current={board === k ? "page" : undefined} className={tab(board === k)}>{label}</Link>
          ))}
        </nav>
        <nav aria-label="Time window" className="flex gap-2">
          {Object.entries(WINDOWS).map(([k, label]) => (
            <Link key={k} href={`/leaderboard?board=${board}&window=${k}`} aria-current={window === k ? "page" : undefined} className={tab(window === k)}>{label}</Link>
          ))}
        </nav>
      </div>
      {rows === null ? (
        <p role="alert" className="mt-8 rounded-[24px] bg-surface-2 p-6 text-muted ring-1 ring-line">The leaderboard is unavailable right now. Please try again later.</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 rounded-[24px] bg-surface-2 p-6 text-muted ring-1 ring-line">No completed pickups in this period yet. Rankings appear as verified organisations complete pickups.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-[24px] bg-surface-2 ring-1 ring-line">
          <table className="w-full min-w-[640px] text-left">
            <caption className="sr-only">{BOARDS[board]} leaderboard, {WINDOWS[window].toLowerCase()}</caption>
            <thead className="sticky top-0 bg-surface text-sm text-muted">
              <tr>
                <th scope="col" className="px-5 py-3">Rank</th>
                <th scope="col" className="px-5 py-3">Organisation</th>
                <th scope="col" className="px-5 py-3">City</th>
                <th scope="col" className="px-5 py-3 text-right">Units</th>
                <th scope="col" className="px-5 py-3 text-right">Pickups</th>
                <th scope="col" className="px-5 py-3 text-right">Partners</th>
                <th scope="col" className="px-5 py-3 text-right">Meals (est.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.rank + r.org_name}>
                  <td className="px-5 py-4 font-stat text-xl font-bold text-ocean">{r.rank}</td>
                  <td className="px-5 py-4 font-medium">{r.org_name}</td>
                  <td className="px-5 py-4 text-muted">{r.city ?? "—"}</td>
                  <td className="px-5 py-4 text-right">{compactNumber(r.units)}</td>
                  <td className="px-5 py-4 text-right">{r.pickups}</td>
                  <td className="px-5 py-4 text-right">{r.partners}</td>
                  <td className="px-5 py-4 text-right">{compactNumber(r.meals_est)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
