import type { Enemy } from "@/types/game";

/**
 * Cyberpunk genre bestiary — Day 20 placeholder (combat-spec §6.4).
 *
 * 3 entries roughly mapping the Fantasy ladder (giant rat → goblin →
 * orc tier). Stats are first-pass; full bestiary tuning lands when
 * Cyberpunk gets dedicated combat-content attention.
 */
export const CYBER_BESTIARY: Enemy[] = [
  {
    id:              "cyber_street_thug",
    name:            "Street Thug",
    description:     "A gutter-grade tough in mismatched armor plates, swinging a length of rebar with corporate logos still flecked across it.",
    hp_range:        [8, 12],
    agi_mod:         1,
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
    hp_range:        [10, 14],
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
    hp_range:        [18, 24],
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
