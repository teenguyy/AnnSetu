import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { destinationFor, safeNext } from "@/lib/auth/destination";
import { createClient } from "@/lib/supabase/server";

/** Email confirmation and password-recovery links (token_hash flow). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (!tokenHash || !type) return NextResponse.redirect(`${origin}/sign-in?error=link_invalid`);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.user) return NextResponse.redirect(`${origin}/sign-in?error=link_expired`);
  if (type === "recovery") return NextResponse.redirect(`${origin}/reset-password`);
  const next = safeNext(searchParams.get("next"));
  return NextResponse.redirect(`${origin}${next ?? (await destinationFor(supabase, data.user.id))}`);
}
