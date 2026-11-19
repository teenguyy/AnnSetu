import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";

import { SignOutButton } from "./sign-out-button";

/** Temporary minimal chrome until the full dashboard shell (phase 7). */
export function BasicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100svh] bg-bg text-text">
      <header className="flex h-20 items-center justify-between bg-ink px-5 md:px-8">
        <Link href="/" aria-label="AnnSetu home"><Logo /></Link>
        <SignOutButton className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-label text-sm font-semibold text-cream ring-2 ring-cream/70 hover:bg-cream hover:text-ink" />
      </header>
      <main id="main" className="mx-auto max-w-5xl px-5 py-10 md:px-8">{children}</main>
    </div>
  );
}
