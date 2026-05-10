import type { CombatEventRolls, Enemy } from "@/types/game";

/**
 * Day 20 Combat — pure math layer (combat-spec §5).
 *
 * Every function is referentially transparent: takes inputs, returns
 * outputs, mutates nothing. RNG is injected via an optional `rng`
 * parameter (defaults to Math.random) so tests can force specific
 * roll sequences. State mutations live in `combat-engine.ts`.
 *
 * Function signatures track the spec exactly. Names match the prompt
 * verbatim so call sites read like the design doc.
 */

export type Rng = () => number;

const DEFAULT_RNG: Rng = Math.random;

// ─────────────────────────────────────────────────────────────────────────────
// Dice
// ─────────────────────────────────────────────────────────────────────────────

/** 1d20 — integer in [1, 20] inclusive. */
export function rollD20(rng: Rng = DEFAULT_RNG): number {
  return Math.floor(rng() * 20) + 1;
}

/**
 * Parse a dice notation string like "1d6" / "2d4" / "1d10" and roll it.
 * Returns the SUM of all rolled dice. Invalid input throws — combat
 * code should never reach the resolver with a malformed die because
 * apply-world-bible / apply-regional-bible validate the bestiary at
 * persistence time.
 */
export function rollDamageDie(die: string, rng: Rng = DEFAULT_RNG): number {
  const parsed = parseDie(die);
  let total = 0;
  for (let i = 0; i < parsed.count; i += 1) {
    total += Math.floor(rng() * parsed.sides) + 1;
  }
  return total;
}

/** Maximum possible roll for a die — used for crit damage (spec §5.2). */
export function maxDamageDie(die: string): number {
  const parsed = parseDie(die);
  return parsed.count * parsed.sides;
}

function parseDie(die: string): { count: number; sides: number } {
  const m = /^(\d+)d(\d+)$/.exec(die.trim());
  if (!m) {
    throw new Error(`combat-resolver: invalid damage_die "${die}"`);
  }
  const count = parseInt(m[1], 10);
  const sides = parseInt(m[2], 10);
  if (count < 1 || sides < 2) {
    throw new Error(`combat-resolver: damage_die out of range "${die}"`);
  }
  return { count, sides };
}

// ─────────────────────────────────────────────────────────────────────────────
// Spawning
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Random integer in [hp_range[0], hp_range[1]] inclusive. Each spawn
 * gets its own roll so a goblin pack varies in toughness.
 */
export function rollEnemyHP(enemy: Enemy, rng: Rng = DEFAULT_RNG): number {
  const [lo, hi] = enemy.hp_range;
  if (hi <= lo) return lo;
  return Math.floor(rng() * (hi - lo + 1)) + lo;
}

// ─────────────────────────────────────────────────────────────────────────────
// Initiative
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Roll initiative for every combatant. Returns ids in descending
 * `1d20 + agi_mod` order. Player ties go first (spec §5.6) — the
 * tie-breaker treats the literal "PLAYER" id as ordering above any
 * enemy at the same total.
 */
