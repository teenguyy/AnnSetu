import { BadgeCheck, ShieldAlert, ShieldX } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { Container } from "@/components/landing/primitives";
import { PublicPage } from "@/components/site/public-page";
import { publicRpc } from "@/lib/public-rpc";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Verify a certificate", description: "Check that an AnnSetu certificate is genuine." };

type Cert = { serial: string; org_name: string; milestone: string; issued_at: string; valid: boolean };

async function Result({ searchParams }: { searchParams: Promise<{ serial?: string }> }) {
  const serial = (await searchParams).serial?.trim().toUpperCase().slice(0, 40);
  if (!serial) return <p className="text-muted">Enter the serial printed on the certificate, for example AS-2026-1A2B3C4D.</p>;
  const rows = await publicRpc<Cert[]>("verify_certificate", { p_serial: serial });
  if (rows === null)
    return (
      <p role="alert" className="flex items-center gap-3 rounded-[24px] bg-surface-2 p-6 ring-1 ring-line">
        <ShieldAlert className="size-6 text-coral" aria-hidden /> Verification is temporarily unavailable. Please try again later.
      </p>
    );
  const cert = rows[0];
  if (!cert)
    return (
      <p role="status" className="flex items-center gap-3 rounded-[24px] bg-surface-2 p-6 ring-1 ring-line">
        <ShieldX className="size-6 text-coral" aria-hidden /> No certificate with serial <strong className="font-label">{serial}</strong> exists.
      </p>
    );
  return (
    <div role="status" className="grain overflow-hidden rounded-[28px] bg-surface-2 p-8 ring-1 ring-line">
      <p className="flex items-center gap-2 font-label font-semibold">
        {cert.valid ? <BadgeCheck className="size-6 text-success" aria-hidden /> : <ShieldX className="size-6 text-coral" aria-hidden />}
        {cert.valid ? "Genuine AnnSetu certificate" : "This certificate has been revoked"}
      </p>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div><dt className="text-sm text-muted">Organisation</dt><dd className="font-display text-2xl font-semibold">{cert.org_name}</dd></div>
        <div><dt className="text-sm text-muted">Milestone</dt><dd className="font-display text-2xl font-semibold">{cert.milestone}</dd></div>
        <div><dt className="text-sm text-muted">Issued</dt><dd>{formatDate(cert.issued_at)}</dd></div>
        <div><dt className="text-sm text-muted">Serial</dt><dd className="font-label">{cert.serial}</dd></div>
      </dl>
    </div>
  );
}

export default function VerifyPage({ searchParams }: { searchParams: Promise<{ serial?: string }> }) {
  return (
    <PublicPage kicker="Certificates" title={<>Verify a <em className="text-sunshine">certificate.</em></>}>
      <Container className="max-w-3xl">
        <form action="/verify" method="get" className="mb-8 flex gap-2">
          <label htmlFor="serial" className="sr-only">Certificate serial</label>
          <input id="serial" name="serial" required maxLength={40} placeholder="AS-2026-XXXXXXXX"
            className="h-14 min-w-0 flex-1 rounded-[14px] bg-surface-2 px-4 font-label uppercase ring-1 ring-line outline-none focus:ring-2 focus:ring-focus" />
          <button type="submit" className="h-14 rounded-full bg-ink px-6 font-label font-semibold text-cream hover:bg-deep-ocean">Check</button>
        </form>
        <Suspense fallback={<p className="text-muted">Checking…</p>}>
          <Result searchParams={searchParams} />
        </Suspense>
      </Container>
    </PublicPage>
  );
}
