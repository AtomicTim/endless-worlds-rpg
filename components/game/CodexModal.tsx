"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/stores/game-store";
import { Genre } from "@/types/game";
import { CodexContent } from "./CodexContent";

/**
 * UI-7 / PR-8v — Codex modal shell.
 *
 * Section 11 of /docs/ui-design-reference.md. Genre card system from
 * UI-1 still drives the border + radius + overlay treatment; PR-8v
 * swaps the surface bg from the shared var(--content-bg) to a
 * per-genre flat near-black plate so the codex reads as its own room
 * (a fantasy tome vs a cyber console vs a horror file cabinet).
 *
 * Renders on top of /game without changing the route, so CombatMode
 * stays mounted (and the active encounter stays in store) while the
 * player consults the codex. Closes on backdrop click, X button, or
 * Escape.
 *
 * PR-8v also widens the shell 580 → 660 to give the new compact-row
 * + inline-accordion layout (see CodexContent) more horizontal room
 * for the entry preview line + NEW badges + the expanded panel grids.
 */

/**
 * PR-8v — Per-genre codex background plates. Each is a flat
 * near-black tinted with a subtle genre hue — distinct enough that
 * the player feels "I'm reading the Fantasy / Cyberpunk / Horror /
 * Space / Post-Apoc codex" the moment they open it, without leaning
 * into the saturated genre accent (which is reserved for chrome).
 *
 * The hex values are registered in lib/__tests__/ui-foundation.test
 * .ts ALLOWED_HEX_CODES under "Codex genre backgrounds (PR-8v)" with
 * a note that they may graduate to globals.css tokens if BG-4 wires
 * more surfaces onto a per-genre plate system.
 */
const GENRE_CODEX_BG: Record<Genre, string> = {
  [Genre.FANTASY]:             "#141008",
  [Genre.CYBERPUNK]:           "#0a1414",
  [Genre.HORROR_LOVECRAFTIAN]: "#100808",
  [Genre.SPACE_OPERA]:         "#08080f",
  [Genre.POST_APOCALYPTIC]:    "#161008",
};

export function CodexModal() {
  const open  = useGameStore((s) => s.codexModalOpen);
  const close = useGameStore((s) => s.setCodexModalOpen);
  const genre = useGameStore(
    (s) => s.masterState?.metadata.genre ?? Genre.FANTASY,
  );
  const [characterName, setCharacterName] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const codexBg = GENRE_CODEX_BG[genre] ?? GENRE_CODEX_BG[Genre.FANTASY];

  return (
    <div
      // UI-7 — backdrop rgba(0,0,0,.82). z-50 sits below the inner
      // entry-detail modal (z-60 in CodexContent). UI-11 adds the
      // shared modal-backdrop-in / modal-card-in entry animations.
      className="fixed inset-0 z-50 flex items-start justify-center modal-backdrop-in"
      style={{ background: "rgba(0,0,0,0.82)" }}
      onClick={() => close(false)}
      role="dialog"
      aria-label="Codex"
      aria-modal="true"
    >
      <div
        className="flex flex-col modal-card-in"
        style={{
          // PR-8v — width lifted min(580, 96vw) → min(660, 96vw) so
          // the compact rows + accordion panels in CodexContent
          // breathe at desktop widths.
          position:     "relative",
          width:        "min(660px, 96vw)",
          maxHeight:    "88vh",
          margin:       "4vh auto",
          // PR-8v — surface bg now resolves through GENRE_CODEX_BG.
          background:   codexBg,
          border:       "1px solid var(--card-border)",
          borderRadius: "var(--card-radius)",
          boxShadow:    "var(--card-shadow)",
          overflow:     "hidden",
          color:        "var(--ink-2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* UI-1 overlay trio — inert on genres that don't opt in. */}
        <div className="ol-tex"  aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }} />
        <div className="ol-scan" aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }} />
        <div className="ol-grid" aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }} />

        {/* Content sits above the overlays. Min-height: 0 so the
            inner scroll body actually scrolls. */}
        <div
          className="relative flex min-h-0 flex-1 flex-col"
          style={{ zIndex: 10 }}
        >
          {/* Header — UI-7 typography pass: serif italic title, neutral
              border, single close ✕. PR-8v swapped the inline hexes
              for tokens (#2d2618 → var(--ui-border-default), #6a5530
              → var(--ui-text-muted)). */}
          <header
            className="flex shrink-0 items-center justify-between"
            style={{
              padding:      "12px 16px",
              borderBottom: "1px solid var(--ui-border-default)",
            }}
          >
            <h1
              className="ew-serif italic"
              style={{
                fontSize:   18,
                color:      "var(--genre-accent)",
                margin:     0,
                lineHeight: 1.2,
              }}
            >
              Codex{characterName ? ` — ${characterName}` : ""}
            </h1>
            <button
              type="button"
              onClick={() => close(false)}
              aria-label="Close codex"
              style={{
                width:           24,
                height:          24,
                border:          "1px solid var(--ui-border-default)",
                background:      "transparent",
                color:           "var(--ui-text-muted)",
                cursor:          "pointer",
                display:         "inline-flex",
                alignItems:      "center",
                justifyContent:  "center",
              }}
            >
              ✕
            </button>
          </header>

          <CodexContent onCharacterNameLoaded={setCharacterName} />
        </div>
      </div>
    </div>
  );
}
