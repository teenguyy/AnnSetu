"use client";

import { Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { SearchOverlay, type SearchFaq } from "@/components/site/search-overlay";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { mainNav } from "./nav";

export function SiteHeader({ faqs = [], overlay = true }: { faqs?: SearchFaq[]; overlay?: boolean }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(!overlay);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);

  useEffect(() => {
    if (!overlay) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overlay]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-300",
          scrolled ? "bg-ink/85 shadow-[0_8px_30px_-12px_rgba(0,0,0,.5)] backdrop-blur-xl" : "bg-transparent",
        )}
      >
        <div className="mx-auto flex h-20 max-w-[1320px] items-center justify-between gap-4 px-5 md:px-8">
          <Link href="/" aria-label="AnnSetu home" className="rounded-xl">
            <Logo animated />
          </Link>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {mainNav.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative rounded-full px-4 py-2.5 font-label text-[15px] font-medium transition-colors",
                        active ? "text-sunshine" : "text-cream/85 hover:text-cream",
                      )}
                    >
                      {item.label}
                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-x-4 -bottom-0.5 h-[3px] rounded-full bg-sunshine transition-transform duration-300 origin-left",
                          active ? "scale-x-100" : "scale-x-0",
                        )}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearch(true)}
              aria-label="Search AnnSetu"
              className="grid size-12 place-items-center rounded-full text-cream transition-colors hover:bg-cream/10"
            >
              <Search className="size-5" />
            </button>
            <Link href="/sign-in" className={cn(buttonVariants({ variant: "outline", size: "md" }), "hidden sm:inline-flex")}>
              Sign In
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              className="grid size-12 place-items-center rounded-full text-cream hover:bg-cream/10 lg:hidden"
            >
              <Menu className="size-6" />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-[60] bg-ink text-cream lg:hidden">
          <div className="flex h-20 items-center justify-between px-5">
            <Logo />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="grid size-12 place-items-center rounded-full hover:bg-cream/10"
              autoFocus
            >
              <X className="size-6" />
            </button>
          </div>
          <nav aria-label="Mobile" className="px-6 pt-6">
            <ul className="space-y-1">
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl px-4 py-4 font-display text-3xl hover:bg-cream/5"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/sign-in"
              onClick={() => setOpen(false)}
              className={cn(buttonVariants({ variant: "primary", size: "xl" }), "mt-8 w-full")}
            >
              Sign In
            </Link>
          </nav>
        </div>
      )}

      <SearchOverlay open={search} onClose={() => setSearch(false)} faqs={faqs} />
    </>
  );
}
