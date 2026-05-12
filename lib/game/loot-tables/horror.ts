import { Genre, ItemRarity, ItemType } from "@/types/game";
import type { LootPool } from "./types";

/**
 * Day 21 — Horror / Lovecraftian static loot pool. Currency: Marks.
 * Items lean cult / occult / decay; rates are leaner than other genres
 * to make every find feel costly.
 */
export const LOOT_POOL: LootPool = {
  genre: Genre.HORROR_LOVECRAFTIAN,

  gold_drops: [
    { weight: 60, min:  2, max:  8 },
    { weight: 30, min:  6, max: 20 },
    { weight: 10, min: 18, max: 55 },
  ],

  consumables: [
    {
      weight: 60,
      item: {
        name:        "First-Aid Kit",
        type:        ItemType.CONSUMABLE,
        rarity:      ItemRarity.COMMON,
        description: "Bandages, antiseptic, a single morphine ampule.",
        quantity:    1,
        stackable:   true,
        effect:      { heal: 20 },
        value:       8,
      },
    },
    {
      weight: 25,
      item: {
        name:        "Sedative",
        type:        ItemType.CONSUMABLE,
        rarity:      ItemRarity.COMMON,
        description: "A vial of clear liquid that quiets the screaming behind your eyes.",
        quantity:    1,
        stackable:   true,
        effect:      {},
        value:       10,
      },
    },
    {
      weight: 15,
      item: {
        name:        "Sigil-Scribed Wafer",
        type:        ItemType.CONSUMABLE,
        rarity:      ItemRarity.UNCOMMON,
        description: "Bread stamped with a sign. Cultist food. It tastes of iron.",
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
        name:        "Tarnished Locket",
        type:        ItemType.VALUABLE,
        rarity:      ItemRarity.UNCOMMON,
        description: "A silver locket that won't quite open the same way twice.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       18,
      },
    },
    {
      weight: 30,
      item: {
        name:        "Beetle in Amber",
        type:        ItemType.VALUABLE,
        rarity:      ItemRarity.UNCOMMON,
        description: "A black beetle trapped mid-step in clouded amber.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       28,
      },
    },
    {
      weight: 20,
      item: {
        name:        "Cracked Cameo",
        type:        ItemType.VALUABLE,
        rarity:      ItemRarity.COMMON,
        description: "A bone cameo carved with a profile that looks back when ignored.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       10,
      },
    },
  ],

  lore_items: [
    {
      weight: 50,
      item: {
        name:        "Case Notes",
        type:        ItemType.LORE,
        rarity:      ItemRarity.COMMON,
        description: "Pages of investigation notes. The last entry trails off mid-sentence.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       2,
      },
    },
    {
      weight: 30,
      item: {
        name:        "Forbidden Fragment",
        type:        ItemType.LORE,
        rarity:      ItemRarity.UNCOMMON,
        description: "A torn page from a text that should not exist. Reading it costs something.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       12,
      },
    },
    {
      weight: 20,
      item: {
        name:        "Watercolor Sketch",
        type:        ItemType.LORE,
        rarity:      ItemRarity.COMMON,
        description: "A child's drawing of a tall figure with too many fingers.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       1,
      },
    },
  ],

  weapons: [
    {
      weight: 55,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Service Revolver",
        type:        ItemType.WEAPON,
        rarity:      ItemRarity.COMMON,
        description: "Six chambers. Heavy in the hand and steady when it matters.",
        quantity:    1,
        stackable:   false,
        effect:      { damage_die: "1d8" },
        stat_bonus:  { perception: 1 },
        value:       40,
      },
    },
    {
      weight: 35,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Ritual Dagger",
        type:        ItemType.WEAPON,
        rarity:      ItemRarity.COMMON,
        description: "A bone-handled dagger etched with sigils that ache to read.",
        quantity:    1,
        stackable:   false,
        effect:      { damage_die: "1d4" },
        stat_bonus:  { intelligence: 1 },
        value:       30,
      },
    },
    {
      weight: 10,
      rarity: ItemRarity.UNCOMMON,
      item: {
        name:        "Salt-Iron Shotgun",
        type:        ItemType.WEAPON,
        rarity:      ItemRarity.UNCOMMON,
        description: "Hand-loaded with salt-iron shot. Loud. Final.",
        quantity:    1,
        stackable:   false,
        effect:      { damage_die: "1d10" },
        stat_bonus:  { strength: 1 },
        value:       110,
      },
    },
  ],

  armor: [
    {
      weight: 60,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Leather Coat",
        type:        ItemType.ARMOR,
        rarity:      ItemRarity.COMMON,
        description: "Long coat of dark leather. Travels well. Hides much.",
        quantity:    1,
        stackable:   false,
        effect:      { armor_bonus: 1 },
        value:       18,
      },
    },
    {
      weight: 30,
      rarity: ItemRarity.UNCOMMON,
      item: {
        name:        "Warded Vest",
        type:        ItemType.ARMOR,
        rarity:      ItemRarity.UNCOMMON,
        description: "Heavy canvas stitched with sigils that itch against the skin.",
        quantity:    1,
        stackable:   false,
        effect:      { armor_bonus: 2 },
        value:       65,
      },
    },
    {
      weight: 10,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Patched Overcoat",
        type:        ItemType.ARMOR,
        rarity:      ItemRarity.COMMON,
        description: "Once-fine coat now stitched with mismatched patches.",
        quantity:    1,
        stackable:   false,
        effect:      { armor_bonus: 1 },
        value:       14,
      },
    },
  ],
};
