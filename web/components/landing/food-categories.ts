import { Apple, Croissant, Milk, Package, Soup, Wheat, CupSoda, UtensilsCrossed, type LucideIcon } from "lucide-react";

export const CATEGORIES: Record<string, { label: string; icon: LucideIcon }> = {
  cooked_meals: { label: "Cooked meals", icon: Soup },
  bakery: { label: "Bakery", icon: Croissant },
  fruits_vegetables: { label: "Fruits & vegetables", icon: Apple },
  dairy: { label: "Dairy", icon: Milk },
  packaged: { label: "Packaged", icon: Package },
  beverages: { label: "Beverages", icon: CupSoda },
  raw_grains: { label: "Grains & staples", icon: Wheat },
  other: { label: "Other", icon: UtensilsCrossed },
};

export const UNIT_LABEL: Record<string, string> = { portions: "portions", kg: "kg", packs: "packs" };

/** `now` is optional so server/prerendered output never depends on the clock. */
export function listingStatus(available: number, total: number | null, pickupBy: string, now?: number) {
  if (available <= 0) return { label: "Fully reserved", tone: "muted" as const };
  if (now !== undefined && (new Date(pickupBy).getTime() - now) / 60000 <= 60) return { label: "Ending soon", tone: "coral" as const };
  if (available <= 5 || (total && available / total <= 0.2)) return { label: `Only ${available} left`, tone: "sunshine" as const };
  return { label: "Available", tone: "ocean" as const };
}
