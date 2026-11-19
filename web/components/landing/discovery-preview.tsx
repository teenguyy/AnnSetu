"use client";

import { Clock, Lock, Plus, ShoppingBasket, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import type { PreviewListing } from "@/lib/landing-data";
import { cn, formatTime, timeLeft } from "@/lib/utils";

import { CATEGORIES, UNIT_LABEL, listingStatus } from "./food-categories";

const SORTS = [
  { value: "pickup_soonest", label: "Pickup soonest" },
  { value: "most_available", label: "Most available" },
  { value: "newest", label: "Newest" },
] as const;

const TONE = {
  ocean: "bg-ocean/15 text-deep-ocean dark:text-sky",
  coral: "bg-coral/20 text-[#8a2f22] dark:text-coral",
  sunshine: "bg-sunshine/60 text-ink",
  muted: "bg-line text-muted",
};

/** Signed-out preview of live listings (title, quantity, deadline, donor name only). */
export function DiscoveryPreview({ listings, configured }: { listings: PreviewListing[]; configured: boolean }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("pickup_soonest");
  const [tray, setTray] = useState<PreviewListing[]>([]);
  const [over, setOver] = useState(false);
  // null until mounted: the clock is never read during prerendering
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const first = requestAnimationFrame(() => setNow(Date.now()));
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(t);
    };
  }, []);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = listings.filter(
      (l) =>
        (now === null || new Date(l.pickup_by).getTime() > now) &&
        (!cat || l.category === cat) &&
        (!term || l.title.toLowerCase().includes(term) || l.donor_name.toLowerCase().includes(term)),
    );
    return [...rows].sort((a, b) =>
      sort === "most_available" ? b.qty_available - a.qty_available : sort === "newest" ? 0 : +new Date(a.pickup_by) - +new Date(b.pickup_by),
    );
  }, [listings, q, cat, sort, now]);

  const presentCats = Array.from(new Set(listings.map((l) => l.category)));
  const add = (l: PreviewListing) => setTray((t) => (t.some((x) => x.id === l.id) ? t : [...t, l]));

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="flex-1">
            <span className="sr-only">Search food or donor</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search food or donor…"
              className="h-12 w-full rounded-[14px] bg-surface-2 px-4 ring-1 ring-line outline-none focus:ring-2 focus:ring-focus"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-12 rounded-[14px] bg-surface-2 px-3 text-text ring-1 ring-line"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
              <option disabled>Nearest (sign in)</option>
            </select>
          </label>
        </div>
        {presentCats.length > 0 && (
          <div role="group" aria-label="Filter by category" className="mt-3 flex flex-wrap gap-2">
            {[null, ...presentCats].map((c) => (
              <button
                key={c ?? "all"}
                type="button"
                onClick={() => setCat(c)}
                aria-pressed={cat === c}
                className={cn(
                  "min-h-10 rounded-full px-4 font-label text-sm font-medium ring-1 transition-colors",
                  cat === c ? "bg-ink text-cream ring-ink dark:bg-sunshine dark:text-ink" : "bg-surface-2 text-text ring-line hover:ring-ocean",
                )}
              >
                {c ? CATEGORIES[c]?.label ?? c : "All"}
              </button>
            ))}
          </div>
        )}

        {shown.length === 0 ? (
          <div className="mt-8 rounded-[28px] bg-surface-2 p-10 text-center ring-1 ring-line">
            <p className="font-display text-2xl font-semibold">
              {!configured ? "Live listings will appear here soon." : listings.length === 0 ? "No surplus food is listed right now." : "Nothing matches those filters."}
            </p>
            <p className="mt-2 text-muted">
              {listings.length === 0 ? "Donors list food throughout the day. Check back later, or join as a donor." : "Try a different search or category."}
            </p>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {shown.map((l) => {
              const C = CATEGORIES[l.category] ?? CATEGORIES.other;
              const st = listingStatus(l.qty_available, null, l.pickup_by, now ?? undefined);
              const inTray = tray.some((t) => t.id === l.id);
              return (
                <li
                  key={l.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", l.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className="group flex gap-4 rounded-[24px] bg-surface-2 p-4 shadow-soft ring-1 ring-line transition-transform hover:-translate-y-0.5"
                >
                  <span className="grid size-20 shrink-0 place-items-center rounded-[18px] bg-light-blue/60 text-deep-ocean dark:bg-ocean/25 dark:text-sky">
                    <C.icon className="size-9" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-label text-lg font-semibold">{l.title}</p>
                      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", TONE[st.tone])}>{st.label}</span>
                    </div>
                    <p className="text-sm text-muted">
                      {l.donor_name}
                      {l.city ? ` · ${l.city}` : ""}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-semibold">
                        {l.qty_available} {UNIT_LABEL[l.unit]} available
                      </span>
                      <span className="inline-flex items-center gap-1 text-muted">
                        <Clock className="size-3.5" aria-hidden /> by {formatTime(l.pickup_by)}
                        {now !== null && ` · ${timeLeft(l.pickup_by, now)}`}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => add(l)}
                      disabled={inTray}
                      className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 font-label text-sm font-semibold text-[var(--link)] ring-1 ring-line hover:bg-bg disabled:opacity-60"
                    >
                      <Plus className="size-4" aria-hidden /> {inTray ? "In your request" : "Add to request"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <aside
        aria-label="Request tray"
        data-cursor-drop="true"
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const l = listings.find((x) => x.id === e.dataTransfer.getData("text/plain"));
          if (l) add(l);
        }}
        className={cn(
          "h-fit rounded-[28px] border-2 border-dashed p-5 transition-colors lg:sticky lg:top-28",
          over ? "border-sunshine bg-sunshine/15" : "border-line bg-surface",
        )}
      >
        <p className="flex items-center gap-2 font-label font-semibold">
          <ShoppingBasket className="size-5 text-ocean" aria-hidden /> Request tray
        </p>
        {tray.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Drag food here or use “Add to request”.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {tray.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 rounded-[14px] bg-surface-2 px-3 py-2 text-sm ring-1 ring-line">
                <span className="truncate">{t.title}</span>
                <button
                  type="button"
                  aria-label={`Remove ${t.title}`}
                  onClick={() => setTray((x) => x.filter((i) => i.id !== t.id))}
                  className="grid size-8 place-items-center rounded-full hover:bg-bg"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 rounded-[18px] bg-bg p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <Lock className="size-4" aria-hidden /> Requests are for verified receivers
          </p>
          <p className="mt-1 text-muted">Sign in as a verified NGO or community group to choose quantities and assign a representative.</p>
          <Link href="/sign-in?next=/explore" className={cn(buttonVariants({ variant: "solid", size: "md" }), "mt-3 w-full")}>
            Sign in to request
          </Link>
          <p className="mt-3 text-xs text-muted">
            Donor or admin? Discovery is for receivers; <Link href="/donate" className="underline underline-offset-2">list surplus food</Link> instead.
          </p>
        </div>
      </aside>
    </div>
  );
}
