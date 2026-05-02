// Core game state types for Endless Worlds RPG

export type Genre = "fantasy" | "cyberpunk" | "noir" | "space-opera";
export type Difficulty = "easy" | "normal" | "hard" | "nightmare";
export type Tone = "heroic" | "gritty" | "comedic" | "horror";

export interface GameMetadata {
  genre: Genre;
  tone: Tone;
  difficulty: Difficulty;
  worldName: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerAttributes {
  strength: number;
  dexterity: number;
  intelligence: number;
  charisma: number;
  constitution: number;
  wisdom: number;
}

export interface PlayerState {
  id: string;
  name: string;
  class: string;
  health: number;
  maxHealth: number;
  resources: Record<string, number>;
  attributes: PlayerAttributes;
  inventory: InventoryItem[];
  level: number;
  experience: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  type: "weapon" | "armor" | "consumable" | "key" | "misc";
  stats?: Record<string, number>;
}

export interface WorldState {
  currentLocationId: string;
  flags: Record<string, boolean>;
  visitedLocations: string[];
  timeOfDay: "dawn" | "day" | "dusk" | "night";
  weatherId: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: "story" | "combat" | "discovery" | "npc" | "system";
  content: string;
  locationId?: string;
}

export interface NPCEntry {
  id: string;
  name: string;
  trustScore: number;
  relationshipHistory: string[];
  memorySnippet: string;
  lastInteraction?: string;
}

export interface MasterState {
  sessionId: string;
  metadata: GameMetadata;
  player: PlayerState;
  world: WorldState;
  logBook: LogEntry[];
  npcRegistry: Record<string, NPCEntry>;
}

// AI Loop types
export interface ParsedIntent {
  action: string;
  target?: string;
  parameters?: Record<string, unknown>;
  requiresStatCheck?: {
    attribute: keyof PlayerAttributes;
    difficulty: number;
  };
}

export interface ActionResult {
  success: boolean;
  stateDelta: Partial<MasterState>;
  soundId?: string;
  triggerWildcard?: boolean;
}

export interface NarratorResponse {
  narrative: string;
  asciiArt?: string;
  soundId?: string;
  choices?: string[];
}
