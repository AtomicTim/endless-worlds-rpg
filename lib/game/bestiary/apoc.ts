import type { Enemy } from "@/types/game";

/**
 * Post-Apocalyptic genre bestiary — Day 20 placeholder
 * (combat-spec §6.4), rebalanced V8.51 for the calibrated 2-10
 * player stat range. Same retune pattern as fantasy.ts: tier-1
 * −25% HP / agi −1; mid-tier −15% HP / agi unchanged. 3 entries,
 * full bestiary expansion lands when post-apoc gets dedicated
 * combat-content attention.
 */
export const APOC_BESTIARY: Enemy[] = [
  {
    id:              "apoc_feral_scavenger",
    name:            "Feral Scavenger",
    description:     "A wiry survivor in patched layers, knife in one hand and a length of pipe in the other, eyes dart-quick.",
    // V8.51 tier-1 — was hp [8,12], agi 2. Now hp [6,9], agi 1
    // → DC 12. Tier-1 normal encounter.
    hp_range:        [6, 9],
    agi_mod:         1,
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
    // V8.51 tier-2 — was hp [14,20]. Now hp [11,16]. Slow-undead
    // archetype; easy to hit but durable.
    hp_range:        [11, 16],
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
    // V8.51 tier-3 — was hp [22,30]. Now hp [18,25].
    hp_range:        [18, 25],
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
