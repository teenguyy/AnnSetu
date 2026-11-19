"use client";

import { FileText, HelpCircle, Search, UtensilsCrossed } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { searchablePages } from "./nav";

export type SearchFaq = { id: string; question: string };
type Listing = { id: string; title: string; donor_name: string; city: string | null };
type Result = { key: string; href: string; title: string; hint: string; kind: "page" | "faq" | "food" };

const API = process.env.NEXT_PUBLIC_API_URL;

/** Command-style search over pages, FAQs and (public preview) listings, keyboard navigable. */
export function SearchOverlay({ open, onClose, faqs }: { open: boolean; onClose: () => void; faqs: SearchFaq[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsState, setListingsState] = useState<"idle" | "error" | "ready">("idle");

  const started = useRef(false);
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => input.current?.focus());
    if (!API || started.current) return () => cancelAnimationFrame(raf);
    started.current = true;
    fetch(`${API}/v1/listings/preview?limit=24`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((rows: Listing[]) => {
        setListings(rows);
        setListingsState("ready");
      })
      .catch(() => setListingsState("error"));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const close = () => {
    setQ("");
    setActive(0);
    onClose();
  };

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    const match = (s: string) => !term || s.toLowerCase().includes(term);
    return [
      ...listings
        .filter((l) => term && (match(l.title) || match(l.donor_name)))
        .slice(0, 5)
        .map((l) => ({ key: `f${l.id}`, href: `/explore?focus=${l.id}`, title: l.title, hint: `${l.donor_name}${l.city ? ` · ${l.city}` : ""}`, kind: "food" as const })),
      ...searchablePages.filter((p) => match(p.title) || match(p.hint)).map((p) => ({ key: p.href, href: p.href, title: p.title, hint: p.hint, kind: "page" as const })),
      ...faqs
        .filter((f) => term && match(f.question))
        .slice(0, 5)
        .map((f) => ({ key: `q${f.id}`, href: `/faq#${f.id}`, title: f.question, hint: "FAQ", kind: "faq" as const })),
    ].slice(0, 12);
  }, [q, listings, faqs]);

  if (!open) return null;

  const go = (r: Result | undefined) => {
    if (!r) return;
    close();
    router.push(r.href);
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-start bg-ink/70 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="mx-auto w-full max-w-xl overflow-hidden rounded-[24px] bg-surface-2 text-text shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          }
          if (e.key === "Enter") go(results[active]);
          if (e.key === "Tab") e.preventDefault();
        }}
      >
        <label className="flex items-center gap-3 border-b border-line px-5">
          <Search className="size-5 text-muted" aria-hidden />
          <span className="sr-only">Search pages, FAQs and food</span>
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            placeholder="Search food, pages and FAQs…"
            className="h-16 w-full bg-transparent text-lg outline-none placeholder:text-muted"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-activedescendant={results[active] ? `sr-${results[active].key}` : undefined}
          />
          <kbd className="rounded-md border border-line px-2 py-1 font-label text-xs text-muted">Esc</kbd>
        </label>
        <ul id="search-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-4 py-8 text-center text-muted">No matches for “{q}”.</li>}
          {results.map((r, i) => {
            const Icon = r.kind === "food" ? UtensilsCrossed : r.kind === "faq" ? HelpCircle : FileText;
            return (
              <li
                key={r.key}
                id={`sr-${r.key}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3", i === active && "bg-bg")}
              >
                <Icon className="size-5 shrink-0 text-ocean" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.title}</span>
                  <span className="block truncate text-sm text-muted">{r.hint}</span>
                </span>
              </li>
            );
          })}
        </ul>
        {listingsState === "error" && (
          <p className="border-t border-line px-5 py-3 text-sm text-muted">Live food listings couldn’t be searched right now.</p>
        )}
      </div>
    </div>
  );
}
