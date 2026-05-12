import { Genre, ItemRarity, ItemType } from "@/types/game";
import type { LootPool } from "./types";

/**
 * Day 21 — Cyberpunk static loot pool. Genre currency: Credits.
 */
export const LOOT_POOL: LootPool = {
  genre: Genre.CYBERPUNK,

  gold_drops: [
    { weight: 60, min:  20, max:  80 },
    { weight: 30, min:  60, max: 200 },
    { weight: 10, min: 150, max: 500 },
  ],

  consumables: [
    {
      weight: 60,
      item: {
        name:        "Stim Patch",
        type:        ItemType.CONSUMABLE,
        rarity:      ItemRarity.COMMON,
        description: "Adhesive nanotech patch — dumps healing compounds into the bloodstream.",
        quantity:    1,
        stackable:   true,
        effect:      { heal: 20 },
        value:       50,
        genre_skin:  "Credits",
      },
    },
    {
      weight: 25,
      item: {
        name:        "Neural Booster",
        type:        ItemType.CONSUMABLE,
        rarity:      ItemRarity.COMMON,
        description: "A combat-grade injector. Sharpens reflexes for short bursts.",
        quantity:    1,
        stackable:   true,
        effect:      {},
        value:       65,
      },
    },
    {
      weight: 15,
      item: {
        name:        "Synth-Protein Bar",
        type:        ItemType.CONSUMABLE,
        rarity:      ItemRarity.COMMON,
        description: "Flavorless gray bar. Calories without questions.",
        quantity:    1,
        stackable:   true,
        effect:      {},
        value:       8,
      },
    },
  ],

  valuables: [
    {
      weight: 50,
      item: {
        name:        "Encrypted Datachip",
        type:        ItemType.VALUABLE,
        rarity:      ItemRarity.UNCOMMON,
        description: "A scuffed chip humming with someone else's secrets. Buyers exist.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       120,
      },
    },
    {
      weight: 30,
      item: {
        name:        "Black-Market ID",
        type:        ItemType.VALUABLE,
        rarity:      ItemRarity.UNCOMMON,
        description: "A counterfeit corporate ID. Worth something to the right fence.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       180,
      },
    },
    {
      weight: 20,
      item: {
        name:        "Ripped Wetware",
        type:        ItemType.VALUABLE,
        rarity:      ItemRarity.COMMON,
        description: "Pulled implant, still warm. Salvageable for parts.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       75,
      },
    },
  ],

  lore_items: [
    {
      weight: 50,
      item: {
        name:        "Smudged Dossier",
        type:        ItemType.LORE,
        rarity:      ItemRarity.COMMON,
        description: "Pages of corpo surveillance redacted past usefulness — almost.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       15,
      },
    },
    {
      weight: 30,
      item: {
        name:        "Pirated Comm Log",
        type:        ItemType.LORE,
        rarity:      ItemRarity.UNCOMMON,
        description: "Encrypted comm chatter, half of it static, half of it damning.",
        quantity:    1,
        stackable:   false,
        effect:      {},
        value:       25,
      },
    },
    {
      weight: 20,
      item: {
        name:        "Faded Polaroid",
        type:        ItemType.LORE,
        rarity:      ItemRarity.COMMON,
        description: "Color-shifted photo of a face you almost recognize.",
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
        name:        "Compact Pistol",
        type:        ItemType.WEAPON,
        rarity:      ItemRarity.COMMON,
        description: "Cheap and reliable. Six rounds, no questions.",
        quantity:    1,
        stackable:   false,
        effect:      { damage_die: "1d6" },
        stat_bonus:  { agility: 1 },
        value:       80,
      },
    },
    {
      weight: 35,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Mono-Blade",
        type:        ItemType.WEAPON,
        rarity:      ItemRarity.COMMON,
        description: "Edge so thin it sings. Cuts steel in the right hands.",
        quantity:    1,
        stackable:   false,
        effect:      { damage_die: "1d4" },
        stat_bonus:  { agility: 2 },
        value:       60,
      },
    },
    {
      weight: 10,
      rarity: ItemRarity.UNCOMMON,
      item: {
        name:        "Smartrifle",
        type:        ItemType.WEAPON,
        rarity:      ItemRarity.UNCOMMON,
        description: "Targeting-linked rifle. The bullet knows where it's going.",
        quantity:    1,
        stackable:   false,
        effect:      { damage_die: "1d8" },
        stat_bonus:  { perception: 1 },
        value:       240,
      },
    },
  ],

  armor: [
    {
      weight: 60,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Reinforced Jacket",
        type:        ItemType.ARMOR,
        rarity:      ItemRarity.COMMON,
        description: "Carbon-fiber weave under leather. Stops most low-velocity rounds.",
        quantity:    1,
        stackable:   false,
        effect:      { armor_bonus: 1 },
        value:       70,
      },
    },
    {
      weight: 30,
      rarity: ItemRarity.UNCOMMON,
      item: {
        name:        "Subdermal Plating",
        type:        ItemType.ARMOR,
        rarity:      ItemRarity.UNCOMMON,
        description: "Implant-grade composite plates. Heavy under the skin.",
        quantity:    1,
        stackable:   false,
        effect:      { armor_bonus: 2 },
        value:       200,
      },
    },
    {
      weight: 10,
      rarity: ItemRarity.COMMON,
      item: {
        name:        "Ballistic Vest",
        type:        ItemType.ARMOR,
        rarity:      ItemRarity.COMMON,
        description: "Standard-issue plate carrier. Looks the part.",
        quantity:    1,
        stackable:   false,
        effect:      { armor_bonus: 1 },
        value:       55,
      },
    },
  ],
};
