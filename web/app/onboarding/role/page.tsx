import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { RolePicker } from "@/components/onboarding/role-picker";

export const metadata: Metadata = { title: "Choose how you’ll use AnnSetu" };

export default function RolePage() {
  return (
    <AuthShell variant="signin" title="How will you use AnnSetu?" lead="Choose one. Representatives join through their NGO’s invitation.">
      <RolePicker />
    </AuthShell>
  );
}
