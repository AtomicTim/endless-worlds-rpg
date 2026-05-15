import { Genre } from "@/types/game";

/**
 * UI-4 — Atmospheric fragment pool.
 *
 * Loading Pattern 1: if the LLM hasn't begun streaming after 1200ms,
 * a single fragment from the genre pool renders as italic prose to
 * keep the feed alive. Pool is exhausted before any fragment repeats
 * within the same session — once every fragment for a genre has been
 * used, the seen-set resets.
 *
 * Pools are 10 lines per genre (per the UI-4 prompt). Phrasing stays
 * generic — fragments never reference player state, location, or
 * scene specifics so they can drop in anywhere without contradicting
 * the world.
 */

const POOL: Record<Genre, string[]> = {
  [Genre.FANTASY]: [
    "The torchlight wavers.",
    "Somewhere, a timber creaks.",
    "Dust motes drift in the still air.",
    "A distant sound echoes and fades.",
    "The shadows deepen at the edges.",
    "The air carries a faint chill.",
    "Something stirs beyond the threshold.",
    "The silence settles like sediment.",
    "A cold draught passes through.",
    "The stone exhales an ancient breath.",
  ],
  [Genre.CYBERPUNK]: [
    "Static crackles across the feed.",
    "A neon sign flickers once, twice.",
    "The grid hums beneath your feet.",
    "Data packets scatter.",
    "A server fan cycles up somewhere.",
    "The air tastes of ozone.",
    "A distant siren peaks and drops.",
    "Your HUD blinks once.",
    "The network latency spikes.",
    "Rain taps a code against the glass.",
  ],
  [Genre.HORROR_LOVECRAFTIAN]: [
    "Something shifts in the dark.",
    "The silence is too complete.",
    "A floorboard settles underfoot.",
    "The air grows thick and cold.",
    "Something watches from the shadows.",
    "A sound you cannot place.",
    "The darkness presses closer.",
    "Your breath fogs the cold air.",
    "The walls seem to breathe.",
    "An old smell reaches you.",
  ],
  [Genre.SPACE_OPERA]: [
    "The ship groans under pressure.",
    "Stars drift past the viewport.",
    "A distant alarm cycles off.",
    "The hull contracts in the cold.",
    "Static hisses across the comm.",
    "Gravity ripples for a moment.",
    "Navigation systems recalibrate.",
    "The engines pulse and settle.",
    "A meteorite passes unseen.",
    "The void presses against the glass.",
  ],
  [Genre.POST_APOCALYPTIC]: [
    "Wind moves through broken walls.",
    "Something scurries in the rubble.",
    "Ash drifts on the still air.",
    "The silence holds its breath.",
    "A distant structure settles.",
    "Dust rises from somewhere.",
    "The sky stays the same grey.",
    "Something moves beyond the threshold.",
    "The ground crunches underfoot.",
    "Rust and rot reach your nose.",
  ],
};

/** Module-level seen-set keyed by genre. Cleared once the pool is
 *  exhausted so the next call starts fresh. Survives across hook /
 *  component re-renders so a single play session never repeats a
 *  fragment until every fragment has been used. */
const seen: Partial<Record<Genre, Set<string>>> = {};

/**
 * Pick one atmospheric fragment for the genre, biased toward unseen
 * lines within the current session. When the pool is exhausted, the
 * seen-set resets so future picks restart with the full pool.
 *
 * Pure-ish: the seen-set is module-scoped mutation, but the picker is
 * deterministic given the same RNG seed — callers can inject `rng`
 * for testing. Default RNG is `Math.random` so the picker stays
 * non-deterministic in production.
 */
export function pickAtmosphericFragment(
  genre: Genre,
  rng: () => number = Math.random,
): string {
  const pool = POOL[genre] ?? POOL[Genre.FANTASY];
  if (!seen[genre]) seen[genre] = new Set<string>();
  const used = seen[genre]!;

  // Reset when exhausted (covers the case where every fragment has
  // already been served at least once).
  if (used.size >= pool.length) used.clear();

  const remaining = pool.filter((f) => !used.has(f));
  const choice = remaining[Math.floor(rng() * remaining.length)];
  used.add(choice);
  return choice;
}
