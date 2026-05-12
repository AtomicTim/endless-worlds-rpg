import { Genre } from "@/types/game";

/**
 * Day 21 — shared genre→currency lookup. Replaces the private
 * `GENRE_CURRENCY_KEY` map in combat-engine.ts so the same
 * resolution is used by combat victory rewards, the loot resolver,
 * SEARCH REMAINS gold deposit, and the FloorLootStrip display label.
 *
 * `currencyKeyFor` returns the `player_state.resources` map key where
 * the genre's primary currency accumulates.
 * `currencyLabelFor` returns the human display label rendered in the
 * loot strip pill and merchant UI.
 *
 * Horror coverage note: V8.46-era CLAUDE.md still lists Horror as
 * "currency: None" — but Day 21's loot model requires every genre to
 * surface a currency for floor pickups. We standardize on "marks" /
 * "Marks" for horror to match the spec the Day 21 prompt locks in.
 */

const CURRENCY_KEY: Record<Genre, string> = {
  [Genre.FANTASY]:             "gold",
  [Genre.CYBERPUNK]:           "credits",
  [Genre.HORROR_LOVECRAFTIAN]: "marks",
  [Genre.SPACE_OPERA]:         "stellar_units",
  [Genre.POST_APOCALYPTIC]:    "caps",
};

const CURRENCY_LABEL: Record<Genre, string> = {
  [Genre.FANTASY]:             "Gold",
  [Genre.CYBERPUNK]:           "Credits",
  [Genre.HORROR_LOVECRAFTIAN]: "Marks",
  [Genre.SPACE_OPERA]:         "Stellar Units",
  [Genre.POST_APOCALYPTIC]:    "Caps",
};

/**
 * Genre → `player_state.resources` map key for the genre's primary
 * currency. Falls back to "gold" for unknown / undefined genres so
 * legacy saves and string-typed callers continue to work.
 */
export function currencyKeyFor(genre: Genre | string | undefined): string {
  return CURRENCY_KEY[genre as Genre] ?? "gold";
}

/**
 * Genre → display label for currency pills, merchant UI, etc.
 * "Gold" / "Credits" / "Marks" / "Stellar Units" / "Caps".
 */
export function currencyLabelFor(genre: Genre | string | undefined): string {
  return CURRENCY_LABEL[genre as Genre] ?? "Gold";
}
