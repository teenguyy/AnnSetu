"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Provider = "google" | "apple" | "azure";
const LABEL: Record<Provider, string> = { google: "Google", apple: "Apple", azure: "Microsoft" };

function Mark({ p }: { p: Provider }) {
  if (p === "google")
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.1 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" />
      </svg>
    );
  if (p === "apple")
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="currentColor">
        <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 4.9c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" /><path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" /><path fill="#00A4EF" d="M2 12.5h9.5V22H2z" /><path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}

/** OAuth buttons; providers not enabled in Supabase are shown disabled with a reason. */
export function OAuthButtons({ role, next }: { role?: "donor" | "ngo"; next?: string | null }) {
  const [enabled, setEnabled] = useState<Record<string, boolean> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => r.json())
      .then((d: { external?: Record<string, boolean> }) => setEnabled(d.external ?? {}))
      .catch(() => setEnabled({}));
  }, []);

  const go = async (p: Provider) => {
    setError("");
    const params = new URLSearchParams();
    if (role) params.set("role", role);
    if (next) params.set("next", next);
    const { error: e } = await createClient().auth.signInWithOAuth({
      provider: p,
      options: { redirectTo: `${window.location.origin}/auth/callback?${params}`, scopes: p === "azure" ? "email" : undefined },
    });
    if (e) setError(e.message);
  };

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-3">
        {(["google", "apple", "azure"] as Provider[]).map((p) => {
          const on = enabled?.[p] === true;
          return (
            <button
              key={p}
              type="button"
              onClick={() => go(p)}
              disabled={!on}
              title={enabled && !on ? `${LABEL[p]} sign-in isn’t enabled yet` : undefined}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface-2 px-4 font-label text-sm font-semibold ring-1 ring-line transition-colors hover:ring-ocean disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mark p={p} /> {LABEL[p]}
            </button>
          );
        })}
      </div>
      {enabled && !enabled.google && !enabled.apple && !enabled.azure && (
        <p className="mt-2 text-xs text-muted">Google, Apple and Microsoft sign-in will be available once enabled by the AnnSetu team.</p>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <div className="my-6 flex items-center gap-3 text-sm text-muted">
        <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
