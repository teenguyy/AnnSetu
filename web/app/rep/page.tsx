import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { BasicShell } from "@/components/dashboard/basic-shell";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/utils";

export const metadata: Metadata = { title: "My pickups" };

async function Pickups() {
  await connection(); // per-request: session cookies, never prerendered
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/sign-in?next=/rep");
  const { data: rows } = await supabase
    .from("food_requests")
    .select("id, qty, status, timeline_status, food_listings(title, unit, pickup_by)")
    .in("status", ["accepted", "pending"])
    .order("created_at", { ascending: false });
  return (
    <>
      <h1 className="font-display text-4xl font-semibold">Today’s pickups</h1>
      {rows && rows.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => {
            const l = r.food_listings as unknown as { title: string; unit: string; pickup_by: string } | null;
            return (
              <li key={r.id} className="rounded-[24px] bg-surface-2 p-5 ring-1 ring-line">
                <p className="font-semibold">{l?.title}</p>
                <p className="text-sm text-muted">{r.qty} {l?.unit} · collect by {l ? formatTime(l.pickup_by) : "—"} · {r.status}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-6 rounded-[24px] bg-surface-2 p-6 text-muted ring-1 ring-line">No pickups assigned to you right now.</p>
      )}
    </>
  );
}

export default function RepPage() {
  return (
    <BasicShell>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-[24px] bg-surface" />}>
        <Pickups />
      </Suspense>
    </BasicShell>
  );
}