export function rollInitiative(
  combatants: Array<{ id: string; agi_mod: number }>,
  rng:        Rng = DEFAULT_RNG
): string[] {
  const rolled = combatants.map((c) => ({
    id:    c.id,
    total: rollD20(rng) + c.agi_mod,
    /** Player wins ties — sort key 1 vs 0. */
    tie:   c.id === "PLAYER" ? 1 : 0,
  }));
  rolled.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return b.tie - a.tie;
  });
  return rolled.map((r) => r.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Attack resolution (spec §5.2)
// ─────────────────────────────────────────────────────────────────────────────

export interface AttackerInput {
  name:         string;
  agi_mod:      number;
  str_mod:      number;
  damage_die:   string;
  /** Used by Prompt 3 narrator; not required for math. */
  weapon_name?: string;
}

export interface TargetInput {
  name:        string;
  agi_mod:     number;
  armor_bonus: number;
  current_hp:  number;
}

export interface AttackResult {
  outcome:        "hit" | "miss" | "crit" | "fumble";
  /** 0 on miss/fumble; on hit it's >= 1. */
  damage:         number;
  /** Raw 1d20 result before modifier. */
  hit_roll:       number;
  /** hit_roll + attacker.agi_mod. */
  hit_total:      number;
  /** 10 + target.agi_mod + target.armor_bonus. */
  target_dc:      number;
  /** True when damage >= target.current_hp. */
  killed_target:  boolean;
  /** Day 20.4 — granular roll detail for the inline-display +
   *  floating-damage features. Populated for every outcome. */
  rolls:          CombatEventRolls;
}

export function resolveAttack({
  attacker, target, rng = DEFAULT_RNG,
}: {
  attacker: AttackerInput;
  target:   TargetInput;
  rng?:     Rng;
}): AttackResult {
  const hit_roll  = rollD20(rng);
  const target_dc = 10 + target.agi_mod + target.armor_bonus;

  // Critical fumble: nat 1 always misses, no damage. (§5.2)
  if (hit_roll === 1) {
    return {
      outcome:       "fumble",
      damage:        0,
      hit_roll,
      hit_total:     hit_roll + attacker.agi_mod,
      target_dc,
      killed_target: false,
      rolls: {
        d20:          hit_roll,
        d20_modifier: attacker.agi_mod,
        target_dc,
      },
    };
  }

  // Critical hit: nat 20 always hits, double damage formula. (§5.2)
  // damage = max_die + 1d(die) + str_mod, min 1.
  if (hit_roll === 20) {
    const critMax  = maxDamageDie(attacker.damage_die);
    const bonusRoll = rollDamageDie(attacker.damage_die, rng);
    const critDamage = Math.max(1, critMax + bonusRoll + attacker.str_mod);
    return {
      outcome:       "crit",
      damage:        critDamage,
      hit_roll,
      hit_total:     hit_roll + attacker.agi_mod,
      target_dc,
      killed_target: critDamage >= target.current_hp,
      rolls: {
        d20:             hit_roll,
        d20_modifier:    attacker.agi_mod,
        target_dc,
        damage_die:      attacker.damage_die,
        damage_die_roll: bonusRoll,
        crit_max_damage: critMax,
        str_modifier:    attacker.str_mod,
      },
    };
  }

  const hit_total = hit_roll + attacker.agi_mod;
  if (hit_total >= target_dc) {
    const dieRoll = rollDamageDie(attacker.damage_die, rng);
    const damage  = Math.max(1, dieRoll + attacker.str_mod);
    return {
      outcome:       "hit",
      damage,
      hit_roll,
      hit_total,
      target_dc,
      killed_target: damage >= target.current_hp,
      rolls: {
        d20:             hit_roll,
        d20_modifier:    attacker.agi_mod,
        target_dc,
        damage_die:      attacker.damage_die,
        damage_die_roll: dieRoll,
        str_modifier:    attacker.str_mod,
      },
    };
  }

  return {
    outcome:       "miss",
    damage:        0,
    hit_roll,
    hit_total,
    target_dc,
    killed_target: false,
    rolls: {
      d20:          hit_roll,
      d20_modifier: attacker.agi_mod,
      target_dc,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Defend (spec §5.3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Defend has no randomness — sets a state flag the caller honors
 * until the player's next turn. Stays here so callers don't have to
 * special-case the action shape.
 */
export function resolveDefend(): { applied: true } {
  return { applied: true };
}

/**
 * Apply the defend buff to incoming damage: half (rounded down,
 * minimum 1). The +2 AGI for defense applies in resolveAttack via
 * the caller modifying target.agi_mod before the call — keeps the
 * resolver's signature clean.
 */
export function applyDefendDamageReduction(damage: number): number {
  if (damage <= 0) return 0;
  return Math.max(1, Math.floor(damage / 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// Flee (spec §5.5)
// ─────────────────────────────────────────────────────────────────────────────

export interface FleeResult {
  success:   boolean;
  flee_roll: number;
  flee_dc:   number;
  /** Day 20.4 — granular roll detail. */
  rolls:     CombatEventRolls;
}

export function resolveFlee({
  player, enemies, rng = DEFAULT_RNG,
}: {
  player:  { agi_mod: number };
  enemies: Array<{ alive: boolean; agi_mod: number }>;
  rng?:    Rng;
}): FleeResult {
  const living = enemies.filter((e) => e.alive);
  // Average AGI of living enemies. Empty (no enemies left) → 0; the
  // flee resolver shouldn't really fire then but defensive defaults
  // beat NaN math.
  const avgAgi = living.length === 0
    ? 0
    : living.reduce((sum, e) => sum + e.agi_mod, 0) / living.length;
  const d20       = rollD20(rng);
  const flee_roll = d20 + player.agi_mod;
  const flee_dc   = 10 + avgAgi;
  return {
    success: flee_roll >= flee_dc,
    flee_roll,
    flee_dc,
    rolls: {
      d20,
      d20_modifier: player.agi_mod,
      target_dc:    flee_dc,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Use item (spec §5.4)
// ─────────────────────────────────────────────────────────────────────────────

/** Item id for the Day 20 basic health potion (matches stub-drops.ts). */
export const BASIC_HEALTH_POTION_ID = "consumable_basic_health_potion";

export interface UseItemResult {
  healed_amount:  number;
  new_hp:         number;
  item_consumed:  boolean;
  /** Day 20.4 — granular roll detail. Populated for the basic health
   *  potion (1d8 + 4). Empty for unknown items (no-op resolution). */
  rolls?:         CombatEventRolls;
}

export function resolveUseItem({
  item_id, player, rng = DEFAULT_RNG,
}: {
  item_id: string;
  player:  { current_hp: number; max_hp: number };
  rng?:    Rng;
}): UseItemResult {
  // Day 20 only resolves the basic health potion. Other consumables
  // pass through as no-ops; Day 21's Container + Loot system adds
  // antidotes and buff items.
  if (item_id !== BASIC_HEALTH_POTION_ID) {
    return {
      healed_amount: 0,
      new_hp:        player.current_hp,
      item_consumed: false,
    };
  }
  // Heal 1d8 + 4, capped at max_hp.
  const dieRoll = rollDamageDie("1d8", rng);
  const heal    = dieRoll + 4;
  const new_hp  = Math.min(player.max_hp, player.current_hp + heal);
  const actual  = new_hp - player.current_hp;
  return {
    healed_amount: actual,
    new_hp,
    item_consumed: true,
    rolls: {
      damage_die:      "1d8",
      damage_die_roll: dieRoll,
      // No d20 / target_dc on heals; +4 is a flat bonus, not a STR modifier.
    },
  };
}
