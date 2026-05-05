import { Genre } from "@/types/game";
import { GENRE_CONFIGS } from "@/lib/game/genre-config";

/**
 * Single source of truth for genre-driven UI colors and labels.
 *
 * Every component that draws an accent (NPC name, arrival header, currency
 * label, HP label, dialogue button border, etc.) reads through this
 * helper so a new genre auto-themes the entire UI by adding an entry to
 * GENRE_CONFIGS — never by editing component code.
 *
 * Returns:
 *   primary    — primary accent (NPC names, arrival headers, dialogue NPC name)
 *   accent     — secondary accent (option borders, divider hints)
 *   currency   — currencyName from genre config, or null when the genre has none
 *   hp         — HP label (e.g. "HP", "Integrity", "Hull Integrity")
 */
export function getGenreColors(genre: Genre) {
  const cfg = GENRE_CONFIGS[genre];
  return {
    primary:  cfg.colorPalette.primary,
    accent:   cfg.colorPalette.accent,
    currency: cfg.vocabulary.currencyName,
    currencyKey: cfg.vocabulary.currency,
    hp:       cfg.vocabulary.hp,
  };
}

/**
 * Tone → accent bar color for dialogue option buttons. These are
 * mechanical states, not genre-specific, so the colors are stable across
 * all five genres.
 */
export const TONE_BAR_COLORS: Record<string, string> = {
  friendly:     "#22aa44",
  neutral:      "#334455",
  curious:      "#4488cc",
  persuasive:   "#8844cc",
  deceptive:    "#aaaa22",
  aggressive:   "#cc4422",
  intimidating: "#cc4422",
};
