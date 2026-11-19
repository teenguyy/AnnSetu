import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthShell variant="signin" title="Welcome back." lead="Donors, receivers, representatives and admins sign in here.">
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
