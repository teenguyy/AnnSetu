import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create an account" };

async function Shell({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const role = (await searchParams).role === "ngo" ? "receiver" : "donor";
  return (
    <AuthShell
      variant={role}
      title={role === "donor" ? "Share your surplus." : "Receive food for your community."}
      lead="Create your account, then complete your organisation profile for verification."
    >
      <SignUpForm />
    </AuthShell>
  );
}

export default function SignUpPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  return (
    <Suspense>
      <Shell searchParams={searchParams} />
    </Suspense>
  );
}
