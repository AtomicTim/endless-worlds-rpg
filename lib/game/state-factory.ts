import {
  Genre,
  MasterState,
  Metadata,
  PlayerState,
  WorldStateSnapshot,
  Difficulty,
  Tone,
} from "@/types/game";

// Genre-specific defaults
const GENRE_DEFAULTS: Record<
  Genre,
  { tone: Tone; worldName: string; startLocation: string; currency: string }
> = {
  [Genre.FANTASY]: {
    tone: "heroic",
    worldName: "The Realm of Aethoria",
    startLocation: "village_square",
    currency: "gold",
  },
  [Genre.CYBERPUNK]: {
    tone: "gritty",
    worldName: "NovaTech City",
    startLocation: "neon_alley",
    currency: "credits",
  },
  [Genre.NOIR]: {
    tone: "gritty",
    worldName: "Port Carrow",
    startLocation: "detectives_office",
    currency: "dollars",
  },
  [Genre.SPACE_OPERA]: {
    tone: "heroic",
    worldName: "The Outer Expanse",
    startLocation: "starport_hangar",
    currency: "stellars",
  },
};

export function createNewMasterState(
  genre: Genre,
  characterName: string,
  background: string,
  difficulty: Difficulty = "normal"
): MasterState {
  const defaults = GENRE_DEFAULTS[genre];
  const now = new Date().toISOString();
  const sessionId = crypto.randomUUID();

  const metadata: Metadata = {
    genre,
    tone: defaults.tone,
    difficulty,
    worldName: defaults.worldName,
    createdAt: now,
    updatedAt: now,
  };

  const player: PlayerState = {
    id: crypto.randomUUID(),
    name: characterName,
    background,
    health: 100,
    maxHealth: 100,
    level: 1,
    xp: 0,
    currency: 50,
    attributes: {
      strength:     10,
      agility:      10,
      intelligence: 10,
      charisma:     10,
      perception:   10,
    },
    inventory: [],
    resources: {
      [defaults.currency]: 50,
    },
  };

  const world: WorldStateSnapshot = {
    currentLocationId: defaults.startLocation,
    visitedLocations:  [defaults.startLocation],
    flags:             {},
    timeOfDay:         "day",
    weatherId:         "clear",
  };

  return {
    sessionId,
    metadata,
    player,
    world,
    logBook: [
      {
        id:        crypto.randomUUID(),
        timestamp: now,
        type:      "system",
        content:   `${characterName} begins their journey in ${defaults.worldName}.`,
        locationId: defaults.startLocation,
      },
    ],
    npcRegistry: {},
  };
}
