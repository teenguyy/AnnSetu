"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="grid min-h-[100svh] place-items-center bg-ink px-5 text-center text-cream">
      <div>
        <p className="font-stat text-6xl font-bold text-sunshine">Oops</p>
        <h1 className="font-display mt-2 text-4xl font-semibold">Something went wrong on our side.</h1>
        <p className="mt-3 text-cream/80">Please try again. {error.digest && <span className="font-label text-sm">Ref: {error.digest}</span>}</p>
        <Button onClick={reset} size="lg" className="mt-8">Try again</Button>
      </div>
    </main>
  );
}
