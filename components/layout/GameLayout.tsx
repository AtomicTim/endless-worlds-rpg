"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, X, BookOpen, Save, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/UserMenu";
import { VerbosityToggle } from "@/components/game/VerbosityToggle";
import { Genre } from "@/types/game";
import { useGameStore } from "@/lib/stores/game-store";

const GENRE_LABELS: Partial<Record<Genre, string>> = {
  [Genre.FANTASY]:             "Fantasy",
  [Genre.CYBERPUNK]:           "Cyberpunk",
  [Genre.HORROR_LOVECRAFTIAN]: "Horror / Lovecraftian",
  [Genre.SPACE_OPERA]:         "Space Opera",
  [Genre.POST_APOCALYPTIC]:    "Post-Apocalyptic",
};

interface GameLayoutProps {
  genre?:    Genre;
  mainPanel: React.ReactNode;
  sidebar:   React.ReactNode;
  /** Day 19F — optional left-side map panel. Renders inside its own
   *  sliding aside; visibility is driven by the store's `mapPanelOpen`
   *  flag so any component (header button, ESC key) can toggle it. */
  mapPanel?: React.ReactNode;
}

type SaveState = "idle" | "saving" | "saved";

export function GameLayout({
  genre = Genre.FANTASY,
  mainPanel,
  sidebar,
  mapPanel,
}: GameLayoutProps) {
  const router        = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saveState,   setSaveState]   = useState<SaveState>("idle");
  const mapPanelOpen   = useGameStore((s) => s.mapPanelOpen);
  const toggleMapPanel = useGameStore((s) => s.toggleMapPanel);
  const setMapPanelOpen = useGameStore((s) => s.setMapPanelOpen);
  const genreLabel = GENRE_LABELS[genre] ?? (genre as string);

  // ── Save & Exit ───────────────────────────────────────────────────────────
  async function handleSaveAndExit() {
    if (saveState === "saving" || saveState === "saved") return;

    const masterState = useGameStore.getState().masterState;
    if (!masterState) {
      router.push("/dashboard");
      return;
    }

    setSaveState("saving");
    try {
      await fetch("/api/game/state", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          sessionId: masterState.metadata.session_id,
          state:     masterState,
        }),
      });
    } catch {
      // Best-effort — still navigate so the user isn't stuck.
    }
    setSaveState("saved");
    // Brief confirmation, then redirect.
    setTimeout(() => { router.push("/dashboard"); }, 2000);
  }

  const saveLabel =
    saveState === "saving" ? "Saving…" :
    saveState === "saved"  ? "Saved! ✓" :
    "Save & Exit";

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
          {/* Day 18 — verbosity toggle (genre-themed) */}
          <VerbosityToggle />

          {/* Save & Exit */}
          <button
            onClick={() => { void handleSaveAndExit(); }}
            disabled={saveState === "saving" || saveState === "saved"}
            className="hidden rounded-sm px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors sm:flex items-center gap-1.5"
            style={{
              border: saveState === "saved"
                ? "1px solid #22c55e"
                : "1px solid color-mix(in srgb, var(--color-primary) 50%, transparent)",
              color: saveState === "saved" ? "#22c55e" : "var(--color-primary)",
              backgroundColor: "transparent",
              opacity: saveState === "saving" ? 0.6 : 1,
              cursor: saveState === "saving" ? "not-allowed" : "pointer",
            }}
          >
            <Save className="size-3" />
            {saveLabel}
          </button>

          {/* Day 19F — Map panel toggle. Only shown when the page provides
              a mapPanel slot, so other layouts (e.g. dashboard) don't get
              a stray icon. Mobile gets a slightly larger touch target so
              the bottom-sheet trigger is easy to hit one-handed. */}
          {mapPanel && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMapPanel}
              aria-label={mapPanelOpen ? "Close map" : "Open map"}
              title={mapPanelOpen ? "Close map" : "Open map"}
              className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
              style={{
                color: mapPanelOpen
                  ? "var(--color-primary)"
                  : "color-mix(in srgb, var(--color-primary) 70%, transparent)",
                backgroundColor: mapPanelOpen
                  ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
                  : "transparent",
              }}
            >
              <MapIcon className="size-5" />
            </Button>
          )}

          {/* Codex */}
          <Link href="/game/codex" aria-label="Open codex">
            <Button
              variant="ghost"
              size="icon"
              style={{ color: "var(--color-primary)" }}
              title="Codex"
            >
              <BookOpen className="size-5" />
            </Button>
          </Link>

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
        {/* Map panel.
            - Desktop (md+): unchanged left-side sliding sidebar.
            - Mobile (< md): bottom sheet sliding up from the bottom,
              rounded top corners, drag handle, full-width.
            Two separate render paths so each viewport gets the right
            interaction model without compromise. */}
        {mapPanel && (
          <>
            {/* ── Mobile backdrop ─────────────────────────────────── */}
            {mapPanelOpen && (
              <div
                className="fixed inset-0 z-30 bg-black/60 md:hidden"
                onClick={() => setMapPanelOpen(false)}
                aria-hidden
              />
            )}

            {/* ── Mobile: bottom sheet ────────────────────────────── */}
            <div
              role="dialog"
              aria-label="World map"
              aria-hidden={!mapPanelOpen}
              className={[
                "fixed inset-x-0 bottom-0 z-40 flex flex-col md:hidden",
                "transition-transform duration-300 ease-in-out",
                mapPanelOpen ? "translate-y-0" : "translate-y-full",
              ].join(" ")}
              style={{
                height:          "65vh",
                borderTopLeftRadius:  16,
                borderTopRightRadius: 16,
                borderTop:       "1px solid var(--color-border)",
                backgroundColor: "var(--color-bg)",
                boxShadow:       "0 -8px 24px rgba(0,0,0,0.6)",
              }}
            >
              {/* Drag handle pill */}
              <div
                className="flex shrink-0 justify-center pt-2"
                onClick={() => setMapPanelOpen(false)}
              >
                <span
                  aria-hidden
                  style={{
                    width:           32,
                    height:          4,
                    borderRadius:    2,
                    backgroundColor: "var(--color-muted)",
                    opacity:         0.5,
                  }}
                />
              </div>
              {/* Header row with close button */}
              <div
                className="flex shrink-0 items-center justify-between px-3 py-2"
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                <span
                  className="text-[10px] tracking-wider"
                  style={{ color: "var(--color-muted)" }}
                >
                  WORLD MAP
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setMapPanelOpen(false)}
                  aria-label="Close map"
                >
                  <X className="size-4" />
                </Button>
              </div>
              {/* Sheet body — flex-1 so the tier component scrolls inside. */}
              <div className="min-h-0 flex-1 overflow-hidden">
                {mapPanel}
              </div>
            </div>

            {/* ── Desktop: left sidebar (unchanged) ─────────────── */}
            <aside
              className={[
                "hidden md:relative md:top-auto md:z-auto md:flex",
                "transition-transform duration-300 ease-in-out",
                mapPanelOpen
                  ? "md:w-80 md:max-w-[320px] md:min-w-[280px]"
                  : "md:w-0 md:min-w-0 md:max-w-0 md:overflow-hidden",
              ].join(" ")}
              style={{
                borderRight:     "1px solid var(--color-border)",
                backgroundColor: "var(--color-bg)",
              }}
              aria-hidden={!mapPanelOpen}
            >
              <div className="h-full w-full">
                {mapPanel}
              </div>
            </aside>
          </>
        )}

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
            "fixed right-0 top-14 z-20 h-[calc(100vh-3.5rem)] w-72 overflow-y-auto",
            "md:relative md:top-auto md:z-auto md:h-auto md:w-[35%] md:max-w-[380px] md:min-w-[240px]",
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
