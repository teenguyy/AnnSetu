import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { BasicShell } from "@/components/dashboard/basic-shell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin" };

async function AdminOverview() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/sign-in?next=/admin");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/dashboard");
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [pending, approved, inbox] = await Promise.all([
    count(supabase.from("organizations").select("id", { count: "exact", head: true }).eq("status", "pending").not("profile_completed_at", "is", null)),
    count(supabase.from("organizations").select("id", { count: "exact", head: true }).eq("status", "approved")),
    count(supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new")),
  ]);
  const stats = [
    { label: "Awaiting verification", value: pending },
    { label: "Verified organisations", value: approved },
    { label: "New inbox messages", value: inbox },
  ];
  return (
    <>
      <h1 className="font-display text-4xl font-semibold">Admin</h1>
      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[24px] bg-surface-2 p-6 ring-1 ring-line">
            <dd className="font-stat text-4xl font-bold text-ocean">{s.value}</dd>
            <dt className="mt-1 text-muted">{s.label}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-muted">The verification queue, organisations, reports and the rest of the console arrive with the full admin dashboard.</p>
    </>
  );
}

export default function AdminPage() {
  return (
    <BasicShell>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-[24px] bg-surface" />}>
        <AdminOverview />
      </Suspense>
    </BasicShell>
  );
}
