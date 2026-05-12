import type { Enemy } from "@/types/game";

/**
 * Fantasy genre bestiary — Day 20 Combat (combat-spec §6.4),
 * rebalanced V8.51 against the calibrated 2-10 player stat range.
 *
 * 14 enemies authored in code. Originally tuned for a D&D-scale player
 * (stats 1-20, modifiers ranging ±5); after Day 22 fixed starting stats
 * to base 2 / primary 4 / secondary 3, level-1 fights were unwinnable
 * (~25% hit rate, 5+ rounds per kill). V8.51 retuned HP downward by
 * ~25% across tier-1 and ~15% above; agi_mod cut by 1 on most tier-1
 * entries; goal: level-1 Knight lands ~50% of attacks and kills a
 * tier-1 enemy in 2-3 hits. See project-log.md for the encounter math.
 *
 * Ladder progression (post-rebalance):
 *   Tier 1 (xp 10-40):   giant_rat → goblin → wolf → skeleton
 *   Tier 2 (xp 50-75):   bandit → cultist → orc → zombie → brigand_archer
 *   Tier 3 (xp 90-200):  dire_boar → ogre → troll → specter
 *   Apex  (xp 350):      dragon_whelp
 *
 * `is_boss` is false on all 14 — bosses come from the WorldBible
 * main quest and from dungeon mid-boss tagging. `loot_table_id`
 * uses the stub pattern `fantasy_<id>_loot`; Day 21's loot resolver
 * wires real tables to these ids.
 */
