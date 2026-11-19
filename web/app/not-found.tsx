import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="grain grid min-h-[100svh] place-items-center bg-ink px-5 text-center text-cream">
      <div className="relative z-[2]">
        <Logo className="justify-center" />
        <p className="mt-10 font-stat text-7xl font-bold text-sunshine">404</p>
        <h1 className="font-display mt-2 text-4xl font-semibold">This bridge doesn’t lead anywhere.</h1>
        <p className="mt-3 text-cream/80">The page you’re looking for has moved or never existed.</p>
        <ButtonLink href="/" size="lg" arrow className="mt-8">Back to home</ButtonLink>
      </div>
    </main>
  );
}
