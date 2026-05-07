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
