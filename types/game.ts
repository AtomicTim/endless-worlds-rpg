// Core game state and AI loop types for Endless Worlds RPG

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum Genre {
  FANTASY     = "fantasy",
  CYBERPUNK   = "cyberpunk",
  NOIR        = "noir",
  SPACE_OPERA = "space-opera",
}

export enum ActionType {
  MOVE      = "MOVE",
  ATTACK    = "ATTACK",
  INTERACT  = "INTERACT",
  EXAMINE   = "EXAMINE",
  USE_ITEM  = "USE_ITEM",
  DIALOGUE  = "DIALOGUE",
  CUSTOM    = "CUSTOM",
}

export enum SubscriptionTier {
  FREE        = "free",
  ADVENTURER  = "adventurer",
  LEGEND      = "legend",
}

export type Difficulty = "easy" | "normal" | "hard" | "nightmare";
export type Tone       = "heroic" | "gritty" | "comedic" | "horror";

// ---------------------------------------------------------------------------
// Item types
// ---------------------------------------------------------------------------

interface BaseItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
}

export interface Weapon extends BaseItem {
  type: "weapon";
  damage: number;
  damageType: "physical" | "energy" | "magic" | "poison";
  range: "melee" | "ranged";
  strengthReq?: number;
}

export interface Armor extends BaseItem {
  type: "armor";
  defense: number;
  slot: "head" | "body" | "hands" | "feet" | "shield";
  agilityPenalty?: number;
}

export interface Consumable extends BaseItem {
  type: "consumable";
  effect: Record<string, number>;
  charges: number;
}

export interface KeyItem extends BaseItem {
  type: "key";
  unlocksId: string;
}

export interface LoreItem extends BaseItem {
  type: "lore";
  content: string;
  locationDiscovered?: string;
}

export type Item = Weapon | Armor | Consumable | KeyItem | LoreItem;

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

export interface PlayerAttributes {
  strength:     number;
  agility:      number;
  intelligence: number;
  charisma:     number;
  perception:   number;
}

export interface PlayerState {
  id:          string;
  name:        string;
  background:  string;
  health:      number;
  maxHealth:   number;
  level:       number;
  xp:          number;
  currency:    number;
  attributes:  PlayerAttributes;
  inventory:   Item[];
  resources:   Record<string, number>;
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export interface WorldStateSnapshot {
  currentLocationId: string;
  visitedLocations:  string[];
  flags:             Record<string, boolean | string | number>;
  timeOfDay:         "dawn" | "day" | "dusk" | "night";
  weatherId:         string;
}

// ---------------------------------------------------------------------------
// Log Book
// ---------------------------------------------------------------------------

export interface LogEntry {
  id:         string;
  timestamp:  string;
  type:       "story" | "combat" | "discovery" | "npc" | "system";
  content:    string;
  locationId?: string;
}

// ---------------------------------------------------------------------------
// NPC Registry
// ---------------------------------------------------------------------------

export interface NPCEntry {
  id:                  string;
  npcKey:              string;
  name:                string;
  role:                string;
  relationshipStatus:  string;
  trustScore:          number;
  memorySnippets:      string[];
  factionId?:          string;
  lastInteraction?:    string;
}

export type NPCRegistry = Record<string, NPCEntry>;

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export interface Metadata {
  genre:       Genre;
  tone:        Tone;
  difficulty:  Difficulty;
  worldName:   string;
  createdAt:   string;
  updatedAt:   string;
}

// ---------------------------------------------------------------------------
// MasterState — the single serializable game state stored in Supabase
// ---------------------------------------------------------------------------

export interface MasterState {
  sessionId:   string;
  metadata:    Metadata;
  player:      PlayerState;
  world:       WorldStateSnapshot;
  logBook:     LogEntry[];
  npcRegistry: NPCRegistry;
}

// ---------------------------------------------------------------------------
// AI Loop
// ---------------------------------------------------------------------------

export interface ParsedAction {
  actionType:  ActionType;
  target?:     string;
  itemId?:     string;
  dialogueLine?: string;
  parameters?: Record<string, unknown>;
  requiresStatCheck?: {
    attribute:  keyof PlayerAttributes;
    difficulty: number;
  };
}

export interface ResolutionResult {
  success:          boolean;
  stateDelta:       Partial<MasterState>;
  xpGained?:        number;
  itemsGained?:     Item[];
  itemsConsumed?:   string[];
  soundId?:         string;
  triggerWildcard?: boolean;
  failureReason?:   string;
}

export interface NarratorResponse {
  narrative:  string;
  asciiArt?:  string;
  soundId?:   string;
  choices?:   string[];
  locationId?: string;
}
