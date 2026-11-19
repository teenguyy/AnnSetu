"use client";

import { MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

import { Field, FormAlert } from "./fields";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("Enter a valid email");
    setBusy(true);
    const { error: err } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    // same message whether or not the account exists (no account enumeration)
    if (err && err.status !== 429) return setError(err.message);
    if (err?.status === 429) return setError("Too many requests. Please wait a minute and try again.");
    setSent(true);
  };
  if (sent)
    return (
      <div role="status" className="rounded-[24px] bg-surface-2 p-6 ring-1 ring-line">
        <MailCheck className="size-8 text-ocean" aria-hidden />
        <p className="mt-3 text-muted">If an account exists for that email, a reset link is on its way.</p>
      </div>
    );
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field id="email" name="email" type="email" label="Email" autoComplete="email" error={error || undefined} />
      <Button type="submit" variant="solid" size="lg" arrow className="w-full" disabled={busy}>
        {busy ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
      return setError("Use at least 8 characters with a letter and a number.");
    if (password !== String(f.get("confirm"))) return setError("Passwords don’t match.");
    setBusy(true);
    const { error: err } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(err.code === "same_password" ? "Choose a password you haven’t used before." : err.message);
    router.replace("/auth/continue");
  };
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field id="password" name="password" type="password" label="New password" autoComplete="new-password" />
      <Field id="confirm" name="confirm" type="password" label="Confirm new password" autoComplete="new-password" />
      {error && <FormAlert>{error}</FormAlert>}
      <Button type="submit" variant="solid" size="lg" arrow className="w-full" disabled={busy}>
        {busy ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
