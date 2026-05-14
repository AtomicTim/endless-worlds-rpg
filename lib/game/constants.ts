/**
 * Day 21 — global gameplay constants.
 *
 * Tunables that don't belong to any one module live here so adjusting
 * them is a one-line change. Treat as locked design values; flag any
 * change to the team before tuning.
 */

/**
 * Maximum unique inventory rows on a single player. The 21st pickup
 * is refused at the TAKE handler level — the FloorLootStrip's item
 * pills go disabled with a "(Inventory Full)" warning, but gold pills
 * remain active because gold lives in `player_state.resources`, not
 * `inventory`. Day 21 single-player; the Day 24 multiplayer round
 * will recompute caps per party member.
 *
 * Stackable items (potions, ammo) consume ONE slot regardless of
 * quantity. Equipped gear still occupies its slot.
 */
export const INVENTORY_CAP = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Day 22 — leveling system
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maximum player level. Revisited after vertical slice playtest (per
 * Day 22 design decisions in project-log.md). Tuning this value
 * lengthens or shortens the long-tail progression; the XP_THRESHOLDS
 * array below must remain at LEVEL_CAP - 1 entries.
 */
export const LEVEL_CAP = 10;

/**
 * Hard cap on every attribute. Starting archetypes already grant up to
 * 4 on the primary stat (base 2 + STAT_PRIMARY_BONUS 2); 10 reserves
 * 6 levels of growth headroom which lines up with LEVEL_CAP=10.
 */
export const STAT_CAP = 10;

/**
 * Baseline value every attribute starts at. Archetype primary +2 →
 * starts at 4; archetype secondary +1 → starts at 3; everything else
 * stays at this base.
 */
export const STAT_BASE = 2;

/**
 * Bonus the archetype's PRIMARY stat receives at character creation.
 * Stacks with STAT_BASE: primary = STAT_BASE + STAT_PRIMARY_BONUS = 4.
 */
export const STAT_PRIMARY_BONUS = 2;

/**
 * Bonus the archetype's SECONDARY stat receives at character creation.
 * Stacks with STAT_BASE: secondary = STAT_BASE + STAT_SECONDARY_BONUS = 3.
 */
export const STAT_SECONDARY_BONUS = 1;

/**
 * XP required to REACH each subsequent level, starting from level 1.
 *
 *   XP_THRESHOLDS[0] = 100  → 100 total XP to reach level 2 from level 1
 *   XP_THRESHOLDS[1] = 200  → 200 total XP to reach level 3 from level 2
 *   …
 *   XP_THRESHOLDS[8] = 2300 → 2300 total XP to reach level 10 from level 9
 *
 * These are TOTAL XP thresholds, not deltas. The level resolver
 * compares `player.xp` against `XP_THRESHOLDS[currentLevel - 1]` to
 * detect a crossing. Length is LEVEL_CAP - 1 (no threshold for level
 * 11 because LEVEL_CAP is the ceiling).
 */
export const XP_THRESHOLDS = [100, 200, 350, 550, 800, 1100, 1450, 1850, 2300];

/**
 * Flat HP granted on level-up, indexed by the archetype's PRIMARY
 * stat. STR archetypes scale durably (+8), AGI moderately (+6),
 * caster/finesse classes (+5). No CON stat by design — HP growth is
 * archetype-flavoured instead (Day 22 design decision).
 */
export const HP_PER_LEVEL: Record<string, number> = {
  strength:     8,
  agility:      6,
  intelligence: 5,
  perception:   5,
  charisma:     5,
};
