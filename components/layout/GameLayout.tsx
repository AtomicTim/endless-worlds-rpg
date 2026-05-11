"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/UserMenu";
import { VerbosityToggle } from "@/components/game/VerbosityToggle";
import { Genre } from "@/types/game";
import { useGameStore } from "@/lib/stores/game-store";
import { genreSlug, GENRE_LABEL } from "@/lib/game/genre-slug";

/**
 * Three-column game layout — redesigned per /design/desktop-ui.jsx and
 * /design/mobile-ui.jsx.
 *
 * Desktop (md+):
 *   ┌──────────── header (56px) ────────────┐
 *   │ ◆ ENDLESS WORLDS  [GENRE]   verbosity │
 *   │              MAP CODEX [avatar]       │
 *   ├─────┬───────────────────────┬─────────┤
 *   │ MAP │      STORY FEED       │  CHAR   │
 *   │ 320 │       flex-1          │  280    │
 *   │     │                       │         │
 *   └─────┴───────────────────────┴─────────┘
 *
 * Mobile (<md): single column. Map is a bottom sheet that slides up
 * when the user taps the floating ◆ MAP pill or the header's MAP button.
 */

interface GameLayoutProps {
  genre?:    Genre;
  mainPanel: React.ReactNode;
  sidebar:   React.ReactNode;
  /** Optional left-side map panel. Always rendered when present, with
   *  visibility toggled via the store's `mapPanelOpen` flag (mobile
   *  bottom sheet) and the data-genre selector for theming. */
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
  // Day 20.4.2 TASK 4 — codex modal toggle (replaces Link navigation).
  const codexModalOpen   = useGameStore((s) => s.codexModalOpen);
  const toggleCodexModal = useGameStore((s) => s.toggleCodexModal);

  // The CSS tokens key off short slugs (fantasy / cyber / horror /
  // space / apoc); genre is the full enum value. genreSlug maps both.
  const slug      = genreSlug(genre);
  const genreText = GENRE_LABEL[slug] ?? "FANTASY";

  // Player avatar text — first two letters of the player's name in caps.
  const masterState = useGameStore((s) => s.masterState);
  const playerName  = masterState?.player_state.name ?? "Adventurer";
  const initials    = playerName.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "??";

