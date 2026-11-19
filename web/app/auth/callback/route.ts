import { NextResponse, type NextRequest } from "next/server";

import { destinationFor, safeNext } from "@/lib/auth/destination";
import { createClient } from "@/lib/supabase/server";

/** OAuth (Google / Apple / Microsoft) and PKCE email links land here. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const role = searchParams.get("role");
  if (!code) return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${origin}/sign-in?error=link_invalid`);
  // a new OAuth user who picked a role on the sign-up page
  if (role === "donor" || role === "ngo") {
    const { data: p } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
    if (!p?.role) await supabase.rpc("set_my_role", { p_role: role });
  }
  const next = safeNext(searchParams.get("next"));
  return NextResponse.redirect(`${origin}${next ?? (await destinationFor(supabase, data.user.id))}`);
}
