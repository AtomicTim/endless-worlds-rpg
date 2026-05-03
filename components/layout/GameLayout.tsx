"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/UserMenu";
import { Genre } from "@/types/game";

const GENRE_LABELS: Partial<Record<Genre, string>> = {
  [Genre.FANTASY]:     "Fantasy",
  [Genre.CYBERPUNK]:   "Cyberpunk",
  [Genre.SPACE_OPERA]: "Space Opera",
};

interface GameLayoutProps {
  genre?: Genre;
  mainPanel: React.ReactNode;
  sidebar: React.ReactNode;
}

export function GameLayout({
  genre = Genre.FANTASY,
  mainPanel,
  sidebar,
}: GameLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const genreLabel = GENRE_LABELS[genre] ?? (genre as string);

  return (
    <div
      className="flex h-screen flex-col overflow-hidden font-mono"
      style={{
        backgroundColor: "var(--color-bg)",
        color: "var(--color-text)",
      }}
      data-genre={genre}
    >
      {/* ── Navbar ──────────────────────────────────────────────── */}
      <header
        className="z-30 flex h-14 shrink-0 items-center justify-between px-4"
        style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg)" }}
      >
        {/* Logo */}
        <span
          className="text-sm font-bold tracking-widest"
          style={{ color: "var(--color-primary)" }}
        >
          ENDLESS WORLDS
        </span>

        {/* Genre badge — hidden on xs screens */}
        <span
          className="hidden rounded-sm px-3 py-1 text-xs tracking-wider uppercase sm:inline-block"
          style={{
            border: "1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)",
            color: "var(--color-primary)",
          }}
        >
          {genreLabel}
        </span>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <UserMenu />
          {/* Mobile sidebar toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            style={{ color: "var(--color-primary)" }}
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle character panel"
          >
            <Menu className="size-5" />
          </Button>
        </div>
      </header>

      {/* ── Content row ─────────────────────────────────────────── */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Main panel */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {mainPanel}
        </main>

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-10 bg-black/60 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={[
            // Mobile: fixed overlay sliding in from the right
            "fixed right-0 top-14 z-20 h-[calc(100vh-3.5rem)] w-72 overflow-y-auto",
            // Desktop: inline panel
            "md:relative md:top-auto md:z-auto md:h-auto md:w-[35%] md:max-w-[380px] md:min-w-[240px]",
            // Transition
            "transition-transform duration-300 ease-in-out",
            sidebarOpen ? "translate-x-0 sidebar-slide-in" : "translate-x-full md:translate-x-0",
          ].join(" ")}
          style={{
            borderLeft: "1px solid var(--color-border)",
            backgroundColor: "var(--color-bg)",
          }}
        >
          {/* Mobile close row */}
          <div
            className="flex items-center justify-between px-3 py-2 md:hidden"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <span
              className="text-[10px] tracking-wider"
              style={{ color: "var(--color-muted)" }}
            >
              CHARACTER INFO
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          {sidebar}
        </aside>
      </div>
    </div>
  );
}
