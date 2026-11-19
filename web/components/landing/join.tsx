import { HandHeart, Store, UserCheck } from "lucide-react";
import Link from "next/link";

import type { Faq } from "@/lib/landing-data";

import { ContactForm } from "./contact-form";
import { Container, Kicker, SectionTitle } from "./primitives";

const roles = [
  { icon: Store, title: "Donor", body: "Kitchens and food businesses with surplus.", href: "/sign-up?role=donor", cta: "Join as donor" },
  { icon: HandHeart, title: "Receiver", body: "NGOs, shelters and community groups.", href: "/sign-up?role=ngo", cta: "Join as receiver" },
  { icon: UserCheck, title: "Representative", body: "Collecting for an NGO? Your NGO invites you by email or SMS.", href: "/faq#representatives", cta: "How invitations work" },
];

export function FaqList({ faqs }: { faqs: Faq[] }) {
  if (faqs.length === 0) return <p className="text-muted">Answers to common questions will appear here.</p>;
  return (
    <div className="divide-y divide-line overflow-hidden rounded-[28px] bg-surface-2 ring-1 ring-line">
      {faqs.map((f) => (
        <details key={f.id} id={f.id} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 font-label text-[17px] font-semibold">
            {f.question}
            <span aria-hidden className="text-2xl text-ocean transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="px-6 pb-5 leading-relaxed text-muted">{f.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function Join({ faqs }: { faqs: Faq[] }) {
  return (
    <section id="join" aria-labelledby="join-title" className="bg-bg py-24 text-text">
      <Container>
        <Kicker className="text-ocean">Join AnnSetu</Kicker>
        <SectionTitle id="join-title">Step onto the bridge.</SectionTitle>
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {roles.map((r) => (
            <li key={r.title} className="flex flex-col rounded-[28px] bg-surface-2 p-7 ring-1 ring-line">
              <r.icon className="size-8 text-ocean" aria-hidden />
              <p className="mt-4 font-display text-2xl font-semibold">{r.title}</p>
              <p className="mt-1 text-muted">{r.body}</p>
              <Link href={r.href} className="mt-auto pt-6 font-label font-semibold text-[var(--link)] underline-offset-4 hover:underline">
                {r.cta} →
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-16 grid gap-10 lg:grid-cols-2">
          <div>
            <h3 className="font-display text-3xl font-semibold">Write to us</h3>
            <p className="mt-2 text-muted">Questions, partnerships or press. Messages go straight to the AnnSetu team’s inbox.</p>
            <ContactForm className="mt-6" />
          </div>
          <div>
            <h3 className="font-display text-3xl font-semibold">Frequently asked</h3>
            <div className="mt-6">
              <FaqList faqs={faqs} />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
