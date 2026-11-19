import { Mail, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Year } from "@/components/ui/year";

const groups = [
  {
    title: "Platform",
    links: [
      { href: "/explore", label: "Explore food" },
      { href: "/donate", label: "Donate" },
      { href: "/impact", label: "Impact" },
      { href: "/leaderboard", label: "Leaderboard" },
    ],
  },
  {
    title: "Get involved",
    links: [
      { href: "/sign-up?role=donor", label: "Join as donor" },
      { href: "/sign-up?role=ngo", label: "Join as receiver" },
      { href: "/faq#representatives", label: "Representatives" },
      { href: "/app", label: "Get the app" },
    ],
  },
  {
    title: "Trust & support",
    links: [
      { href: "/about", label: "About" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-bg px-3 pb-3 text-cream md:px-5 md:pb-5">
      <div className="grain relative overflow-hidden rounded-[40px] bg-ink px-6 pb-8 pt-14 md:px-12">
        <div className="relative z-[2] grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-sm text-cream/80">Good food deserves a second journey. AnnSetu connects surplus food with the people who need it.</p>
            <form action="/verify" method="get" className="mt-8 max-w-sm">
              <label htmlFor="cert-serial" className="flex items-center gap-2 font-label text-sm font-semibold">
                <ShieldCheck className="size-4 text-sunshine" aria-hidden /> Verify a certificate
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="cert-serial"
                  name="serial"
                  required
                  maxLength={40}
                  placeholder="AS-2026-XXXXXXXX"
                  className="h-12 min-w-0 flex-1 rounded-[14px] bg-cream/10 px-4 font-label uppercase tracking-wide text-cream ring-1 ring-cream/20 outline-none placeholder:text-cream/40 focus:ring-2 focus:ring-sunshine"
                />
                <button type="submit" className="h-12 rounded-full bg-sunshine px-5 font-label font-semibold text-ink hover:bg-[#ffe9a6]">
                  Check
                </button>
              </div>
            </form>
          </div>
          <nav aria-label="Footer" className="grid gap-8 sm:grid-cols-3">
            {groups.map((g) => (
              <div key={g.title}>
                <p className="font-label text-sm font-semibold tracking-[0.18em] text-sky uppercase">{g.title}</p>
                <ul className="mt-4 space-y-1">
                  {g.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="inline-block py-1.5 text-cream/85 underline-offset-4 hover:text-cream hover:underline">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <p aria-hidden className="relative z-[2] mt-14 select-none font-display text-[clamp(4rem,16vw,13rem)] font-semibold italic leading-[0.8] text-cream/[.06]">
          AnnSetu
        </p>
        <div className="relative z-[2] mt-6 flex flex-col gap-4 border-t border-cream/10 pt-6 text-sm text-cream/70 sm:flex-row sm:items-center sm:justify-between">
          <p>© <Year /> AnnSetu. Connect · Share · Nourish.</p>
          <div className="flex gap-2">
            <Link href="/contact" aria-label="Contact AnnSetu" className="grid size-11 place-items-center rounded-full ring-1 ring-cream/20 hover:bg-cream/10">
              <Mail className="size-5" aria-hidden />
            </Link>
            <Link href="/app" aria-label="Get the AnnSetu app" className="grid size-11 place-items-center rounded-full ring-1 ring-cream/20 hover:bg-cream/10">
              <Smartphone className="size-5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
