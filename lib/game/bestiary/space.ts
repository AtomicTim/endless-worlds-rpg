import type { Enemy } from "@/types/game";

/**
 * Space Opera genre bestiary — Day 20 placeholder
 * (combat-spec §6.4). 3 entries, full tuning later.
 */
export const SPACE_BESTIARY: Enemy[] = [
  {
    id:              "space_hostile_drone",
    name:            "Hostile Drone",
    description:     "A scuffed spider-frame service drone with its safety overrides clearly bypassed, sensor cluster locked on you.",
    hp_range:        [6, 10],
    agi_mod:         2,
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
    hp_range:        [14, 20],
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
    hp_range:        [22, 30],
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
