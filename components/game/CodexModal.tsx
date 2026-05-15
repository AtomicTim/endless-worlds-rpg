"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/stores/game-store";
import { CodexContent } from "./CodexContent";

/**
 * UI-7 — Codex modal shell.
 *
 * Section 11 of /docs/ui-design-reference.md. Pure visual redesign
 * over the prior shell (Day 20.4.2 TASK 4) — no data, no logic, no
 * tab structure change. Genre card system from UI-1 drives the
 * surface (var(--content-bg) / var(--card-border) /
 * var(--card-radius)) with the standard three overlay divs.
 *
 * Renders on top of /game without changing the route, so CombatMode
 * stays mounted (and the active encounter stays in store) while the
 * player consults the codex. Closes on backdrop click, X button, or
 * Escape. The inner entry-detail overlay (CodexContent) owns its own
 * ESC handler; opening an entry + pressing ESC closes the entry
 * first, then the codex shell on the next press.
 */
export function CodexModal() {
  const open  = useGameStore((s) => s.codexModalOpen);
  const close = useGameStore((s) => s.setCodexModalOpen);
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

  return (
    <div
      // UI-7 — backdrop rgba(0,0,0,.82). z-50 sits below the inner
      // entry-detail modal (z-60 in CodexContent).
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ background: "rgba(0,0,0,0.82)" }}
      onClick={() => close(false)}
      role="dialog"
      aria-label="Codex"
      aria-modal="true"
    >
      <div
        className="flex flex-col"
        style={{
          position:     "relative",
          width:        "min(580px, 96vw)",
          maxHeight:    "88vh",
          margin:       "4vh auto",
          background:   "var(--content-bg)",
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
              border, single close ✕. */}
          <header
            className="flex shrink-0 items-center justify-between"
            style={{
              padding:      "12px 16px",
              borderBottom: "1px solid #2d2618",
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
                border:          "1px solid #2d2618",
                background:      "transparent",
                color:           "#6a5530",
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
