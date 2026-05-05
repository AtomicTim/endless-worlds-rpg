// Core game state and AI loop types for Endless Worlds RPG

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum Genre {
  FANTASY             = "fantasy",
  CYBERPUNK           = "cyberpunk",
  HORROR_LOVECRAFTIAN = "horror_lovecraftian",
  SPACE_OPERA         = "space_opera",
  POST_APOCALYPTIC    = "post_apocalyptic",
}

export enum ActionType {
  MOVE     = "MOVE",
  ATTACK   = "ATTACK",
  INTERACT = "INTERACT",
  EXAMINE  = "EXAMINE",
  USE_ITEM = "USE_ITEM",
  DIALOGUE = "DIALOGUE",
  CUSTOM   = "CUSTOM",
}

export enum SubscriptionTier {
  FREE       = "free",
  ADVENTURER = "adventurer",
  LEGEND     = "legend",
}

export enum ItemType {
  WEAPON     = "WEAPON",
  ARMOR      = "ARMOR",
  CONSUMABLE = "CONSUMABLE",
  KEY        = "KEY",
  LORE       = "LORE",
  CONTAINER  = "CONTAINER",
}

export enum ItemRarity {
  COMMON    = "COMMON",
  UNCOMMON  = "UNCOMMON",
  RARE      = "RARE",
  LEGENDARY = "LEGENDARY",
}

export enum LocationStatus {
  PRESENT  = "PRESENT",   // player is here, acting within this location
  ARRIVING = "ARRIVING",  // player just moved here this turn
}

export enum Difficulty {
  EASY      = "easy",
  NORMAL    = "normal",
  HARD      = "hard",
  NIGHTMARE = "nightmare",
}

export enum LogEntryType {
  STORY     = "STORY",
  COMBAT    = "COMBAT",
  DISCOVERY = "DISCOVERY",
  DIALOGUE  = "DIALOGUE",
  SYSTEM    = "SYSTEM",
}

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

export interface Item {
  id:          string;
  name:        string;
  type:        ItemType;
  rarity:      ItemRarity;
  description: string;
  effect?:     Record<string, number | string>;
  quantity:    number;
  genre_skin?: string;
  weight?:     number;
  stackable:   boolean;
  max_stack?:  number;
  equipped?:   boolean;
  stat_bonus?: Partial<Attributes>;
  searched?:   boolean;
  contains?:   Item[];
  /** Sell value in genre currency. Common 5-15, Uncommon 20-50,
   *  Rare 100-300, Legendary 500+. */
  value?:      number;
}

export interface EquippedLoadout {
  weapon?:    Item;
  armor?:     Item;
  accessory?: Item;
}

