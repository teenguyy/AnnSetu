"use client";

import { HandHeart, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormAlert } from "@/components/auth/fields";
import { createClient } from "@/lib/supabase/client";

export function RolePicker() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const choose = async (role: "donor" | "ngo") => {
    setBusy(role);
    setError("");
    const { error: err } = await createClient().rpc("set_my_role", { p_role: role });
    if (err) {
      setBusy(null);
      return setError(err.message);
    }
    router.replace("/onboarding/profile");
    router.refresh();
  };
  const options = [
    { id: "donor" as const, icon: Store, title: "Donor", body: "Restaurants, hotels, canteens, caterers, event organisers, food businesses, community kitchens." },
    { id: "ngo" as const, icon: HandHeart, title: "Receiver", body: "NGOs, shelters, orphanages, old-age homes, community kitchens and local community groups." },
  ];
  return (
    <div className="space-y-4">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          disabled={busy !== null}
          onClick={() => choose(o.id)}
          className="flex w-full items-start gap-4 rounded-[24px] bg-surface-2 p-6 text-left ring-2 ring-line transition-colors hover:ring-ink disabled:opacity-60"
        >
          <o.icon className="mt-1 size-7 shrink-0 text-ocean" aria-hidden />
          <span>
            <span className="block font-display text-2xl font-semibold">{busy === o.id ? "Saving…" : o.title}</span>
            <span className="mt-1 block text-muted">{o.body}</span>
          </span>
        </button>
      ))}
      <p className="text-sm text-muted">Your role is locked once your organisation is created.</p>
      {error && <FormAlert>{error}</FormAlert>}
    </div>
  );
}
