import type { Enemy } from "@/types/game";

/**
 * Post-Apocalyptic genre bestiary — Day 20 placeholder
 * (combat-spec §6.4). 3 entries, full tuning later.
 */
export const APOC_BESTIARY: Enemy[] = [
  {
    id:              "apoc_feral_scavenger",
    name:            "Feral Scavenger",
    description:     "A wiry survivor in patched layers, knife in one hand and a length of pipe in the other, eyes dart-quick.",
    hp_range:        [8, 12],
    agi_mod:         2,
    str_mod:         0,
    damage_die:      "1d6",
    armor_bonus:     1,
    xp_value:        30,
    loot_table_id:   "apoc_feral_scavenger_loot",
    is_boss:         false,
    behavior_flavor: "desperate brigand",
  },
  {
    id:              "apoc_rad_zombie",
    name:            "Rad-Zombie",
    description:     "A blistered figure of weeping flesh, geiger-tick faintly audible, mouth working soundlessly.",
    hp_range:        [14, 20],
    agi_mod:         -2,
    str_mod:         2,
    damage_die:      "1d8",
    armor_bonus:     0,
    xp_value:        65,
    loot_table_id:   "apoc_rad_zombie_loot",
    is_boss:         false,
    behavior_flavor: "shambling rotter",
  },
  {
    id:              "apoc_raider_chief",
    name:            "Raider Chief",
    description:     "A scarred warlord in scrap-plate, sawn-off shotgun cradled like a favorite hound.",
    hp_range:        [22, 30],
    agi_mod:         1,
    str_mod:         3,
    damage_die:      "2d4",
    armor_bonus:     3,
    xp_value:        130,
    loot_table_id:   "apoc_raider_chief_loot",
    is_boss:         false,
    behavior_flavor: "brutal melee",
  },
];