export const FANTASY_BESTIARY: Enemy[] = [
  {
    id:              "fantasy_giant_rat",
    name:            "Giant Rat",
    description:     "A bristle-furred rodent the size of a small dog, eyes glittering with feverish hunger.",
    // V8.51 — was hp_range [4,6], agi_mod 2. DC 12 + tankier than
    // tier-1 should be. Now hp [3,5], agi 1 → DC 11, 50% hit rate
    // for a level-1 Knight (+0 agi mod, d20 ≥ 11 lands).
    hp_range:        [3, 5],
    agi_mod:         1,
    str_mod:         -1,
    damage_die:      "1d4",
    armor_bonus:     0,
    xp_value:        10,
    loot_table_id:   "fantasy_giant_rat_loot",
    is_boss:         false,
    behavior_flavor: "scurrying biter",
  },
  {
    id:              "fantasy_goblin",
    name:            "Goblin",
    description:     "A wiry green-skinned scrapper clutching a notched blade, grinning yellowed teeth.",
    // V8.51 — was hp [6,10], agi 1. Now hp [5,8], agi 0 + armor 1
    // → DC 11. Pair with goblin's 1d6 damage = the canonical tier-1
    // "fair fight" — level-1 Knight wins in 2-3 rounds.
    hp_range:        [5, 8],
    agi_mod:         0,
    str_mod:         0,
    damage_die:      "1d6",
    armor_bonus:     1,
    xp_value:        25,
    loot_table_id:   "fantasy_goblin_loot",
    is_boss:         false,
    behavior_flavor: "aggressive melee",
  },
  {
    id:              "fantasy_wolf",
    name:            "Wolf",
    description:     "A lean grey predator slinking low, breath fogging in the chill.",
    // V8.51 — was hp [8,12], agi 3. Now hp [7,11], agi 2 → DC 12.
    // Tier-1 HARD enemy: faster than goblin, hits harder than rat,
    // genuine threat to a level-1 player still kitted in starter gear.
    hp_range:        [7, 11],
    agi_mod:         2,
    str_mod:         1,
    damage_die:      "1d6",
    armor_bonus:     0,
    xp_value:        30,
    loot_table_id:   "fantasy_wolf_loot",
    is_boss:         false,
    behavior_flavor: "pack hunter",
  },
  {
    id:              "fantasy_skeleton",
    name:            "Skeleton",
    description:     "A lattice of yellowed bone bound by dark intent, rusted blade still in its grip.",
    // V8.51 — was hp [10,14], agi 0. Now hp [7,10], agi -1 + armor 1
    // → DC 10. Slow undead — easiest tier-1 to hit, moderately durable.
    hp_range:        [7, 10],
    agi_mod:         -1,
    str_mod:         1,
    damage_die:      "1d6",
    armor_bonus:     1,
    xp_value:        40,
    loot_table_id:   "fantasy_skeleton_loot",
    is_boss:         false,
    behavior_flavor: "relentless undead",
  },
  {
    id:              "fantasy_bandit",
    name:            "Bandit",
    description:     "A road-worn brigand in patched leathers, blade already drawn at the sight of you.",
    // V8.51 tier-2 — was hp [10,16]. Now hp [9,13]. DC 12 (10+1+1).
    // Solid challenge for a low-level player; 1d8 damage hurts.
    hp_range:        [9, 13],
    agi_mod:         1,
    str_mod:         1,
    damage_die:      "1d8",
    armor_bonus:     1,
    xp_value:        50,
    loot_table_id:   "fantasy_bandit_loot",
    is_boss:         false,
    behavior_flavor: "desperate brigand",
  },
  {
    id:              "fantasy_cultist",
    name:            "Cultist",
    description:     "A robed figure with stained sigils on the cowl, mouthing a chant that scrapes the air.",
    // V8.51 tier-2 — was hp [10,14], agi 1. Now hp [7,11], agi 0
    // → DC 10. Frail caster archetype; hits back but easy to hit.
    hp_range:        [7, 11],
    agi_mod:         0,
    str_mod:         0,
    damage_die:      "1d6",
    armor_bonus:     0,
    xp_value:        50,
    loot_table_id:   "fantasy_cultist_loot",
    is_boss:         false,
    behavior_flavor: "fanatical chanter",
  },
  {
    id:              "fantasy_orc",
    name:            "Orc",
    description:     "A slab-shouldered warrior with tusked jaw and an axe scarred by old fights.",
    // V8.51 tier-2 — was hp [16,22], agi 0. Now hp [13,18], agi -1
    // → DC 11. Slow but hits very hard (1d10 + 3 str). Genuine threat.
    hp_range:        [13, 18],
    agi_mod:         -1,
    str_mod:         3,
    damage_die:      "1d10",
    armor_bonus:     2,
    xp_value:        75,
    loot_table_id:   "fantasy_orc_loot",
    is_boss:         false,
    behavior_flavor: "brutal melee",
  },
  {
    id:              "fantasy_zombie",
    name:            "Zombie",
    description:     "A bloat-skinned corpse dragging itself forward on stiffened limbs, mouth working soundlessly.",
    // V8.51 tier-2 — was hp [14,20]. Now hp [11,16]. DC 8 (10-2+0).
    // Very easy to hit but durable. Attrition enemy.
    hp_range:        [11, 16],
    agi_mod:         -2,
    str_mod:         2,
    damage_die:      "1d8",
    armor_bonus:     0,
    xp_value:        65,
    loot_table_id:   "fantasy_zombie_loot",
    is_boss:         false,
    behavior_flavor: "shambling rotter",
  },
  {
    id:              "fantasy_brigand_archer",
    name:            "Brigand Archer",
    description:     "A leather-clad bowman crouched in cover, arrow already nocked and aimed at your throat.",
    // V8.51 tier-2 — was hp [10,14]. Now hp [7,11]. DC 13 (10+2+1).
    // Hard to hit, priority target — the ranged enemy that punishes
    // ignoring threat ordering.
    hp_range:        [7, 11],
    agi_mod:         2,
    str_mod:         1,
    damage_die:      "1d8",
    armor_bonus:     1,
    xp_value:        60,
    loot_table_id:   "fantasy_brigand_archer_loot",
    is_boss:         false,
    behavior_flavor: "ranged ambusher",
  },
  {
    id:              "fantasy_dire_boar",
    name:            "Dire Boar",
    description:     "A boar the size of a warhorse, tusks scarred by past kills and small black eyes fixed on yours.",
    // V8.51 tier-3 — was hp [20,28]. Now hp [17,23]. Other stats
    // unchanged (DC 13, 2d4 damage + str 3 = hits like a freight train).
    hp_range:        [17, 23],
    agi_mod:         1,
    str_mod:         3,
    damage_die:      "2d4",
    armor_bonus:     2,
    xp_value:        90,
    loot_table_id:   "fantasy_dire_boar_loot",
    is_boss:         false,
    behavior_flavor: "charging beast",
  },
  {
    id:              "fantasy_ogre",
    name:            "Ogre",
    description:     "A hulking brute swinging a tree-limb cudgel, every step shaking dust from the rafters.",
    // V8.51 tier-3 — was hp [30,40]. Now hp [25,33]. Other stats
    // unchanged (DC 11, 2d6 + 4 = 6-16 damage swings).
    hp_range:        [25, 33],
    agi_mod:         -1,
    str_mod:         4,
    damage_die:      "2d6",
    armor_bonus:     2,
    xp_value:        150,
    loot_table_id:   "fantasy_ogre_loot",
    is_boss:         false,
    behavior_flavor: "massive bruiser",
  },
  {
    id:              "fantasy_troll",
    name:            "Troll",
    description:     "A tall sinewy horror with stretched grey hide, wounds knitting closed before your eyes.",
    // V8.51 tier-3 — was hp [40,55]. Now hp [33,44]. Still the most
    // durable non-apex enemy. DC 13.
    hp_range:        [33, 44],
    agi_mod:         0,
    str_mod:         4,
    damage_die:      "2d6",
    armor_bonus:     3,
    xp_value:        200,
    loot_table_id:   "fantasy_troll_loot",
    is_boss:         false,
    behavior_flavor: "regenerating monster",
  },
  {
    id:              "fantasy_specter",
    name:            "Specter",
    description:     "A drifting shape of cold-blue mist with the suggestion of a face, hollow where eyes should be.",
    // V8.51 tier-3 — was hp [18,25]. Now hp [14,20]. DC 13 — high
    // dodge, fragile when hit.
    hp_range:        [14, 20],
    agi_mod:         3,
    str_mod:         1,
    damage_die:      "1d8",
    armor_bonus:     0,
    xp_value:        120,
    loot_table_id:   "fantasy_specter_loot",
    is_boss:         false,
    behavior_flavor: "incorporeal wraith",
  },
  {
    id:              "fantasy_dragon_whelp",
    name:            "Dragon Whelp",
    description:     "A young dragon the size of a destrier, scales smoking faintly, eyes the color of a forge.",
    // V8.51 apex — was hp [50,70]. Now hp [40,55]. Still the most
    // dangerous fight in the bestiary; DC 16, 2d8 + 3 damage.
    hp_range:        [40, 55],
    agi_mod:         2,
    str_mod:         3,
    damage_die:      "2d8",
    armor_bonus:     4,
    xp_value:        350,
    loot_table_id:   "fantasy_dragon_whelp_loot",
    is_boss:         false,
    behavior_flavor: "apex predator",
  },
];
