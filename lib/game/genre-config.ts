import { Genre, ItemRarity, ItemType } from "@/types/game";
import type { Item } from "@/types/game";

export interface GenreConfig {
  id:   Genre;
  name: string;
  tone: string;
  colorPalette: {
    primary: string;
    accent:  string;
    bg:      string;
    text:    string;
  };
  vocabulary: {
    hp:           string;
    currency:     string | null;
    currencyName: string | null;
    sanity?:      string;
  };
  narratorPersonality: string;
  startingLocation:    string;
  soundIds: {
    ambient:   string;
    combat:    string;
    discovery: string;
  };
  itemTemplates: Item[];
}

function tpl(
  id: string,
  name: string,
  type: ItemType,
  rarity: ItemRarity,
  description: string,
  overrides: Partial<Item> = {}
): Item {
  return {
    id,
    name,
    type,
    rarity,
    description,
    quantity:  1,
    stackable: type === ItemType.CONSUMABLE,
    max_stack: type === ItemType.CONSUMABLE ? 99 : undefined,
    ...overrides,
  };
}

export const GENRE_CONFIGS: Record<Genre, GenreConfig> = {
  [Genre.FANTASY]: {
    id:   Genre.FANTASY,
    name: "Fantasy",
    tone: "heroic",
    colorPalette: {
      // UI-fix-A — Fantasy primary aligned with the locked accent
      // #c4943a (design ref §2). Was #f59e0b.
      primary: "#c4943a",
      accent:  "#22c55e",
      bg:      "#0a0a0a",
      text:    "#e5e7eb",
    },
    vocabulary: {
      hp:           "HP",
      currency:     "gold",
      currencyName: "Gold",
    },
    narratorPersonality: "Epic fantasy narrator — grand language, mythic stakes, heroic tone.",
    startingLocation:    "fantasy_start_01",
    soundIds: {
      ambient:   "fantasy_forest_ambient",
      combat:    "fantasy_sword_clash",
      discovery: "fantasy_treasure_found",
    },
    itemTemplates: [
      tpl("tpl_fantasy_iron_sword",    "Iron Sword",     ItemType.WEAPON,     ItemRarity.COMMON,   "A sturdy blade of forged iron.",        { weight: 3, stat_bonus: { strength: 1 } }),
      tpl("tpl_fantasy_leather_armor", "Leather Armor",  ItemType.ARMOR,      ItemRarity.COMMON,   "Cured hide stitched into serviceable armor.", { weight: 5 }),
      tpl("tpl_fantasy_health_potion", "Health Potion",  ItemType.CONSUMABLE, ItemRarity.COMMON,   "A ruby vial of restorative elixir.",    { effect: { heal: 20 } }),
      tpl("tpl_fantasy_torch",         "Torch",          ItemType.CONSUMABLE, ItemRarity.COMMON,   "Reveals hidden passages in darkness.",  { effect: { reveal: 1 } }),
      tpl("tpl_fantasy_ancient_key",   "Ancient Key",    ItemType.KEY,        ItemRarity.UNCOMMON, "Ornate brass, worn smooth by ages.",    { stackable: false }),
      tpl("tpl_fantasy_spell_scroll",  "Spell Scroll",   ItemType.LORE,       ItemRarity.RARE,     "Inscribed with a powerful incantation.", { stackable: false }),
    ],
  },

  [Genre.CYBERPUNK]: {
    id:   Genre.CYBERPUNK,
    name: "Cyberpunk",
    tone: "gritty",
    colorPalette: {
      primary: "#22d3ee",
      accent:  "#e879f9",
      bg:      "#030712",
      text:    "#e5e7eb",
    },
    vocabulary: {
      hp:           "Integrity",
      currency:     "credits",
      currencyName: "Credits",
    },
    narratorPersonality: "Terse, neon-soaked, gritty cyberpunk narrator — short sentences, street slang.",
    startingLocation:    "cyberpunk_start_01",
    soundIds: {
      ambient:   "cyberpunk_city_hum",
      combat:    "cyberpunk_gunshot_burst",
      discovery: "cyberpunk_data_unlock",
    },
    itemTemplates: [
      tpl("tpl_cyber_mono_blade",      "Mono-blade",      ItemType.WEAPON,     ItemRarity.UNCOMMON, "Monomolecular edge — cuts through most corporate armor.", { weight: 2, stat_bonus: { agility: 1 } }),
      tpl("tpl_cyber_kevlar_vest",     "Kevlar Vest",     ItemType.ARMOR,      ItemRarity.COMMON,   "Standard-issue ballistic weave.",       { weight: 4 }),
      tpl("tpl_cyber_stim_pack",       "Stim Pack",       ItemType.CONSUMABLE, ItemRarity.COMMON,   "Adrenaline and nanobots in a syringe.", { effect: { heal: 20 } }),
      tpl("tpl_cyber_neural_booster",  "Neural Booster",  ItemType.CONSUMABLE, ItemRarity.UNCOMMON, "Overclocks cognitive processing.",      { effect: { buff_intelligence_2: 1 } }),
      tpl("tpl_cyber_access_card",     "Access Card",     ItemType.KEY,        ItemRarity.COMMON,   "Level-3 security clearance chip.",      { stackable: false }),
      tpl("tpl_cyber_encrypted_file",  "Encrypted File",  ItemType.LORE,       ItemRarity.RARE,     "Stolen corporate data of unknown value.", { stackable: false }),
    ],
  },

  [Genre.HORROR_LOVECRAFTIAN]: {
    id:   Genre.HORROR_LOVECRAFTIAN,
    name: "Horror / Lovecraftian",
    tone: "dread",
    colorPalette: {
      primary: "#84cc16",
      accent:  "#7c3aed",
      bg:      "#030712",
      text:    "#d1fae5",
    },
    vocabulary: {
      hp:           "HP",
      currency:     null,
      currencyName: null,
      sanity:       "Sanity",
    },
    narratorPersonality: "Slow dread, cosmic horror narrator — unreliable perception, mounting existential terror.",
    startingLocation:    "horror_lovecraftian_start_01",
    soundIds: {
      ambient:   "horror_dark_atmosphere",
      combat:    "horror_monster_shriek",
      discovery: "horror_forbidden_knowledge",
    },
    itemTemplates: [
      tpl("tpl_horror_iron_pipe",      "Iron Pipe",       ItemType.WEAPON,     ItemRarity.COMMON,   "Cold and heavy in the hand.",           { weight: 3, stat_bonus: { strength: 1 } }),
      tpl("tpl_horror_trench_coat",    "Trench Coat",     ItemType.ARMOR,      ItemRarity.COMMON,   "Offers little protection but much comfort.", { weight: 2 }),
      tpl("tpl_horror_laudanum",       "Laudanum",        ItemType.CONSUMABLE, ItemRarity.UNCOMMON, "Dulls the horror — briefly.",           { effect: { heal: 15, sanity: 10 } }),
      tpl("tpl_horror_torch",          "Torch",           ItemType.CONSUMABLE, ItemRarity.COMMON,   "Keeps something at bay.",               { effect: { reveal: 1 } }),
      tpl("tpl_horror_brass_key",      "Brass Key",       ItemType.KEY,        ItemRarity.UNCOMMON, "It trembles in your palm.",             { stackable: false }),
      tpl("tpl_horror_forbidden_tome", "Forbidden Tome",  ItemType.LORE,       ItemRarity.LEGENDARY,"Reading it costs something.",           { stackable: false, effect: { sanity: -10 } }),
    ],
  },

  [Genre.SPACE_OPERA]: {
    id:   Genre.SPACE_OPERA,
    name: "Space Opera",
    tone: "operatic",
    colorPalette: {
      primary: "#a855f7",
      accent:  "#e2e8f0",
      bg:      "#030712",
      text:    "#e2e8f0",
    },
    vocabulary: {
      hp:           "Hull Integrity",
      currency:     "stellar_units",
      currencyName: "Stellar Units",
    },
    narratorPersonality: "Pulpy, grand-scale space opera narrator — operatic stakes, alien wonder.",
    startingLocation:    "space_opera_start_01",
    soundIds: {
      ambient:   "space_deep_hum",
      combat:    "space_laser_fire",
      discovery: "space_alien_discovery",
    },
    itemTemplates: [
      tpl("tpl_space_plasma_pistol",   "Plasma Pistol",   ItemType.WEAPON,     ItemRarity.UNCOMMON, "Semi-automatic. Smells like ozone.",    { weight: 2, stat_bonus: { perception: 1 } }),
      tpl("tpl_space_enviro_suit",     "Enviro-Suit",     ItemType.ARMOR,      ItemRarity.COMMON,   "Seals against vacuum and radiation.",   { weight: 6 }),
      tpl("tpl_space_med_patch",       "Med-Patch",       ItemType.CONSUMABLE, ItemRarity.COMMON,   "Nano-thread stitches wounds in seconds.", { effect: { heal: 25 } }),
      tpl("tpl_space_focus_drug",      "Focus Drug",      ItemType.CONSUMABLE, ItemRarity.UNCOMMON, "Sharpens targeting and spatial sense.", { effect: { buff_perception_2: 1 } }),
      tpl("tpl_space_security_chip",   "Security Chip",   ItemType.KEY,        ItemRarity.COMMON,   "Override for shipyard access gates.",   { stackable: false }),
      tpl("tpl_space_star_chart",      "Star Chart",      ItemType.LORE,       ItemRarity.RARE,     "Coordinates to something significant.", { stackable: false }),
    ],
  },

  [Genre.POST_APOCALYPTIC]: {
    id:   Genre.POST_APOCALYPTIC,
    name: "Post-Apocalyptic",
    tone: "bleak",
    colorPalette: {
      primary: "#ea580c",
      accent:  "#78716c",
      bg:      "#0a0a0a",
      text:    "#d6d3d1",
    },
    vocabulary: {
      hp:           "HP",
      currency:     "caps",
      currencyName: "Caps",
    },
    narratorPersonality: "Dry, world-weary, darkly humorous survivor narrator — moral ambiguity, resource scarcity.",
    startingLocation:    "post_apocalyptic_start_01",
    soundIds: {
      ambient:   "wasteland_wind",
      combat:    "wasteland_scavenger_fight",
      discovery: "wasteland_ruins_explore",
    },
    itemTemplates: [
      tpl("tpl_apoc_pipe_wrench",      "Pipe Wrench",     ItemType.WEAPON,     ItemRarity.COMMON,   "Heavy. Dents skulls. Fixes pipes.",     { weight: 4, stat_bonus: { strength: 1 } }),
      tpl("tpl_apoc_leather_jacket",   "Leather Jacket",  ItemType.ARMOR,      ItemRarity.COMMON,   "Pre-war fashion. Post-war function.",   { weight: 3 }),
      tpl("tpl_apoc_stimpak",          "Stimpak",         ItemType.CONSUMABLE, ItemRarity.COMMON,   "Med-X suspended in a syringe.",         { effect: { heal: 20 } }),
      tpl("tpl_apoc_rad_x",            "Rad-X",           ItemType.CONSUMABLE, ItemRarity.UNCOMMON, "Boosts muscle response. Briefly.",      { effect: { buff_strength_1: 1 } }),
      tpl("tpl_apoc_vault_key",        "Vault Key",       ItemType.KEY,        ItemRarity.RARE,     "Opens something that should stay shut.", { stackable: false }),
      tpl("tpl_apoc_prewar_manual",    "Pre-War Manual",  ItemType.LORE,       ItemRarity.UNCOMMON, "Technical diagrams for a better world.", { stackable: false }),
    ],
  },
};
