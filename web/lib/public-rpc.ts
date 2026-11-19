import "server-only";

/** Anonymous PostgREST RPC call (RLS + function grants apply). Returns null when not configured or on error. */
export async function publicRpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}
