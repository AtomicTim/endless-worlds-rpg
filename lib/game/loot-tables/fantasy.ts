import { Genre, ItemRarity, ItemType } from "@/types/game";
import type { LootPool } from "./types";

/**
 * Day 21 — Fantasy static loot pool.
 *
 * Reference table — uses the spec example values verbatim:
 *   • gold tiers 60/30/10
 *   • health potion id matches starting-equipment's
 *     BASIC_HEALTH_POTION_ID so combat-resolver's use_item lookup
 *     resolves the heal die.
 *   • valuables are sellable items with no mechanical effect.
 *   • UNCOMMON weapons/armor sit alongside COMMON so the resolver's
 *     rarity gating (boss path) can roll into them.
 */
export const LOOT_POOL: LootPool = {
  genre: Genre.FANTASY,

  gold_drops: [
    { weight: 60, min:  3, max: 12 },
    { weight: 30, min: 10, max: 30 },
    { weight: 10, min: 25, max: 75 },
  ],

  consumables: [
    {
      weight: 60,
      item: {
        name:        "Health Potion",
        type:        ItemType.CONSUMABLE,
        rarity:      ItemRarity.COMMON,
        description: "A small vial of red liquid that restores some health.",
        quantity:    1,
        stackable:   true,
        effect:      { heal: 20 },
        value:       10,
      },
    },
    {
      weight: 25,
      item: {
        name:        "Antidote",
        type:        ItemType.CONSUMABLE,
        rarity:      ItemRarity.COMMON,
        description: "A bitter draught said to neutralize most poisons.",
        quantity:    1,
        stackable:   true,
        effect:      {},
        value:       12,
      },
    },
    {
      weight: 15,
      item: {
        name:        "Trail Rations",
        type:        ItemType.CONSUMABLE,
        rarity:      ItemRarity.COMMON,
        description: "Dried meat and hardtack wrapped in oilcloth.",
        quantity:    1,
        stackable:   true,
        effect:      {},
        value:       5,
      },
    },
  ],

  valuables: [
    {
      weight: 50,
      item: {
        name:        "Cut Gemstone",
        type:        ItemType.VALUABLE,
        rarity:      ItemRarity.UNCOMMON,
        description: "A small faceted gem catching every torch in the room.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       25,
      },
    },
    {
      weight: 30,
      item: {
        name:        "Silver Brooch",
        type:        ItemType.VALUABLE,
        rarity:      ItemRarity.UNCOMMON,
        description: "A tarnished silver brooch shaped like a falcon's wing.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       40,
      },
    },
    {
      weight: 20,
      item: {
        name:        "Copper Idol",
        type:        ItemType.VALUABLE,
        rarity:      ItemRarity.COMMON,
        description: "A weathered copper figurine of a forgotten god.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       15,
      },
    },
  ],

  lore_items: [
    {
      weight: 50,
      item: {
        name:        "Torn Journal Page",
        type:        ItemType.LORE,
        rarity:      ItemRarity.COMMON,
        description: "A water-stained page bearing rushed handwriting and ink smears.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       2,
      },
    },
    {
      weight: 30,
      item: {
        name:        "Runic Shard",
        type:        ItemType.LORE,
        rarity:      ItemRarity.UNCOMMON,
        description: "A fragment of stone etched with a single sharp rune.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       8,
      },
    },
    {
      weight: 20,
      item: {
        name:        "Faded Writ",
        type:        ItemType.LORE,
        rarity:      ItemRarity.COMMON,
        description: "A parchment writ with a broken wax seal you don't recognize.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       3,
      },
    },
  ],

  weapons: [
    {
      weight: 55,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Iron Sword",
        type:        ItemType.WEAPON,
        rarity:      ItemRarity.COMMON,
        description: "A worn but balanced iron sword.",
        quantity:    1,
        stackable:   false,
        effect:      { damage_die: "1d6" },
        stat_bonus:  { strength: 1 },
        value:       25,
      },
    },
    {
      weight: 35,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Hunting Knife",
        type:        ItemType.WEAPON,
        rarity:      ItemRarity.COMMON,
        description: "Single-edged blade, well kept. Quicker than a sword.",
        quantity:    1,
        stackable:   false,
        effect:      { damage_die: "1d4" },
        stat_bonus:  { agility: 2 },
        value:       18,
      },
    },
    {
      weight: 10,
      rarity: ItemRarity.UNCOMMON,
      item: {
        name:        "Steel Longsword",
        type:        ItemType.WEAPON,
        rarity:      ItemRarity.UNCOMMON,
        description: "Bright steel — folded, hammered, and never neglected.",
        quantity:    1,
        stackable:   false,
        effect:      { damage_die: "1d8" },
        stat_bonus:  { strength: 1 },
        value:       80,
      },
    },
  ],

  armor: [
    {
      weight: 60,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Leather Jerkin",
        type:        ItemType.ARMOR,
        rarity:      ItemRarity.COMMON,
        description: "Stiffened leather over a padded gambeson.",
        quantity:    1,
        stackable:   false,
        effect:      { armor_bonus: 1 },
        value:       15,
      },
    },
    {
      weight: 30,
      rarity: ItemRarity.UNCOMMON,
      item: {
        name:        "Chainmail Coif",
        type:        ItemType.ARMOR,
        rarity:      ItemRarity.UNCOMMON,
        description: "Linked iron rings beneath a quilted cap.",
        quantity:    1,
        stackable:   false,
        effect:      { armor_bonus: 2 },
        value:       60,
      },
    },
    {
      weight: 10,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Padded Vest",
        type:        ItemType.ARMOR,
        rarity:      ItemRarity.COMMON,
        description: "Layers of quilted linen — better than nothing.",
        quantity:    1,
        stackable:   false,
        effect:      { armor_bonus: 1 },
        value:       12,
      },
    },
  ],
};
