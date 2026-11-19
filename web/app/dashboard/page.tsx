import { BadgeCheck, Clock3, FileUp, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { BasicShell } from "@/components/dashboard/basic-shell";
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const STATUS = {
  pending: { icon: Clock3, title: "Awaiting verification", tone: "bg-sunshine/45" },
  approved: { icon: BadgeCheck, title: "Verified", tone: "bg-success/15" },
  rejected: { icon: ShieldAlert, title: "Needs attention", tone: "bg-coral/15" },
  suspended: { icon: ShieldAlert, title: "Suspended", tone: "bg-coral/20" },
} as const;

async function Overview() {
  await connection(); // per-request: session cookies, never prerendered
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) redirect("/sign-in?next=/dashboard");
  const [{ data: profile }, { data: org }, { data: notes }] = await Promise.all([
    supabase.from("profiles").select("role, full_name").eq("id", uid).maybeSingle(),
    supabase.from("organizations").select("id, name, kind, status, profile_completed_at, review_due_at, no_certificate, rejection_note, suspended_reason").eq("owner_id", uid).maybeSingle(),
    supabase.from("notifications").select("id, title, body, created_at, read_at").order("created_at", { ascending: false }).limit(8),
  ]);
  if (profile?.role === "admin") redirect("/admin");
  if (profile?.role === "representative") redirect("/rep");
  if (!org?.profile_completed_at) redirect("/onboarding/profile");
  const st = STATUS[org.status as keyof typeof STATUS] ?? STATUS.pending;
  return (
    <>
      <p className="font-label text-sm font-semibold tracking-[0.18em] text-ocean uppercase">{org.kind === "donor" ? "Donor" : "Receiver"}</p>
      <h1 className="font-display mt-2 text-4xl font-semibold">Hello{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.</h1>
      <section aria-labelledby="status-title" className={`mt-8 rounded-[28px] p-7 ${st.tone}`}>
        <h2 id="status-title" className="flex items-center gap-2 font-display text-2xl font-semibold">
          <st.icon className="size-6" aria-hidden /> {org.name}: {st.title}
        </h2>
        {org.status === "pending" && (
          <p className="mt-2">
            {org.no_certificate && org.review_due_at
              ? `Your request will be reviewed within 3–5 business days (by ${formatDate(org.review_due_at)}).`
              : "Upload your registration or FSSAI documents so the AnnSetu team can verify you."}{" "}
            {org.kind === "donor" ? "Listing food" : "Requesting food"} unlocks once you’re verified.
          </p>
        )}
        {org.status === "rejected" && <p className="mt-2">Feedback: “{org.rejection_note}”. Update your profile and submit again.</p>}
        {org.status === "suspended" && <p className="mt-2">Reason: {org.suspended_reason}. Contact AnnSetu if you believe this is a mistake.</p>}
        {org.status === "approved" && <p className="mt-2">You’re verified. The full dashboard is arriving in the next update.</p>}
        <div className="mt-5 flex flex-wrap gap-3">
          {org.status !== "approved" && (
            <ButtonLink href="/onboarding/profile" variant="solid" size="md" arrow>Review profile</ButtonLink>
          )}
          <ButtonLink href="/contact" variant="ghost" size="md" className="ring-1 ring-line" icon={<FileUp className="size-4" aria-hidden />}>
            Questions? Contact us
          </ButtonLink>
        </div>
      </section>
      <section aria-labelledby="notes-title" className="mt-10">
        <h2 id="notes-title" className="font-display text-2xl font-semibold">Notifications</h2>
        {notes && notes.length > 0 ? (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[24px] bg-surface-2 ring-1 ring-line">
            {notes.map((n) => (
              <li key={n.id} className="px-5 py-4">
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="text-sm text-muted">{n.body}</p>}
                <p className="mt-1 text-xs text-muted">{formatDate(n.created_at)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-[24px] bg-surface-2 p-6 text-muted ring-1 ring-line">No notifications yet.</p>
        )}
      </section>
    </>
  );
}

export default function DashboardPage() {
  return (
    <BasicShell>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[28px] bg-surface" />}>
        <Overview />
      </Suspense>
    </BasicShell>
  );
}
