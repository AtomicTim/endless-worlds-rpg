import type { Metadata } from "next";
import { Crimson_Text } from "next/font/google";
import "./globals.css";

// HF-font-crimson — load Crimson Text via next/font so the .ew-serif
// class (story prose, combat lines, resolution banners) renders in an
// upright, readable serif instead of the prior italic Cormorant
// Garamond fallback. Variable is consumed by .ew-serif in
// globals.css; weights / styles cover normal + bold + italic so any
// inline fontStyle: "italic" usages in components keep working.
const crimsonText = Crimson_Text({
  subsets:  ["latin"],
  weight:   ["400", "600"],
  style:    ["normal", "italic"],
  variable: "--font-crimson",
  display:  "swap",
});

export const metadata: Metadata = {
  title: "Endless Worlds RPG",
  description: "A genre-agnostic AI-driven RPG engine with ASCII visuals",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${crimsonText.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
