import type { Enemy } from "@/types/game";

/**
 * Cyberpunk genre bestiary — Day 20 placeholder (combat-spec §6.4),
 * rebalanced V8.51 for the calibrated 2-10 player stat range. Same
 * retune pattern as fantasy.ts: tier-1 −25% HP / agi −1 (min 0);
 * mid-tier −15% HP / agi unchanged.
 *
 * 3 entries roughly mapping the Fantasy ladder (giant rat → goblin →
 * orc tier). Full bestiary tuning lands when Cyberpunk gets dedicated
 * combat-content attention.
 */
export const CYBER_BESTIARY: Enemy[] = [
  {
    id:              "cyber_street_thug",
    name:            "Street Thug",
    description:     "A gutter-grade tough in mismatched armor plates, swinging a length of rebar with corporate logos still flecked across it.",
    // V8.51 tier-1 — was hp [8,12], agi 1. Now hp [6,9], agi 0
    // → DC 11. Standard tier-1 brawler.
    hp_range:        [6, 9],
    agi_mod:         0,
    str_mod:         1,
    damage_die:      "1d6",
    armor_bonus:     1,
    xp_value:        30,
    loot_table_id:   "cyber_street_thug_loot",
    is_boss:         false,
    behavior_flavor: "opportunistic brawler",
  },
  {
    id:              "cyber_security_drone",
    name:            "Security Drone",
    description:     "A fist-sized quadcopter chassis with a stubby muzzle, visor glowing the corporate red of a bored killer.",
    // V8.51 tier-2 — was hp [10,14]. Now hp [8,12]. Agi stays high
    // (drone evasion is the identity); DC 15 makes this a tough hit
    // but the chassis is fragile when struck.
    hp_range:        [8, 12],
    agi_mod:         3,
    str_mod:         0,
    damage_die:      "1d6",
    armor_bonus:     2,
    xp_value:        50,
    loot_table_id:   "cyber_security_drone_loot",
    is_boss:         false,
    behavior_flavor: "ranged hunter",
  },
  {
    id:              "cyber_gang_enforcer",
    name:            "Gang Enforcer",
    description:     "A cyber-augmented heavy in patched plating, prosthetic arm humming as it tightens its grip on a vibroblade.",
    // V8.51 tier-3 — was hp [18,24]. Now hp [15,20].
    hp_range:        [15, 20],
    agi_mod:         0,
    str_mod:         3,
    damage_die:      "1d10",
    armor_bonus:     2,
    xp_value:        80,
    loot_table_id:   "cyber_gang_enforcer_loot",
    is_boss:         false,
    behavior_flavor: "augmented bruiser",
  },
];
