import { Genre, ItemRarity, ItemType } from "@/types/game";
import type { LootPool } from "./types";

/**
 * Day 21 — Space Opera static loot pool. Currency: Stellar Units.
 */
export const LOOT_POOL: LootPool = {
  genre: Genre.SPACE_OPERA,

  gold_drops: [
    { weight: 60, min:  10, max:  35 },
    { weight: 30, min:  30, max: 100 },
    { weight: 10, min:  80, max: 300 },
  ],

  consumables: [
    {
      weight: 60,
      item: {
        name:        "Medkit",
        type:        ItemType.CONSUMABLE,
        rarity:      ItemRarity.COMMON,
        description: "Standard fleet medkit. Auto-injector and quick-seal patches.",
        quantity:    1,
        stackable:   true,
        effect:      { heal: 20 },
        value:       30,
      },
    },
    {
      weight: 25,
      item: {
        name:        "Adrenal Booster",
        type:        ItemType.CONSUMABLE,
        rarity:      ItemRarity.COMMON,
        description: "Combat adrenaline shot. Reflexes spike, then crash.",
        quantity:    1,
        stackable:   true,
        effect:      {},
        value:       40,
      },
    },
    {
      weight: 15,
      item: {
        name:        "Ration Pack",
        type:        ItemType.CONSUMABLE,
        rarity:      ItemRarity.COMMON,
        description: "Vacuum-sealed protein and electrolytes. Standard issue.",
        quantity:    1,
        stackable:   true,
        effect:      {},
        value:       6,
      },
    },
  ],

  valuables: [
    {
      weight: 50,
      item: {
        name:        "Refined Tritanium",
        type:        ItemType.VALUABLE,
        rarity:      ItemRarity.UNCOMMON,
        description: "A bar of refined alloy. Heavier than it looks, denser than it has any right to be.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       80,
      },
    },
    {
      weight: 30,
      item: {
        name:        "Alien Artifact",
        type:        ItemType.VALUABLE,
        rarity:      ItemRarity.UNCOMMON,
        description: "A geometric carving in a metal that resists scanning. Collectors pay.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       140,
      },
    },
    {
      weight: 20,
      item: {
        name:        "Salvage Plate",
        type:        ItemType.VALUABLE,
        rarity:      ItemRarity.COMMON,
        description: "Hull plating cut clean from a derelict. Scrappable on any station.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       30,
      },
    },
  ],

  lore_items: [
    {
      weight: 50,
      item: {
        name:        "Nav Charts",
        type:        ItemType.LORE,
        rarity:      ItemRarity.COMMON,
        description: "Star charts of the outer sectors. Several routes are marked unsafe.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       10,
      },
    },
    {
      weight: 30,
      item: {
        name:        "Captain's Log Fragment",
        type:        ItemType.LORE,
        rarity:      ItemRarity.UNCOMMON,
        description: "A partial recording. Static, then a name, then static again.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       18,
      },
    },
    {
      weight: 20,
      item: {
        name:        "Mission Brief",
        type:        ItemType.LORE,
        rarity:      ItemRarity.COMMON,
        description: "Operations brief stamped with a faction seal you can't quite place.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       5,
      },
    },
  ],

  weapons: [
    {
      weight: 55,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Service Sidearm",
        type:        ItemType.WEAPON,
        rarity:      ItemRarity.COMMON,
        description: "Standard-issue plasma sidearm. Reliable. Loud.",
        quantity:    1,
        stackable:   false,
        effect:      { damage_die: "1d6" },
        stat_bonus:  { agility: 1 },
        value:       45,
      },
    },
    {
      weight: 35,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Energy Blade",
        type:        ItemType.WEAPON,
        rarity:      ItemRarity.COMMON,
        description: "Short blade with a coherent-light edge. Hums at idle.",
        quantity:    1,
        stackable:   false,
        effect:      { damage_die: "1d4" },
        stat_bonus:  { agility: 2 },
        value:       35,
      },
    },
    {
      weight: 10,
      rarity: ItemRarity.UNCOMMON,
      item: {
        name:        "Pulse Rifle",
        type:        ItemType.WEAPON,
        rarity:      ItemRarity.UNCOMMON,
        description: "Fleet-grade pulse rifle. Tight grouping, low recoil, clean discharge.",
        quantity:    1,
        stackable:   false,
        effect:      { damage_die: "1d10" },
        stat_bonus:  { perception: 1 },
        value:       180,
      },
    },
  ],

  armor: [
    {
      weight: 60,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Flight Suit",
        type:        ItemType.ARMOR,
        rarity:      ItemRarity.COMMON,
        description: "Pressure-rated suit. Reinforced at joints and sternum.",
        quantity:    1,
        stackable:   false,
        effect:      { armor_bonus: 1 },
        value:       50,
      },
    },
    {
      weight: 30,
      rarity: ItemRarity.UNCOMMON,
      item: {
        name:        "Combat Hardsuit",
        type:        ItemType.ARMOR,
        rarity:      ItemRarity.UNCOMMON,
        description: "Articulated combat plate over reactive mesh. Standard fleet issue.",
        quantity:    1,
        stackable:   false,
        effect:      { armor_bonus: 2 },
        value:       175,
      },
    },
    {
      weight: 10,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Worker's Coveralls",
        type:        ItemType.ARMOR,
        rarity:      ItemRarity.COMMON,
        description: "Reinforced engineering coveralls. Built for sparks, not bullets.",
        quantity:    1,
        stackable:   false,
        effect:      { armor_bonus: 1 },
        value:       30,
      },
    },
  ],
};
