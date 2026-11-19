import type { Metadata } from "next";

import { CATEGORIES } from "@/components/landing/food-categories";
import { Container } from "@/components/landing/primitives";
import { PublicPage } from "@/components/site/public-page";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Donate surplus food", description: "How restaurants, hotels, caterers and kitchens donate surplus food through AnnSetu." };

const steps = [
  { t: "Create your account", d: "Sign up as a donor with email, Google, Apple or Microsoft." },
  { t: "Complete your profile", d: "Organisation details, address with a map pin, operating hours and pickup windows. Add your FSSAI number if you have one." },
  { t: "Upload documents", d: "Your FSSAI licence or registration. The AnnSetu team verifies every donor before listing opens." },
  { t: "List surplus", d: "Photos, quantity, prepared time, pickup deadline, veg/non-veg, allergens and safety notes." },
  { t: "Accept a request", d: "Nearby verified receivers request a quantity and name their representative. Accepting reserves the food." },
  { t: "Confirm the handover", d: "The representative shows a 4-digit code; you enter it to complete the pickup. Impact and certificates follow automatically." },
];

const safety = [
  "List only food that is safe to eat and stored correctly (hot food hot, cold food cold).",
  "Set a realistic pickup deadline: cooked food should be collected within a few hours of preparation.",
  "Note allergens and whether food is vegetarian, non-vegetarian or mixed.",
  "Never list food that has been served on a plate or left out beyond safe limits.",
];

export default function DonatePage() {
  return (
    <PublicPage
      kicker="For donors"
      title={<>Your surplus can be <em className="text-sunshine">someone’s dinner.</em></>}
      lead="Restaurants, hotels, canteens, caterers, event organisers, food businesses and community kitchens list surplus food; verified receivers nearby collect it."
    >
      <Container>
        <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.t} className="rounded-[28px] bg-surface-2 p-7 ring-1 ring-line">
              <span className="font-stat text-3xl font-bold text-ocean">0{i + 1}</span>
              <p className="mt-2 font-display text-2xl font-semibold">{s.t}</p>
              <p className="mt-2 text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-semibold">What you can donate</h2>
            <ul className="mt-5 flex flex-wrap gap-2">
              {Object.values(CATEGORIES).map((c) => (
                <li key={c.label} className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2 ring-1 ring-line">
                  <c.icon className="size-4 text-ocean" aria-hidden /> {c.label}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-3xl font-semibold">Food safety first</h2>
            <ul className="mt-5 space-y-3">
              {safety.map((s) => (
                <li key={s} className="rounded-[18px] bg-surface-2 px-5 py-3 text-muted ring-1 ring-line">{s}</li>
              ))}
            </ul>
          </div>
        </div>
        <ButtonLink href="/sign-up?role=donor" variant="solid" size="xl" arrow className="mt-12">
          Join as a donor
        </ButtonLink>
      </Container>
    </PublicPage>
  );
}
