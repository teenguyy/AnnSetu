"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { safeNext } from "@/lib/auth/destination";
import { createClient } from "@/lib/supabase/client";

import { Field, FormAlert } from "./fields";
import { OAuthButtons } from "./oauth-buttons";

const LINK_ERRORS: Record<string, string> = {
  link_invalid: "That sign-in link is invalid. Please try again.",
  link_expired: "That link has expired. Request a new one.",
  missing_code: "Sign-in was interrupted. Please try again.",
};

export function SignInForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = safeNext(sp.get("next"));
  const [error, setError] = useState(LINK_ERRORS[sp.get("error") ?? ""] ?? "");
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    setBusy(true);
    setError("");
    const { error: err } = await createClient().auth.signInWithPassword({ email, password });
    if (err) {
      setBusy(false);
      if (err.code === "email_not_confirmed") {
        setUnconfirmed(email);
        return setError("Please confirm your email first. Check your inbox for the link.");
      }
      return setError(err.code === "invalid_credentials" ? "Email or password is incorrect." : err.message);
    }
    router.replace(`/auth/continue${next ? `?next=${encodeURIComponent(next)}` : ""}`);
    router.refresh();
  };

  const resend = async () => {
    const { error: err } = await createClient().auth.resend({
      type: "signup",
      email: unconfirmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setError(err ? err.message : "");
    if (!err) setUnconfirmed("");
  };

  return (
    <>
      <OAuthButtons next={next} />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field id="email" name="email" type="email" label="Email" autoComplete="email" required />
        <Field id="password" name="password" type="password" label="Password" autoComplete="current-password" required minLength={8} />
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-[var(--link)] underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
        {error && <FormAlert>{error}</FormAlert>}
        {unconfirmed && (
          <button type="button" onClick={resend} className="text-sm font-semibold text-[var(--link)] underline underline-offset-4">
            Resend confirmation email
          </button>
        )}
        <Button type="submit" variant="solid" size="lg" arrow className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New to AnnSetu?{" "}
        <Link href="/sign-up" className="font-semibold text-[var(--link)] underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-muted">Representatives join through an invitation from their NGO.</p>
    </>
  );
}
