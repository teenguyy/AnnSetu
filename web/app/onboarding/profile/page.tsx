import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ProfileWizard, type OrgDraft } from "@/components/onboarding/profile-wizard";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Complete your profile" };

async function Wizard() {
  await connection(); // per-request: session cookies, never prerendered
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) redirect("/sign-in?next=/onboarding/profile");
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", uid).maybeSingle();
  if (profile?.role === "admin") redirect("/admin");
  if (profile?.role === "representative") redirect("/rep");
  if (profile?.role !== "donor" && profile?.role !== "ngo") redirect("/onboarding/role");
  const { data: org } = await supabase.rpc("my_organization");
  const o = (org ?? {}) as Partial<Record<string, unknown>>;
  // verified organisations manage their profile from the dashboard; pending/rejected ones may edit and resubmit
  if (o.profile_completed_at && o.status === "approved") redirect("/dashboard");
  const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  const initial: OrgDraft = {
    id: s("id") || undefined,
    kind: profile.role,
    org_type: s("org_type"),
    name: s("name"),
    contact_person: s("contact_person") || profile.full_name || "",
    phone: s("phone"),
    email: s("email") || (typeof claims?.claims?.email === "string" ? claims.claims.email : ""),
    address: s("address"),
    city: s("city"),
    state: s("state"),
    pincode: s("pincode"),
    lat: typeof o.lat === "number" ? o.lat : null,
    lng: typeof o.lng === "number" ? o.lng : null,
    about: s("about"),
    operating_hours: (o.operating_hours as Record<string, string>) ?? {},
    pickup_windows: (o.pickup_windows as string[]) ?? [],
    fssai_number: s("fssai_number"),
    area_served: s("area_served"),
    beneficiaries_per_day: o.beneficiaries_per_day ? String(o.beneficiaries_per_day) : "",
    logo_path: s("logo_path") || null,
    no_certificate: o.no_certificate === true,
    no_cert_explanation: s("no_cert_explanation"),
    no_cert_references: s("no_cert_references"),
    status: s("status"),
    rejection_note: s("rejection_note") || null,
  };
  return <ProfileWizard initial={initial} userId={uid} />;
}

export default function ProfilePage() {
  return (
    <AuthShell variant="signin" title="Tell us about your organisation." lead="Everything except documents is required. Listing and requesting unlock once AnnSetu verifies you.">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[24px] bg-surface" />}>
        <Wizard />
      </Suspense>
    </AuthShell>
  );
}
