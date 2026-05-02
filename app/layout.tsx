import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
