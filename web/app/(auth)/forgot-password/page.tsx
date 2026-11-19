import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell variant="signin" title="Forgot your password?" lead="Enter your email and we’ll send you a link to choose a new one.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