  // ── Save & Exit ───────────────────────────────────────────────────────────
  async function handleSaveAndExit() {
    if (saveState === "saving" || saveState === "saved") return;
    const state = useGameStore.getState().masterState;
    if (!state) {
      router.push("/dashboard");
      return;
    }
    setSaveState("saving");
    try {
      await fetch("/api/game/state", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionId: state.metadata.session_id, state }),
      });
    } catch {
      // Best-effort — still navigate so the user isn't stuck.
    }
    setSaveState("saved");
    setTimeout(() => { router.push("/dashboard"); }, 2000);
  }
  const saveLabel =
    saveState === "saving" ? "SAVING…" :
    saveState === "saved"  ? "SAVED ✓" :
    "SAVE";

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{
        backgroundColor: "var(--bg-0)",
        color:           "var(--ink-2)",
        fontFamily:      "var(--sans)",
        position:        "relative",
      }}
      data-genre={slug}
    >
      <div className="ew-grain" style={{ ["--grain" as string]: 0.25 }} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        className="z-30 flex shrink-0 items-center"
        style={{
          height:       56,
          padding:      "0 16px",
          borderBottom: "1px solid var(--line)",
          background:   "linear-gradient(180deg, var(--bg-1), var(--bg-0))",
          position:     "relative",
        }}
      >
        {/* Wordmark with diamond glyph */}
        <div
          className="ew-mono"
          style={{
            fontSize:      13,
            letterSpacing: "0.32em",
            color:         "var(--accent)",
            fontWeight:    600,
            display:       "flex",
            alignItems:    "center",
            gap:           12,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M 9 2 L 9 16 M 2 9 L 16 9"
              stroke="currentColor" strokeWidth="0.6" opacity="0.5" />
            <path d="M 9 2 Q 13 9 9 16 Q 5 9 9 2"
              fill="none" stroke="currentColor" strokeWidth="0.8" />
          </svg>
          <span className="hidden sm:inline">ENDLESS WORLDS</span>
        </div>

        {/* Genre badge */}
        <div
          className="ml-3 hidden sm:inline-block sm:ml-7"
          style={{
            padding:       "3px 10px",
            border:        "1px solid var(--accent-soft)",
            borderRadius:  2,
            fontFamily:    "var(--mono)",
            fontSize:      10,
            letterSpacing: "0.24em",
            color:         "var(--accent)",
          }}
        >
          {genreText}
        </div>

        <div style={{ flex: 1 }} />

        {/* Verbosity toggle — three-segment pill */}
        <div className="hidden md:block mr-3">
          <VerbosityToggle />
        </div>

        {/* MAP toggle */}
        {mapPanel && (
          <button
            type="button"
            onClick={toggleMapPanel}
            aria-label={mapPanelOpen ? "Close map" : "Open map"}
            title={mapPanelOpen ? "Close map" : "Open map"}
            style={chromeBtn(mapPanelOpen)}
            className="min-h-[44px] sm:min-h-0"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M 1 3 L 5 5 L 9 3 L 13 5 L 13 11 L 9 9 L 5 11 L 1 9 Z"
                stroke="currentColor" strokeWidth="1.1" fill="none" />
            </svg>
            <span className="hidden sm:inline">MAP</span>
          </button>
        )}

        {/* CODEX — Day 20.4.2 TASK 4: opens as a MODAL overlay on top of
            /game rather than navigating to /game/codex. Previous Link-based
            approach unmounted CombatMode mid-encounter (dropping in-flight
            floating numbers + drain pacing). The /game/codex route remains
            for direct URL access; the modal is the primary path. */}
        <button
          type="button"
          onClick={() => toggleCodexModal()}
          aria-label="Open codex"
          title="Codex"
          style={chromeBtn(codexModalOpen)}
          className="min-h-[44px] sm:min-h-0"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path d="M 2 2 L 7 1 L 12 2 L 12 12 L 7 11 L 2 12 Z M 7 1 L 7 11"
              stroke="currentColor" strokeWidth="1.1" fill="none" />
          </svg>
          <span className="hidden sm:inline">CODEX</span>
        </button>

        {/* Save & Exit — desktop only */}
        <button
          onClick={() => { void handleSaveAndExit(); }}
          disabled={saveState === "saving" || saveState === "saved"}
          className="hidden sm:inline-flex"
          style={{
            ...chromeBtn(false),
            color: saveState === "saved" ? "var(--hl-pass)" : "var(--ink-2)",
            opacity: saveState === "saving" ? 0.6 : 1,
          }}
        >
          <Save className="size-3" aria-hidden />
          {saveLabel}
        </button>

        {/* Avatar pill */}
        <div
          className="ml-2 hidden sm:flex"
          style={{
            display:        "flex",
            alignItems:     "center",
            gap:            10,
            padding:        "4px 12px 4px 4px",
            border:         "1px solid var(--line-2)",
            borderRadius:   2,
          }}
        >
          <div
            style={{
              width:           28,
              height:          28,
              background:      "var(--accent-faint)",
              border:          "1px solid var(--accent-soft)",
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              fontFamily:      "var(--mono)",
              fontSize:        11,
              color:           "var(--accent)",
              letterSpacing:   "0.1em",
            }}
          >
            {initials}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <div
              className="ew-mono"
              style={{
                fontSize:      11,
                color:         "var(--ink-1)",
                letterSpacing: "0.1em",
              }}
            >
              {playerName}
            </div>
          </div>
        </div>

        {/* Mobile: user menu + sidebar toggle */}
        <div className="flex items-center sm:hidden">
          <UserMenu />
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            style={{ color: "var(--accent)" }}
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle character panel"
          >
            <Menu className="size-5" />
          </Button>
        </div>

        {/* Desktop user menu */}
        <div className="hidden sm:block">
          <UserMenu />
        </div>
      </header>

      {/* ── Content row ─────────────────────────────────────────────────── */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Map sidebar — desktop only when mapPanelOpen */}
        {mapPanel && (
          <>
            {/* Mobile bottom-sheet backdrop */}
            {mapPanelOpen && (
              <div
                className="fixed inset-0 z-30 md:hidden"
                style={{ background: "rgba(0,0,0,0.5)" }}
                onClick={() => setMapPanelOpen(false)}
                aria-hidden
              />
            )}

            {/* Mobile bottom sheet */}
            <div
              role="dialog"
              aria-label="World map"
              aria-hidden={!mapPanelOpen}
              className={[
                "fixed inset-x-0 bottom-0 z-40 flex flex-col md:hidden",
                "transition-transform duration-300 ease-in-out",
                mapPanelOpen ? "translate-y-0" : "translate-y-full",
              ].join(" ")}
              style={{ height: "65vh" }}
            >
              {mapPanel}
            </div>

            {/* Desktop left aside */}
            <aside
              className={[
                "hidden md:relative md:flex",
                "transition-all duration-300 ease-in-out",
                mapPanelOpen
                  ? "md:w-[320px] md:max-w-[320px] md:min-w-[320px]"
                  : "md:w-0 md:min-w-0 md:max-w-0 md:overflow-hidden",
              ].join(" ")}
              aria-hidden={!mapPanelOpen}
            >
              <div className="h-full w-full">
                {mapPanel}
              </div>
            </aside>
          </>
        )}

        {/* Floating ◆ MAP pill — mobile only, when map sheet is closed */}
        {mapPanel && !mapPanelOpen && (
          <button
            onClick={() => setMapPanelOpen(true)}
            aria-label="Open map"
            className="md:hidden"
            style={{
              position:      "fixed",
              left:          16,
              bottom:        88,
              padding:       "8px 14px",
              border:        "1px solid var(--accent-soft)",
              background:    "var(--bg-1)",
              color:         "var(--accent)",
              fontFamily:    "var(--mono)",
              fontSize:      10,
              letterSpacing: "0.24em",
              borderRadius:  2,
              cursor:        "pointer",
              boxShadow:     "0 2px 8px rgba(0,0,0,0.4)",
              zIndex:        20,
            }}
          >
            ◆ MAP
          </button>
        )}

        {/* Main panel */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {mainPanel}
        </main>

        {/* Mobile right-sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-10 md:hidden"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Right sidebar — character panel */}
        <aside
          className={[
            "fixed right-0 top-14 z-20 h-[calc(100vh-3.5rem)] w-72 overflow-y-auto",
            "md:relative md:top-auto md:z-auto md:h-auto md:w-[280px] md:max-w-[280px] md:min-w-[280px]",
            "transition-transform duration-300 ease-in-out",
            sidebarOpen ? "translate-x-0 sidebar-slide-in" : "translate-x-full md:translate-x-0",
          ].join(" ")}
          style={{
            borderLeft:      "1px solid var(--line)",
            backgroundColor: "var(--bg-1)",
          }}
        >
          {/* Mobile close row */}
          <div
            className="flex items-center justify-between px-3 py-2 md:hidden"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <span
              className="ew-mono"
              style={{
                fontSize:      9,
                letterSpacing: "0.3em",
                color:         "var(--ink-4)",
              }}
            >
              ◆ CHARACTER
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function chromeBtn(active: boolean): React.CSSProperties {
  return {
    display:        "inline-flex",
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
    padding:        "5px 12px",
    marginLeft:     6,
    border:         active
      ? "1px solid var(--accent)"
      : "1px solid var(--line-2)",
    borderRadius:   2,
    background:     active ? "var(--accent-faint)" : "transparent",
    color:          active ? "var(--accent)" : "var(--ink-2)",
    fontFamily:     "var(--mono)",
    fontSize:       10,
    letterSpacing:  "0.24em",
    cursor:         "pointer",
  };
}
