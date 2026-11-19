import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const inputClass =
  "mt-1.5 h-12 w-full rounded-[14px] bg-surface-2 px-4 text-base ring-1 ring-line outline-none transition-shadow focus:ring-2 focus:ring-focus aria-[invalid=true]:ring-danger";

export function Field({ label, error, hint, id, className, ...props }: ComponentProps<"input"> & { label: string; error?: string; hint?: string; id: string }) {
  return (
    <label htmlFor={id} className={cn("block text-sm font-medium", className)}>
      {label}
      <input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} className={inputClass} {...props} />
      {hint && !error && <span id={`${id}-hint`} className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span id={`${id}-err`} className="mt-1 block text-sm text-danger">{error}</span>}
    </label>
  );
}

export function FormAlert({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: React.ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={cn("rounded-[14px] px-4 py-3 text-sm", tone === "error" ? "bg-coral/15" : tone === "success" ? "bg-success/15" : "bg-ocean/12")}>
      {children}
    </p>
  );
}
