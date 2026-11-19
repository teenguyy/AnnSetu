"use client";

import { HandHeart, MailCheck, Store } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { Field, FormAlert } from "./fields";
import { OAuthButtons } from "./oauth-buttons";

const schema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your name").max(120),
    email: z.email("Enter a valid email"),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Za-z]/, "Include a letter")
      .regex(/[0-9]/, "Include a number"),
    confirm: z.string(),
    terms: z.literal("on", { error: "Please accept the terms" }),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don’t match" });

type Errors = Partial<Record<"full_name" | "email" | "password" | "confirm" | "terms", string>>;

export function SignUpForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const [role, setRole] = useState<"donor" | "ngo">(sp.get("role") === "ngo" ? "ngo" : "donor");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");

  const pick = (r: "donor" | "ngo") => {
    setRole(r);
    router.replace(`/sign-up?role=${r}`, { scroll: false });
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) {
      const errs: Errors = {};
      for (const issue of parsed.error.issues) errs[issue.path[0] as keyof Errors] ??= issue.message;
      return setErrors(errs);
    }
    setErrors({});
    setBusy(true);
    setError("");
    const { data, error: err } = await createClient().auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.full_name, role },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    if (err) return setError(err.code === "weak_password" ? "Choose a stronger password." : err.message);
    // email confirmation is on: Supabase returns no session until the link is clicked
    if (!data.session) return setSentTo(parsed.data.email);
    router.replace("/auth/continue");
  };

  if (sentTo)
    return (
      <div className="rounded-[24px] bg-surface-2 p-6 ring-1 ring-line">
        <MailCheck className="size-8 text-ocean" aria-hidden />
        <p className="mt-3 font-display text-2xl font-semibold">Check your inbox</p>
        <p className="mt-1 text-muted">
          We sent a confirmation link to <strong className="text-text">{sentTo}</strong>. Open it to finish creating your account.
        </p>
      </div>
    );

  const roles = [
    { id: "donor" as const, icon: Store, title: "Donor", sub: "I have surplus food" },
    { id: "ngo" as const, icon: HandHeart, title: "Receiver", sub: "We serve people in need" },
  ];

  return (
    <>
      <div role="radiogroup" aria-label="I’m joining as" className="mb-6 grid grid-cols-2 gap-3">
        {roles.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={role === r.id}
            onClick={() => pick(r.id)}
            className={cn(
              "flex items-center gap-3 rounded-[18px] p-4 text-left ring-2 transition-colors",
              role === r.id ? (r.id === "donor" ? "bg-butter/60 ring-ink" : "bg-sky/40 ring-ink") : "bg-surface-2 ring-line hover:ring-ocean",
            )}
          >
            <r.icon className="size-6 shrink-0" aria-hidden />
            <span>
              <span className="block font-label font-semibold">{r.title}</span>
              <span className="block text-xs text-muted">{r.sub}</span>
            </span>
          </button>
        ))}
      </div>
      <OAuthButtons role={role} />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field id="full_name" name="full_name" label="Your name" autoComplete="name" error={errors.full_name} />
        <Field id="email" name="email" type="email" label="Email" autoComplete="email" error={errors.email} />
        <Field id="password" name="password" type="password" label="Password" autoComplete="new-password" hint="At least 8 characters with a letter and a number" error={errors.password} />
        <Field id="confirm" name="confirm" type="password" label="Confirm password" autoComplete="new-password" error={errors.confirm} />
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="terms" className="mt-1 size-5 accent-[var(--ocean)]" aria-invalid={!!errors.terms} />
          <span>
            I agree to the <Link href="/terms" className="underline underline-offset-2">terms</Link> and{" "}
            <Link href="/privacy" className="underline underline-offset-2">privacy policy</Link>.
            {errors.terms && <span className="block text-danger">{errors.terms}</span>}
          </span>
        </label>
        {error && <FormAlert>{error}</FormAlert>}
        <Button type="submit" variant="solid" size="lg" arrow className="w-full" disabled={busy}>
          {busy ? "Creating account…" : `Create ${role === "donor" ? "donor" : "receiver"} account`}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-[var(--link)] underline-offset-4 hover:underline">Sign in</Link>
      </p>
    </>
  );
}
