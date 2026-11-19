import type { SupabaseClient } from "@supabase/supabase-js";

/** Where a signed-in user belongs: role choice → profile wizard → their dashboard. */
export async function destinationFor(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  const role = profile?.role as string | null | undefined;
  if (role === "admin") return "/admin";
  if (role === "representative") return "/rep";
  if (role !== "donor" && role !== "ngo") return "/onboarding/role";
  const { data: org } = await supabase
    .from("organizations")
    .select("profile_completed_at")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!org?.profile_completed_at) return "/onboarding/profile";
  return "/dashboard";
}

/** Only allow same-site relative redirects. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
