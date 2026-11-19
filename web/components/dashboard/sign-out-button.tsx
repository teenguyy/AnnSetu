"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/** Sign-out always asks for confirmation (focus-trapped dialog). */
export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const d = dialog.current;
    const onClose = () => setBusy(false);
    d?.addEventListener("close", onClose);
    return () => d?.removeEventListener("close", onClose);
  }, []);
  const confirm = async () => {
    setBusy(true);
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  };
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={className}>
        <LogOut className="size-4" aria-hidden /> Sign out
      </button>
      <dialog ref={dialog} aria-labelledby="signout-title" className="m-auto w-[min(92vw,420px)] rounded-[24px] bg-surface-2 p-6 text-text shadow-2xl backdrop:bg-ink/60 backdrop:backdrop-blur-sm">
        <h2 id="signout-title" className="font-display text-2xl font-semibold">Sign out of AnnSetu?</h2>
        <p className="mt-2 text-muted">You’ll need to sign in again to manage listings, requests and pickups.</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" size="md" className="ring-1 ring-line" onClick={() => dialog.current?.close()} autoFocus>Cancel</Button>
          <Button variant="solid" size="md" onClick={confirm} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</Button>
        </div>
      </dialog>
    </>
  );
}
