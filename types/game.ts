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

export interface LogBook {
  entries:         LogEntry[];
  session_summary: string | null;
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

export interface Metadata {
  genre:       Genre;
  tone:        string;
  difficulty:  Difficulty;
  session_id:  string;
  created_at:  string;
  last_played: string;
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
  /** Populated when the player learns a CHARACTER's true identity this turn. */
  revealed_npc_names?: Array<{ asset_id: string; true_name: string }>;
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
