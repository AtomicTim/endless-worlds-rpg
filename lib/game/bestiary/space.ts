import type { Enemy } from "@/types/game";

/**
 * Space Opera genre bestiary — Day 20 placeholder
 * (combat-spec §6.4), rebalanced V8.51 for the calibrated 2-10
 * player stat range. Same retune pattern as fantasy.ts: tier-1
 * −25% HP / agi −1; mid-tier −15% HP / agi unchanged. 3 entries,
 * full tuning later.
 */
export const SPACE_BESTIARY: Enemy[] = [
  {
    id:              "space_hostile_drone",
    name:            "Hostile Drone",
    description:     "A scuffed spider-frame service drone with its safety overrides clearly bypassed, sensor cluster locked on you.",
    // V8.51 tier-1 — was hp [6,10], agi 2. Now hp [4,7], agi 1
    // → DC 12. The "first encounter" entry — fast but fragile.
    hp_range:        [4, 7],
    agi_mod:         1,
    str_mod:         0,
    damage_die:      "1d4",
    armor_bonus:     1,
    xp_value:        25,
    loot_table_id:   "space_hostile_drone_loot",
    is_boss:         false,
    behavior_flavor: "skittering machine",
  },
  {
    id:              "space_rogue_synthetic",
    name:            "Rogue Synthetic",
    description:     "A humanoid synth in faded uniform, faceplate cracked, servos whining as it raises an industrial cutter.",
    // V8.51 tier-2 — was hp [14,20]. Now hp [11,17]. DC 13.
    hp_range:        [11, 17],
    agi_mod:         1,
    str_mod:         2,
    damage_die:      "1d8",
    armor_bonus:     2,
    xp_value:        70,
    loot_table_id:   "space_rogue_synthetic_loot",
    is_boss:         false,
    behavior_flavor: "implacable melee",
  },
  {
    id:              "space_void_predator",
    name:            "Void Predator",
    description:     "A boneless many-limbed hunter that came aboard with the last salvage, hide flickering between black and oilslick.",
    // V8.51 tier-3 — was hp [22,30]. Now hp [18,25]. DC 14.
    hp_range:        [18, 25],
    agi_mod:         3,
    str_mod:         3,
    damage_die:      "1d10",
    armor_bonus:     1,
    xp_value:        120,
    loot_table_id:   "space_void_predator_loot",
    is_boss:         false,
    behavior_flavor: "ambush hunter",
  },
];
