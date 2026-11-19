import "server-only";

import { cacheLife, cacheTag } from "next/cache";

/** Public landing content, read with the anon key through PostgREST (RLS applies). */

export type Snapshot = {
  generated_at: string;
  completed_pickups: number;
  portions: number;
  kg: number;
  packs: number;
  meals_est: number;
  meals_method: string;
  co2_kg_est: number | null;
  co2_method: string | null;
  verified_donors: number;
  verified_receivers: number;
  cities: number;
  top_donors_week: { name: string; city: string | null; units: number }[];
};

export type Fact = {
  id: string;
  headline: string;
  detail: string | null;
  stat_value: string | null;
  source_name: string;
  source_url: string;
  verified_at: string;
};

export type Testimonial = { id: string; quote: string; author_name: string; author_role: string | null; org_name: string | null };
export type Faq = { id: string; question: string; answer: string; category: string };
export type PreviewListing = {
  id: string;
  title: string;
  category: string;
  qty_available: number;
  unit: "portions" | "kg" | "packs";
  pickup_by: string;
  donor_name: string;
  city: string | null;
};
export type AppSection = { state: "coming_soon" | "available"; play_store_url: string | null; apk_path: string | null };

export type LandingData = {
  configured: boolean;
  snapshot: Snapshot | null;
  facts: Fact[];
  testimonials: Testimonial[];
  faqs: Faq[];
  preview: PreviewListing[];
  app: AppSection;
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function rest<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init?.headers },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getLandingData(): Promise<LandingData> {
  "use cache";
  cacheLife("hours");
  cacheTag("landing");
  const [snap, facts, testimonials, faqs, preview, app] = await Promise.all([
    rest<{ data: Snapshot }[]>("landing_snapshot?select=data&order=id.desc&limit=1"),
    rest<Fact[]>("facts?select=id,headline,detail,stat_value,source_name,source_url,verified_at&active=eq.true&order=sort"),
    rest<Testimonial[]>("testimonials?select=id,quote,author_name,author_role,org_name&published=eq.true&order=sort&limit=6"),
    rest<Faq[]>("faqs?select=id,question,answer,category&published=eq.true&order=sort"),
    rest<PreviewListing[]>("rpc/public_listings_preview", { method: "POST", body: JSON.stringify({ p_limit: 8 }) }),
    rest<{ value: AppSection }[]>("app_settings?select=value&key=eq.app_section"),
  ]);
  return {
    configured: Boolean(url && key),
    snapshot: snap?.[0]?.data ?? null,
    facts: facts ?? [],
    testimonials: testimonials ?? [],
    faqs: faqs ?? [],
    preview: preview ?? [],
    app: app?.[0]?.value ?? { state: "coming_soon", play_store_url: null, apk_path: null },
  };
}
