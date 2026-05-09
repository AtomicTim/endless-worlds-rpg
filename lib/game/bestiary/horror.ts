import type { Enemy } from "@/types/game";

/**
 * Horror / Lovecraftian genre bestiary — Day 20 placeholder
 * (combat-spec §6.4). 3 entries, full tuning later.
 */
export const HORROR_BESTIARY: Enemy[] = [
  {
    id:              "horror_shambling_thrall",
    name:            "Shambling Thrall",
    description:     "A husk that once was a person, eyes filmed white and mouth working around something unspeakable.",
    hp_range:        [8, 12],
    agi_mod:         -2,
    str_mod:         2,
    damage_die:      "1d6",
    armor_bonus:     0,
    xp_value:        30,
    loot_table_id:   "horror_shambling_thrall_loot",
    is_boss:         false,
    behavior_flavor: "shambling rotter",
  },
  {
    id:              "horror_void_whisperer",
    name:            "Void Whisperer",
    description:     "A thin figure draped in rotting linen, voice reaching you through the air like fingers under a door.",
    hp_range:        [12, 18],
    agi_mod:         1,
    str_mod:         0,
    damage_die:      "1d8",
    armor_bonus:     1,
    xp_value:        60,
    loot_table_id:   "horror_void_whisperer_loot",
    is_boss:         false,
    behavior_flavor: "incorporeal wraith",
  },
  {
    id:              "horror_flesh_construct",
    name:            "Flesh Construct",
    description:     "A patchwork mass of stitched limbs and faces, breathing wetly through too many mouths.",
    hp_range:        [22, 30],
    agi_mod:         -1,
    str_mod:         4,
    damage_die:      "1d10",
    armor_bonus:     2,
    xp_value:        100,
    loot_table_id:   "horror_flesh_construct_loot",
    is_boss:         false,
    behavior_flavor: "lumbering horror",
  },
];
