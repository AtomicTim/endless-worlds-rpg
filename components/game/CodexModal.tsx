"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/stores/game-store";
import { CodexContent } from "./CodexContent";

/**
 * Day 20.4.2 TASK 4 — Codex modal overlay.
 *
 * Renders as a full-screen overlay on top of /game without changing
 * the route, so CombatMode stays mounted (and the active encounter
 * stays in store) while the player consults the codex. Before 20.4.2
 * the codex button navigated to /game/codex via Link, which unmounted
 * the game page and dropped any in-flight combat state.
 *
 * The /game/codex route still exists for direct URL linking — see
 * app/game/codex/page.tsx. Both paths render the same CodexContent
 * body; only the surrounding chrome differs.
 *
 * Closes on: backdrop click, X button click, Escape key. State lives
 * in the game store (codexModalOpen) so any chrome button can toggle
 * it.
 */
export function CodexModal() {
  const open  = useGameStore((s) => s.codexModalOpen);
  const close = useGameStore((s) => s.setCodexModalOpen);
  const [characterName, setCharacterName] = useState<string>("");

  // ESC closes the modal. The inner entry-detail modal owns its own
  // ESC handler — that fires first because its listener is added
  // LATER (the entry detail mounts after the codex shell), so opening
  // an entry and pressing ESC closes the entry first, then the whole
  // codex on the next press. Good UX.
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
      // z-50 below the entry-detail modal (z-60 in CodexContent) so the
      // detail view sits ABOVE this shell when both are open.
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70"
      onClick={() => close(false)}
      role="dialog"
      aria-label="Codex"
      aria-modal="true"
    >
      <div
        className="flex w-full max-w-5xl flex-col font-mono shadow-2xl"
        style={{
          backgroundColor: "var(--color-bg)",
          color:           "var(--color-text)",
          border:          "1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)",
          margin:          "2vh auto",
          maxHeight:       "96vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header — same layout as the /game/codex route page,
            but the back link is replaced by a close X. */}
        <header
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📖</span>
            <h1
              className="text-lg font-bold tracking-wide"
              style={{ color: "var(--color-primary)" }}
            >
              Codex {characterName ? `— ${characterName}'s World` : ""}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => close(false)}
            className="text-xl font-mono"
            style={{ color: "var(--color-muted)" }}
            aria-label="Close codex"
          >
            ✕
          </button>
        </header>
        <CodexContent onCharacterNameLoaded={setCharacterName} />
      </div>
    </div>
  );
}
