import type { Enemy } from "@/types/game";

/**
 * Day 20 Combat — stub loot drops (combat-spec §11).
 *
 * Day 20 ships with a hardcoded placeholder drop model. The real
 * regional loot tables land in Day 21; until then every defeated
 * enemy rolls against this simple table:
 *   • 25-50% chance of dropping gold (1d6 + xp_value/10, rounded down)
 *   • 5% chance of dropping a basic health potion (id only — the
 *     potion's stats live in the genre's starting consumables)
 *
 * The combat resolver (Prompt 2) calls rollStubDrops on each kill
 * and pipes the result into the player's inventory + currency.
 * For now this lives in code, not in enemy data, so the bestiary
 * stays a pure stat-block file.
 */

export type ItemId = string;

export interface StubDrops {
  /** Currency awarded — 0 when the gold roll fails. */
  gold:  number;
  /** Item ids dropped (at most one for Day 20: the basic health potion). */
  items: ItemId[];
}

/** Probability the enemy drops any gold at all. Within this range
 *  ([0.25, 0.50]) every enemy has a unique roll determined by its
 *  xp_value so weaker enemies don't all hit the same chance. */
const GOLD_DROP_MIN = 0.25;
const GOLD_DROP_MAX = 0.50;
/** Flat probability of a health potion drop. */
const POTION_DROP_RATE = 0.05;
/** Item id for the Day 20 basic health potion. The Day 21 loot
 *  system will replace this with proper consumable rows. */
export const BASIC_HEALTH_POTION_ID = "consumable_basic_health_potion";

/**
 * Roll loot drops for one defeated enemy.
 *
 * Optional `rng` argument is used by tests to inject a deterministic
 * source. Production code passes Math.random by default.
 */
export function rollStubDrops(
  enemy: Enemy,
  rng:   () => number = Math.random
): StubDrops {
  // ── Gold roll ─────────────────────────────────────────────────────────────
  // Per-enemy gold drop chance scales with xp_value within [0.25, 0.50] so
  // boss-tier kills are slightly more reliable than rats. xp_value 10 → 0.25,
  // xp_value 1000 → ~0.50. Linearly interpolate.
  const xpClamped = Math.max(0, Math.min(1000, enemy.xp_value));
  const goldChance =
    GOLD_DROP_MIN + (GOLD_DROP_MAX - GOLD_DROP_MIN) * (xpClamped / 1000);

  let gold = 0;
  if (rng() < goldChance) {
    // 1d6 + xp_value/10 (rounded down, minimum 1).
    const d6  = Math.floor(rng() * 6) + 1;
    const bonus = Math.floor(enemy.xp_value / 10);
    gold = Math.max(1, d6 + bonus);
  }

  // ── Potion roll ───────────────────────────────────────────────────────────
  const items: ItemId[] = [];
  if (rng() < POTION_DROP_RATE) {
    items.push(BASIC_HEALTH_POTION_ID);
  }

  return { gold, items };
}
