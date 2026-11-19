export const mainNav = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore Food" },
  { href: "/donate", label: "Donate" },
  { href: "/about", label: "About" },
  { href: "/impact", label: "Impact" },
  { href: "/contact", label: "Contact" },
] as const;

export const searchablePages = [
  { href: "/", title: "Home", hint: "Good food deserves a second journey" },
  { href: "/explore", title: "Explore food", hint: "Surplus food available near you" },
  { href: "/donate", title: "Donate surplus food", hint: "For restaurants, hotels, caterers and kitchens" },
  { href: "/about", title: "About AnnSetu", hint: "A bridge, not a delivery fleet" },
  { href: "/how-it-works", title: "How it works", hint: "Five stops from surplus to served" },
  { href: "/impact", title: "Impact", hint: "Meals, kilograms and pickups" },
  { href: "/leaderboard", title: "Leaderboard", hint: "Top donors and receivers" },
  { href: "/app", title: "Get the app", hint: "AnnSetu for Android" },
  { href: "/faq", title: "FAQ", hint: "Common questions" },
  { href: "/contact", title: "Contact", hint: "Write to the AnnSetu team" },
  { href: "/verify", title: "Verify a certificate", hint: "Check a certificate serial" },
  { href: "/privacy", title: "Privacy", hint: "How we handle your data" },
  { href: "/terms", title: "Terms", hint: "Terms of use" },
  { href: "/sign-in", title: "Sign in", hint: "Donors, receivers, representatives, admins" },
] as const;
