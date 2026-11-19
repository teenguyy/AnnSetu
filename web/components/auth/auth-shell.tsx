import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";

import { AuthArt } from "./auth-art";

export function AuthShell({ variant, title, lead, children }: { variant: "signin" | "donor" | "receiver"; title: ReactNode; lead?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-[100svh] bg-bg text-text lg:grid-cols-[1.05fr_1fr]">
      <AuthArt variant={variant} />
      <main id="main" className="flex flex-col px-5 py-8 md:px-12">
        <Link href="/" aria-label="AnnSetu home" className="w-fit rounded-xl">
          <span className="rounded-2xl bg-ink px-3 py-2 inline-flex"><Logo /></span>
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-4xl font-semibold leading-tight">{title}</h1>
          {lead && <p className="mt-2 text-muted">{lead}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
