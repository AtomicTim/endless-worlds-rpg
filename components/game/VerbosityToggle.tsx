"use client";

import { Genre } from "@/types/game";
import { useGameStore } from "@/lib/stores/game-store";
import { getGenreColors } from "./genre-ui";

const OPTIONS: Array<{ key: "terse" | "standard" | "rich"; label: string }> = [
  { key: "terse",    label: "Terse"    },
  { key: "standard", label: "Standard" },
  { key: "rich",     label: "Rich"     },
];

/**
 * Three-state response-length toggle. Reads + writes useGameStore.verbosity.
 * Active button is highlighted with the current genre's primary colour
 * (read via getGenreColors so all five genres theme correctly).
 *
 * Renders inline in the game header. Mono-font terminal aesthetic.
 */
export function VerbosityToggle() {
  const verbosity   = useGameStore((s) => s.verbosity);
  const setVerbosity = useGameStore((s) => s.setVerbosity);
  const genre       = useGameStore((s) => s.masterState?.metadata.genre) ?? Genre.FANTASY;
  const { primary } = getGenreColors(genre);

  return (
    <div
      role="group"
      aria-label="Narrator verbosity"
      className="hidden items-center gap-0 sm:flex"
      // UI-fix-A — Toggle is UI chrome (label triplet) → Inter Tight
      // via var(--sans). Was --font-mono (Courier→JetBrains Mono).
      style={{ fontFamily: "var(--sans)" }}
    >
      {OPTIONS.map((opt) => {
        const active = verbosity === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => {
              // FIX 6 — log each toggle click so we can confirm the
              // setter is actually running and the store is mutating.
              console.log("[VerbosityToggle] setting verbosity:", opt.key);
              setVerbosity(opt.key);
            }}
            className="px-2 py-1 text-[11px] uppercase tracking-wider transition-colors"
            style={{
              color:           active ? "var(--action-fade)" : "var(--color-muted)",
              borderBottom:    active ? `2px solid ${primary}` : "2px solid transparent",
              backgroundColor: "transparent",
              fontFamily:      "var(--sans)",
            }}
            aria-pressed={active}
            title={`${opt.label} responses`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
