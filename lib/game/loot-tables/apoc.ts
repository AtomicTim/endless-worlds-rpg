import { Genre, ItemRarity, ItemType } from "@/types/game";
import type { LootPool } from "./types";

/**
 * Day 21 — Post-Apocalyptic static loot pool. Currency: Caps.
 */
export const LOOT_POOL: LootPool = {
  genre: Genre.POST_APOCALYPTIC,

  // V8.52 — universal gold tier ranges (see fantasy.ts gold_drops
  // comment for rationale). Caps replace gold as the label; numeric
  // scale is identical so loot payouts feel consistent across genres.
  gold_drops: [
    { weight: 60, min:  3, max: 18 },
    { weight: 30, min: 12, max: 35 },
    { weight: 10, min: 30, max: 80 },
  ],

  consumables: [
    {
      weight: 60,
      item: {
        name:        "Medkit",
        type:        ItemType.CONSUMABLE,
        rarity:      ItemRarity.COMMON,
        description: "Crumpled tin box of bandages, antibiotics, and a syringe of who-knows-what.",
        quantity:    1,
        stackable:   true,
        effect:      { heal: 20 },
        value:       12,
      },
    },
    {
      weight: 25,
      item: {
        name:        "Stim Shot",
        type:        ItemType.CONSUMABLE,
        rarity:      ItemRarity.COMMON,
        description: "Yellowing syringe of pre-war adrenal stim. Probably still works.",
        quantity:    1,
        stackable:   true,
        effect:      {},
        value:       14,
      },
    },
    {
      weight: 15,
      item: {
        name:        "Boiled Water",
        type:        ItemType.CONSUMABLE,
        rarity:      ItemRarity.COMMON,
        description: "A dented canteen. Boiled clean — clean enough.",
        quantity:    1,
        stackable:   true,
        // V8.52 — food/sustenance consumables now restore HP. See
        // fantasy.ts Trail Rations comment. (Future: post-apoc could
        // wire a separate hydration mechanic on top of this; deferred.)
        effect:      { heal: 5 },
        value:       4,
      },
    },
  ],

  valuables: [
    {
      weight: 50,
      item: {
        name:        "Pre-War Coin",
        type:        ItemType.VALUABLE,
        rarity:      ItemRarity.UNCOMMON,
        description: "A coin from before. Old dates collectors will pay for.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       30,
      },
    },
    {
      weight: 30,
      item: {
        name:        "Working Lighter",
        type:        ItemType.VALUABLE,
        rarity:      ItemRarity.UNCOMMON,
        description: "Brass casing, full fuel. Strike-on-first-try lighters are valuable now.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       45,
      },
    },
    {
      weight: 20,
      item: {
        name:        "Scrap Bundle",
        type:        ItemType.VALUABLE,
        rarity:      ItemRarity.COMMON,
        description: "Bundle of clean copper wire and steel screws. Useful. Tradable.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       18,
      },
    },
  ],

  lore_items: [
    {
      weight: 50,
      item: {
        name:        "Pre-War Magazine",
        type:        ItemType.LORE,
        rarity:      ItemRarity.COMMON,
        description: "Glossy print bent and faded. Pictures of a world that's gone.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       3,
      },
    },
    {
      weight: 30,
      item: {
        name:        "Holotape",
        type:        ItemType.LORE,
        rarity:      ItemRarity.UNCOMMON,
        description: "A scuffed tape. Cracked label. Plays on the right gear.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       15,
      },
    },
    {
      weight: 20,
      item: {
        name:        "Faded Photograph",
        type:        ItemType.LORE,
        rarity:      ItemRarity.COMMON,
        description: "Color washed to brown. A family on a lawn. Their lawn, once.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       2,
      },
    },
  ],

  weapons: [
    {
      weight: 55,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Pipe Pistol",
        type:        ItemType.WEAPON,
        rarity:      ItemRarity.COMMON,
        description: "Welded scrap pistol. Single shot. Loud as hell.",
        quantity:    1,
        stackable:   false,
        effect:      { damage_die: "1d6" },
        stat_bonus:  { strength: 1 },
        value:       28,
      },
    },
    {
      weight: 35,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Tire Iron",
        type:        ItemType.WEAPON,
        rarity:      ItemRarity.COMMON,
        description: "Heavy. Bent. Reliable.",
        quantity:    1,
        stackable:   false,
        effect:      { damage_die: "1d4" },
        stat_bonus:  { strength: 1 },
        value:       12,
      },
    },
    {
      weight: 10,
      rarity: ItemRarity.UNCOMMON,
      item: {
        name:        "Pre-War Rifle",
        type:        ItemType.WEAPON,
        rarity:      ItemRarity.UNCOMMON,
        description: "Wood and steel from before. Oiled. Cleaned. Trusted.",
        quantity:    1,
        stackable:   false,
        effect:      { damage_die: "1d10" },
        stat_bonus:  { perception: 1 },
        value:       130,
      },
    },
  ],

  armor: [
    {
      weight: 60,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Scrap Armor",
        type:        ItemType.ARMOR,
        rarity:      ItemRarity.COMMON,
        description: "Plates and pads strapped over canvas. Heavy but it stops things.",
        quantity:    1,
        stackable:   false,
        effect:      { armor_bonus: 1 },
        value:       22,
      },
    },
    {
      weight: 30,
      rarity: ItemRarity.UNCOMMON,
      item: {
        name:        "Riot Vest",
        type:        ItemType.ARMOR,
        rarity:      ItemRarity.UNCOMMON,
        description: "Pre-war riot plating, only slightly cracked. Heavier than it looks.",
        quantity:    1,
        stackable:   false,
        effect:      { armor_bonus: 2 },
        value:       95,
      },
    },
    {
      weight: 10,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Patched Duster",
        type:        ItemType.ARMOR,
        rarity:      ItemRarity.COMMON,
        description: "Long canvas duster, quilted lining. Cuts the wind. Cuts a knife.",
        quantity:    1,
        stackable:   false,
        effect:      { armor_bonus: 1 },
        value:       20,
      },
    },
  ],
};
