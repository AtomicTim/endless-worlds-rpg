import type { Enemy } from "@/types/game";

/**
 * Horror / Lovecraftian genre bestiary — Day 20 placeholder
 * (combat-spec §6.4), rebalanced V8.51 for the calibrated 2-10
 * player stat range. Same retune pattern as fantasy.ts: tier-1
 * −25% HP / agi unchanged (already at floor); mid-tier −15% HP.
 * 3 entries, full tuning later.
 */
export const HORROR_BESTIARY: Enemy[] = [
  {
    id:              "horror_shambling_thrall",
    name:            "Shambling Thrall",
    description:     "A husk that once was a person, eyes filmed white and mouth working around something unspeakable.",
    // V8.51 tier-1 — was hp [8,12]. Now hp [6,9]. Agi already at
    // slow-undead floor (-2); DC 8 is intentional — the easy-to-hit
    // attrition enemy that opens the bestiary.
    hp_range:        [6, 9],
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
    // V8.51 tier-2 — was hp [12,18]. Now hp [10,15]. DC 12.
    hp_range:        [10, 15],
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
    // V8.51 tier-3 — was hp [22,30]. Now hp [18,25].
    hp_range:        [18, 25],
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
