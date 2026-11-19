import { NextResponse, type NextRequest } from "next/server";

import { destinationFor, safeNext } from "@/lib/auth/destination";
import { createClient } from "@/lib/supabase/server";

/** After password sign-in: send the user to the right place for their role and progress. */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return NextResponse.redirect(`${origin}/sign-in`);
  const dest = await destinationFor(supabase, sub);
  const next = safeNext(searchParams.get("next"));
  // honour ?next only once onboarding is complete
  return NextResponse.redirect(`${origin}${next && !dest.startsWith("/onboarding") ? next : dest}`);
}
