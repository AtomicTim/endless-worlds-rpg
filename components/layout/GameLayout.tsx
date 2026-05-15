"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Genre } from "@/types/game";
import { useGameStore } from "@/lib/stores/game-store";
import { genreSlug, genreClassName } from "@/lib/game/genre-slug";
import { TopBar } from "@/components/layout/TopBar";

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
  /** UI-3 — Context Panel. Renders as a fixed left column at lg+
   *  (160/196px wide) and as a slide-from-left drawer below lg
   *  (toggled by the TopBar hamburger). Always rendered when
   *  provided so the desktop column doesn't pop in. */
  contextPanel?: React.ReactNode;
}

type SaveState = "idle" | "saving" | "saved";

export function GameLayout({
  genre = Genre.FANTASY,
  mainPanel,
  sidebar,
  mapPanel,
  contextPanel,
}: GameLayoutProps) {
  const router        = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // UI-3 — Context Panel drawer (mirrors sidebarOpen for the right
  // side; separate state so both drawers can be open / closed
  // independently on tablet widths).
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  const [saveState,   setSaveState]   = useState<SaveState>("idle");
  const mapPanelOpen    = useGameStore((s) => s.mapPanelOpen);
  const setMapPanelOpen = useGameStore((s) => s.setMapPanelOpen);

  // Slug drives data-genre on the root; the long-form genre class (from
  // genreClassName, UI-1) drives the per-genre CSS variable sets.
  const slug = genreSlug(genre);

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
  const saveLabel: "SAVE" | "SAVING…" | "SAVED ✓" =
    saveState === "saving" ? "SAVING…" :
    saveState === "saved"  ? "SAVED ✓" :
    "SAVE";

  return (
    <div
      // UI-1: genre-X class drives the per-genre CSS variable sets
      // (--card-bg, --content-bg, --genre-accent) + overlay / typography
      // / glow rules. data-genre is preserved alongside — existing
      // [data-genre] selectors in globals.css still own --accent.
      className={`flex h-screen flex-col overflow-hidden ${genreClassName(genre)}`}
      style={{
        backgroundColor: "var(--bg-0)",
        color:           "var(--ink-2)",
        fontFamily:      "var(--sans)",
        position:        "relative",
      }}
      data-genre={slug}
    >
      <div className="ew-grain" style={{ ["--grain" as string]: 0.25 }} />

      {/* ── UI-2: Top bar (extracted to components/layout/TopBar.tsx). ─── */}
      <TopBar
        genre={genre}
        mapPanelAvailable={!!mapPanel}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onSaveAndExit={() => { void handleSaveAndExit(); }}
        saveLabel={saveLabel}
        saveDisabled={saveState === "saving" || saveState === "saved"}
        onOpenContextPanel={
          contextPanel ? () => setContextPanelOpen(true) : undefined
        }
      />

      {/* ── Content row ─────────────────────────────────────────────────── */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* ── UI-3: Context Panel — fixed left column (lg+) ────────────── */}
        {contextPanel && (
          <aside
            aria-label="Context Panel"
            className="hidden lg:flex shrink-0 overflow-hidden lg:w-[160px] lg:min-w-[160px] lg:max-w-[160px] xl:w-[196px] xl:min-w-[196px] xl:max-w-[196px]"
            style={{ borderRight: "1px solid #2d2618" }}
          >
            <div className="h-full w-full overflow-y-auto">
              {contextPanel}
            </div>
          </aside>
        )}

        {/* ── UI-3: Context Panel — mobile / tablet drawer (<lg) ────────── */}
        {contextPanel && (
          <>
            {/* Backdrop — tap closes the drawer. */}
            {contextPanelOpen && (
              <div
                className="fixed inset-0 lg:hidden"
                style={{ background: "rgba(0,0,0,0.5)", zIndex: 39 }}
                onClick={() => setContextPanelOpen(false)}
                aria-hidden
              />
            )}
            {/* Drawer panel — slide from left. cubic-bezier(0.22,1,0.36,1)
                per UI design ref §4 (300ms). */}
            <aside
              role="dialog"
              aria-label="Context Panel"
              aria-hidden={!contextPanelOpen}
              className="fixed left-0 top-0 lg:hidden overflow-hidden"
              style={{
                width:      280,
                height:     "100vh",
                zIndex:     40,
                transform:  contextPanelOpen ? "translateX(0)" : "translateX(-100%)",
                transition: "transform 300ms cubic-bezier(0.22,1,0.36,1)",
                background: "var(--content-bg)",
                borderRight: "1px solid #2d2618",
              }}
            >
              <div className="h-full w-full overflow-y-auto">
                {contextPanel}
              </div>
            </aside>
          </>
        )}

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

