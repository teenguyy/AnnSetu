import type { Metadata, Viewport } from "next";
import { Caveat, DM_Sans, Fraunces, Space_Grotesk, Syne } from "next/font/google";

import { CustomCursor } from "@/components/cursor/custom-cursor";

import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const syne = Syne({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-syne", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-caveat", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "AnnSetu: Good food deserves a second journey", template: "%s · AnnSetu" },
  description:
    "AnnSetu connects surplus food from verified donors with verified NGOs, shelters and community groups, whose own representatives collect it.",
  openGraph: { type: "website", siteName: "AnnSetu", images: ["/brand/og.png"] },
  icons: { icon: "/brand/favicon.svg", apple: "/brand/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#D6ECF4" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1A24" },
  ],
};

// Resolve the theme before first paint (remembered choice, else system preference).
const themeScript = `try{var t=localStorage.getItem('annsetu-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-IN"
      suppressHydrationWarning
      className={`${fraunces.variable} ${spaceGrotesk.variable} ${dmSans.variable} ${syne.variable} ${caveat.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
        <CustomCursor />
      </body>
    </html>
  );
}