export interface ActiveBuff {
  id:         string;
  stat:       keyof Attributes;
  amount:     number;
  source:     string;
  expires_at: string | null;
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

export interface Attributes {
  strength:     number;
  agility:      number;
  charisma:     number;
  intelligence: number;
  perception:   number;
}

export interface PlayerState {
  name:        string;
  background:  string;
  health:      number;
  max_health:  number;
  sanity?:     number;
  max_sanity?: number;
  resources:   Record<string, number>;
  attributes:  Attributes;
  inventory:   Item[];
  level:       number;
  xp:          number;
  buffs?:      ActiveBuff[];
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export interface WorldState {
  current_location_id: string;
  visited_locations:   string[];
  flags:               Record<string, boolean | number | string>;
  location_status:     LocationStatus;
}

// ---------------------------------------------------------------------------
// Log Book
// ---------------------------------------------------------------------------

export interface LogEntry {
  id:        string;
  timestamp: string;
  type:      LogEntryType;
  content:   string;
}

/** Minimal snapshot of a narrative/dialogue feed message stored in the session for restoration. */
export interface StoredMessage {
  id:        string;
  type:      "NARRATIVE" | "DIALOGUE";
  content:   string;
  timestamp: string; // ISO string — survives JSON round-trip
  metadata?: Record<string, unknown>;
}

export interface LogBook {
  entries:          LogEntry[];
  session_summary:  string | null;
  /** Last 8 NARRATIVE/DIALOGUE messages — restored to the StoryFeed on session reload. */
  recent_messages?: StoredMessage[];
}

// ---------------------------------------------------------------------------
// NPC Registry
// ---------------------------------------------------------------------------

export interface NPCMemory {
  id:                  string;
  npc_key:             string;
  name:                string;
  role:                string;
  relationship_status: string;
  trust_score:         number;
  memory_snippets:     string[];
  faction_id?:         string;
  last_interaction?:   string;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Day 17 — World Seed (the world skeleton generated at character creation)
// ---------------------------------------------------------------------------

export interface SeedLocation {
  /** Normalized slug used as both world_assets.asset_id and current_location_id. */
  id:           string;
  /** Display name e.g. "The Iron Gate Tavern". */
  name:         string;
  type:         "tavern" | "settlement" | "wilderness" | "dungeon"
              | "market" | "stronghold" | "ruin" | "port" | "other";
  /** 2-3 sentences of structural facts. */
  description:  string;
  /** Faction id (when one controls this place). */
  faction_id?:  string;
  /** Other location ids this connects to — used by the narrator for hints. */
  connected_to?: string[];
}

export interface SeedNPC {
  /** Normalized slug e.g. "innkeeper_marta". */
  id:          string;
  /** Display name — known from session start (no placeholder). */
  name:        string;
  /** Short role descriptor — "innkeeper", "merchant", "quest_giver", etc. */
  role:        string;
  /** Where the NPC is found. Matches a SeedLocation id. */
  location_id: string;
  /** 1-2 sentences capturing the NPC's voice and motivation. */
  personality: string;
  /** Quest hooks or world facts this NPC can share (used by the narrator). */
  knows_about?: string[];
  is_merchant?: boolean;
}

export interface SeedQuest {
  /** Internal label — the player never sees this. */
  title:           string;
  /** The opening hint the narrator should plant in the first scene. */
  hook:            string;
  /** Who or what the conflict involves. */
  antagonist:      string;
  /** What resolving the quest requires. */
  goal:            string;
  /** 3-5 hints to surface naturally over time. */
  breadcrumbs:     string[];
  /** What constitutes completing the quest. */
  win_condition:   string;
}

export interface SeedFaction {
  id:           string;
  name:         string;
  disposition: "ally" | "neutral" | "enemy";
  /** Locations this faction controls — free text or comma-separated names. */
  territory:    string;
}

export interface WorldSeed {
  /** World identity. */
  world_name:        string;
  /** One evocative sentence describing the world. */
  world_tagline:     string;
  /** Fully pre-seeded starting area. */
  starting_location: SeedLocation;
  /** 2-3 additional named locations connected to the start. */
  known_locations:   SeedLocation[];
  /** 3+ key NPCs in the starting area. */
  key_npcs:          SeedNPC[];
  /** Sealed main quest the player gradually discovers. */
  main_quest:        SeedQuest;
  /** 2+ world factions. */
  factions:          SeedFaction[];
}

export interface Metadata {
  genre:       Genre;
  tone:        string;
  difficulty:  Difficulty;
  session_id:  string;
  created_at:  string;
  last_played: string;
  /** Day 17 — pre-generated world skeleton, immutable for the session. */
  world_seed?: WorldSeed;
}

// ---------------------------------------------------------------------------
// MasterState — the single serializable game state stored in Supabase
// ---------------------------------------------------------------------------

export interface MasterState {
  metadata:     Metadata;
  player_state: PlayerState;
  world_state:  WorldState;
  log_book:     LogBook;
  npc_registry: Record<string, NPCMemory>;
}

// ---------------------------------------------------------------------------
// AI Loop
// ---------------------------------------------------------------------------

export interface ParsedAction {
  action_type:      ActionType;
  primary_target?:  string;
  secondary_target?: string;
  item_used?:       string;
  inferred_intent:  string;
  confidence:       number;
  /** Tone classification — only set when action_type is DIALOGUE. */
  dialogue_tone?:   "friendly" | "persuasive" | "deceptive" | "intimidating" | "curious" | "neutral";
}

export type StateDelta = {
  metadata?:     Partial<Metadata>;
  player_state?: Partial<PlayerState>;
  world_state?:  Partial<WorldState>;
  log_book?:     Partial<LogBook>;
  npc_registry?: Record<string, NPCMemory>;
};

export interface ResolutionResult {
  success:            boolean;
  outcome_type:       string;
  state_delta:        StateDelta;
  narrative_context:  Record<string, unknown>;
}

export interface PointOfInterest {
  label:       string;
  type:        "LOCATION" | "NPC" | "CONTAINER" | "ITEM" | "HAZARD";
  description: string;
}

export interface DialogueOption {
  id:    string;
  text:  string;
  tone:  "friendly" | "aggressive" | "curious" | "deceptive";
  // No stat_check field — the stat check applied when clicking this option
  // is derived purely from `tone` by the game engine. The DialogueModal
  // renders a tone-derived badge for the player; the resolver routes the
  // tone classification through resolveDialogue's switch.
}

export interface CodexEntry {
  id:                  string;
  category:            "LOCATION" | "CHARACTER" | "FACTION" | "ITEM" | "LORE" | "BESTIARY";
  name:                string;
  description:         string;
  first_seen_location: string;
  significance:        "MINOR" | "NOTABLE" | "MAJOR";
}

export interface NarratorResponse {
  response_tier:       1 | 2 | 3;
  narrative_text:      string;
  ascii_art?:          string | null;
  sound_id?:           string | null;
  new_npcs:            NPCMemory[];
  items_acquired?:     Item[];
  points_of_interest:  PointOfInterest[];
  codex_entries:       CodexEntry[];
  /** Populated when the player learns a CHARACTER's true identity this turn.
   *  The narrator emits ONLY the true name — the game engine derives the
   *  asset_id from locationAssets context (placeholder match, true_name
   *  match in constitution, or normalizing the active NPC name). */
  revealed_npc_names?: Array<{ true_name: string }>;
  /** Terse 12-word journal shorthand of the beat — used for LogBook STORY entries. */
  log_summary?:        string;
  /** 3-4 response options shown in the Dialogue Modal; only for NPC interactions. */
  dialogue_options?:   DialogueOption[];
  /** Trust score deltas for NPCs affected by this interaction. */
  trust_changes?:      Array<{ npc_key: string; delta: number; reason: string }>;
  /** Items the merchant is offering for sale this turn. NOT granted —
   *  shown to the player in the Trade Modal so they can choose to buy. */
  items_for_sale?:     Item[];
}

// ---------------------------------------------------------------------------
// World Assets — permanent constitution of every named entity
// ---------------------------------------------------------------------------

export enum AssetCategory {
  LOCATION  = "LOCATION",
  CHARACTER = "CHARACTER",
  FACTION   = "FACTION",
  ITEM      = "ITEM",
  LORE      = "LORE",
  BESTIARY  = "BESTIARY",
}

export interface WorldAssetConstitution {
  // LOCATION fields
  physical_description?: string;
  atmosphere?:           string;
  size?:                 string;
  faction_affiliation?:  string;
  key_landmarks?:        string[];
  available_services?:   string[];

  // CHARACTER fields
  appearance?:           string;
  personality?:          string;
  role?:                 string;
  faction?:              string;
  speech_patterns?:      string;
  initial_relationship?: string;

  // FACTION fields
  ideology?:               string;
  territory?:              string;
  relationship_to_others?: string;

  // CREATURE / BESTIARY fields
  behavior?:               string;
  habitat?:                string;
  threat_level?:           string;

  // ITEM fields
  item_type?:        string;
  item_description?: string;

  // LORE fields
  lore_content?: string;

  // Shared
  notes?: string;

  // CHARACTER — true name (may differ from placeholder display name)
  true_name?: string;
}

export interface WorldAsset {
  id:                  string;
  category:            AssetCategory;
  name:                string;
  constitution:        WorldAssetConstitution;
  significance:        "NOTABLE" | "MAJOR";
  first_seen_location: string;
  session_id:          string;
  created_at:          string;
  svg_content?:        string;
  /** false = player hasn't learned this CHARACTER's real identity yet */
  name_known:          boolean;
}
