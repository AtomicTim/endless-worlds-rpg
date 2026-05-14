import type {
  ActiveStatusEffect,
  CombatEventRolls,
  Enemy,
  StatusEffectId,
} from "@/types/game";

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
// Status effects (Prompt 1 — combat ailments + buffs)
// ─────────────────────────────────────────────────────────────────────────────

export interface StatusSaveResult {
  saved: boolean;
  roll:  number;
  total: number;
  dc:    number;
  rolls: CombatEventRolls;
}

/**
 * End-of-turn status save. d20 + stat modifier vs effect.save_dc.
 * Buffs use save_dc 0 — they'll always "save" if this is called on
 * them, so the engine routes buffs to a duration-only path and never
 * invokes this for them.
 */
export function rollStatusSave(
  effect:  ActiveStatusEffect,
  statMod: number,
  rng:     Rng = DEFAULT_RNG,
): StatusSaveResult {
  const roll  = rollD20(rng);
  const total = roll + statMod;
  return {
    saved: total >= effect.save_dc,
    roll,
    total,
    dc:    effect.save_dc,
    rolls: { d20: roll, d20_modifier: statMod, target_dc: effect.save_dc },
  };
}

export interface StatusApplicationResult {
  applied:         boolean;
  damage_per_tick: number;
}

/**
 * Probabilistic status application. Rolls rng() against `chance` (a
 * 0-1 probability). When the effect carries DoT (poisoned: 1d4,
 * burning: 1d6) the damage_per_tick is rolled at application time and
 * stored on the ActiveStatusEffect for every subsequent tick.
 */
export function rollStatusApplication(
  effectId: StatusEffectId,
  chance:   number,
  rng:      Rng = DEFAULT_RNG,
): StatusApplicationResult {
  if (rng() >= chance) return { applied: false, damage_per_tick: 0 };
  let damage_per_tick = 0;
  if (effectId === "poisoned") damage_per_tick = rollDamageDie("1d4", rng);
  if (effectId === "burning")  damage_per_tick = rollDamageDie("1d6", rng);
  return { applied: true, damage_per_tick };
}

/**
 * Construct an ActiveStatusEffect with canonical duration / DC /
 * stat_modifier for the given id. Pure — no rng dependence. Callers
 * roll damage_per_tick separately (via rollStatusApplication) and
 * pass it in for DoT effects; pass 0 for non-DoT or unknown.
 */
export function buildStatusEffect(
  id:               StatusEffectId,
  source:           string,
  damage_per_tick = 0,
): ActiveStatusEffect {
  switch (id) {
    case "poisoned":
      return {
        id, source, rounds_remaining: 3, damage_per_tick,
        save_dc: 12, save_stat: "agility",
      };
    case "burning":
      return {
        id, source, rounds_remaining: 2, damage_per_tick,
        save_dc: 14, save_stat: "agility",
      };
    case "chilled":
      return {
        id, source, rounds_remaining: 2, save_dc: 11,
        save_stat: "strength",
        stat_modifier: { stat: "all_rolls", amount: -2 },
      };
    case "weakened":
      return {
        id, source, rounds_remaining: 2, save_dc: 10,
        save_stat: "strength",
        stat_modifier: { stat: "strength", amount: -3 },
      };
    case "frightened":
      return {
        id, source, rounds_remaining: 2, save_dc: 12,
        save_stat: "charisma",
        stat_modifier: { stat: "all_rolls", amount: -2 },
      };
    case "fortified":
      return {
        id, source, rounds_remaining: 3, save_dc: 0,
        save_stat: "strength",
        stat_modifier: { stat: "armor", amount: 3 },
      };
    case "hastened":
      return {
        id, source, rounds_remaining: 2, save_dc: 0,
        save_stat: "agility",
        stat_modifier: { stat: "all_rolls", amount: 3 },
      };
    case "focused":
      return {
        id, source, rounds_remaining: 2, save_dc: 0,
        save_stat: "intelligence",
        stat_modifier: { stat: "intelligence", amount: 3 },
      };
  }
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
  // ── Prompt 1 — Status effect consumables ─────────────────────────────────
  /** Defensive consumable (Antidote, Smelling Salts, etc.) — id of
   *  the ailment to clear on the player. */
  cured_status?:   StatusEffectId;
  /** Offensive / buff consumable — the effect to apply. The caller
   *  decides whether to target self or an enemy via item_effect
   *  .apply_status_target. */
  applied_status?: ActiveStatusEffect;
  /** Offensive consumable burst damage (Fire Bomb etc.) — flat damage
   *  dealt to the target before the status applies. */
  burst_damage?:   number;
}

