import { Genre } from "@/types/game";

/**
 * Map the game's Genre enum to the short slug the design CSS expects
 * on `data-genre`. Single source of truth — every component that themes
 * by genre reads through this so we don't drift between
 * "horror_lovecraftian" / "horror" / "Horror".
 */
export function genreSlug(genre: Genre | string | null | undefined): string {
  if (!genre) return "fantasy";
  const raw = String(genre).toLowerCase();
  if (raw.includes("cyber"))   return "cyber";
  if (raw.includes("horror"))  return "horror";
  if (raw.includes("space"))   return "space";
  if (raw.includes("apoc"))    return "apoc";
  return "fantasy";
}

/** Human-readable label for the header genre badge. */
export const GENRE_LABEL: Record<string, string> = {
  fantasy: "FANTASY",
  cyber:   "CYBERPUNK",
  horror:  "HORROR",
  space:   "SPACE OPERA",
  apoc:    "POST-APOC",
};

/**
 * UI-1 — long-form genre class name applied to the outermost game
 * container. Coexists with `data-genre={slug}` (UI design ref §3 +
 * CLAUDE.md Story Feed Colors token system): data-genre still drives
 * --accent overrides via existing selectors, and the class drives the
 * per-genre CSS variable sets (--card-bg, --content-bg, etc.) and the
 * overlay / typography / glow rules in app/globals.css.
 *
 * Two slug names diverge from the design ref class names (cyber vs
 * cyberpunk, apoc vs postapoc); this helper bridges that without
 * mutating the short slugs the existing data-genre selectors depend on.
 */
const GENRE_CLASS: Record<string, string> = {
  fantasy: "genre-fantasy",
  cyber:   "genre-cyberpunk",
  horror:  "genre-horror",
  space:   "genre-space",
  apoc:    "genre-postapoc",
};
export function genreClassName(genre: Genre | string | null | undefined): string {
  return GENRE_CLASS[genreSlug(genre)] ?? "genre-fantasy";
}
