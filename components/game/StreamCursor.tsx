"use client";

import React from "react";
import { Genre } from "@/types/game";
import { useGameStore } from "@/lib/stores/game-store";
import { genreSlug } from "@/lib/game/genre-slug";

/**
 * UI-4 — Genre-specific streaming cursor.
 *
 * Renders a single cursor glyph followed by a CSS animation pulled
 * from `app/globals.css` via the genre slug. Animation timing /
 * easing is genre-coded per UI design ref §5:
 *
 *   Fantasy    │  soft amber blink (900ms ease-in-out)
 *   Cyberpunk  █  hard on/off block (400ms steps)
 *   Horror     ▌  irregular flicker (1500ms uneven keyframe)
 *   Space      ·  slow fade pulse (1400ms ease-in-out)
 *   Post-Apoc  ▍  slow heavy blink (1200ms steps)
 *
 * Colour: always var(--genre-accent). The cursor reads the active
 * genre from the store (single source of truth — no prop drilling).
 * Caller controls visibility — render this component only while the
 * stream is actively in progress, then unmount when done.
 */

interface StreamCursorProps {
  /** Override the genre lookup — useful for tests / Storybook. */
  genreOverride?: Genre;
  /** Optional className mixed in alongside the cursor-* animation
   *  class so callers can place the cursor inline next to text. */
  className?: string;
  /** Optional inline-style overrides — fontSize, marginLeft, etc. */
  style?: React.CSSProperties;
}

const GLYPH: Record<string, string> = {
  fantasy: "│",
  cyber:   "█",
  horror:  "▌",
  space:   "·",
  apoc:    "▍",
};

const ANIM_CLASS: Record<string, string> = {
  fantasy: "ew-cursor-fantasy",
  cyber:   "ew-cursor-cyberpunk",
  horror:  "ew-cursor-horror",
  space:   "ew-cursor-space",
  apoc:    "ew-cursor-postapoc",
};

export function StreamCursor({ genreOverride, className, style }: StreamCursorProps) {
  const storeGenre = useGameStore((s) => s.masterState?.metadata.genre);
  const slug = genreSlug(genreOverride ?? storeGenre ?? Genre.FANTASY);

  return (
    <span
      aria-hidden
      className={`${ANIM_CLASS[slug] ?? ANIM_CLASS.fantasy} ${className ?? ""}`.trim()}
      style={{
        display:     "inline-block",
        color:       "var(--genre-accent)",
        fontFamily:  "var(--mono)",
        lineHeight:  1,
        ...style,
      }}
    >
      {GLYPH[slug] ?? GLYPH.fantasy}
    </span>
  );
}