export function resolveUseItem({
  item_id, item_effect, player, rng = DEFAULT_RNG,
}: {
  item_id:      string;
  /** V8.49 — Item.effect from the inventory entry. When present and
   *  effect.heal is a finite number, used as a flat heal amount. This
   *  is the primary heal path: loot-resolver stamps unique
   *  crypto.randomUUID() ids on every drop so the legacy
   *  BASIC_HEALTH_POTION_ID equality check could never match a looted
   *  potion. Passing the effect object through removes the dependency
   *  on item id matching. */
  item_effect?: Record<string, unknown>;
  player:       { current_hp: number; max_hp: number };
  rng?:         Rng;
}): UseItemResult {
  // V8.49 path 1 — effect.heal carries a flat heal value. Works for
  // every health potion regardless of id (starting equipment, world
  // loot, region loot, boss drops), because the effect field is
  // populated by the loot table author / starting-equipment author at
  // construction time.
  const effectHeal = item_effect?.heal;
  if (typeof effectHeal === "number" && Number.isFinite(effectHeal) && effectHeal > 0) {
    const new_hp = Math.min(player.max_hp, player.current_hp + effectHeal);
    const actual = new_hp - player.current_hp;
    return {
      healed_amount: actual,
      new_hp,
      item_consumed: true,
      rolls: {
        // Flat heal — no die notation. Story-feed templates surface the
        // actual healed amount via damage_die_roll. Omitting damage_die
        // signals "flat" to the template renderer.
        damage_die_roll: actual,
      },
    };
  }

  // V8.49 path 2 — Day 20 BASIC_HEALTH_POTION_ID fallback for any
  // starting-equipment potion that was created before effect fields
  // were normalised. Kept for backwards compatibility; the same 1d8+4
  // die-roll behaviour as the original implementation.
  if (item_id === BASIC_HEALTH_POTION_ID) {
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

  // Prompt 1 — Cure status. Item.effect.cure_status names the ailment
  // to clear on the player; the engine consumes the item and removes
  // the matching ActiveStatusEffect from player_status_effects.
  const cureStatus = item_effect?.cure_status;
  if (typeof cureStatus === "string") {
    return {
      healed_amount: 0,
      new_hp:        player.current_hp,
      item_consumed: true,
      cured_status:  cureStatus as StatusEffectId,
    };
  }

  // Prompt 1 — Offensive / buff consumable. effect.apply_status names
  // the effect to roll, apply_status_chance gates application (default
  // 1.0), and burst_damage adds flat damage applied by the engine
  // before the status. apply_status_target determines who receives
  // the effect (self for buffs, enemy for offensive items).
  const applyStatusId = item_effect?.apply_status;
  if (typeof applyStatusId === "string") {
    const chance   = typeof item_effect?.apply_status_chance === "number"
                       ? (item_effect.apply_status_chance as number) : 1.0;
    const burstDmg = typeof item_effect?.burst_damage === "number"
                       ? (item_effect.burst_damage as number) : 0;
    const app = rollStatusApplication(applyStatusId as StatusEffectId, chance, rng);
    return {
      healed_amount: 0,
      new_hp:        player.current_hp,
      item_consumed: true,
      burst_damage:  burstDmg > 0 ? burstDmg : undefined,
      applied_status: app.applied
        ? buildStatusEffect(applyStatusId as StatusEffectId, item_id, app.damage_per_tick)
        : undefined,
    };
  }

  // Non-healing consumables (Antidote, Trail Rations with effect: {})
  // and unknown items: no-op. Day 22+ wires their effects in.
  return {
    healed_amount: 0,
    new_hp:        player.current_hp,
    item_consumed: false,
  };
}
