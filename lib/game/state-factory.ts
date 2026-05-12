import {
  Genre,
  Difficulty,
  LocationStatus,
  LogEntryType,
  type MasterState,
  type PlayerState,
  type WorldState,
  type LogBook,
} from "@/types/game";
import { STAT_CAP } from "./constants";

const GENRE_TONE: Record<Genre, string> = {
  [Genre.FANTASY]:             "heroic",
  [Genre.CYBERPUNK]:           "gritty",
  [Genre.HORROR_LOVECRAFTIAN]: "dread",
  [Genre.SPACE_OPERA]:         "operatic",
  [Genre.POST_APOCALYPTIC]:    "bleak",
};

function buildStartingResources(genre: Genre): Record<string, number> {
  switch (genre) {
    case Genre.FANTASY:             return { gold: 10 };
    case Genre.CYBERPUNK:           return { credits: 500 };
    case Genre.HORROR_LOVECRAFTIAN: return {};
    case Genre.SPACE_OPERA:         return { stellar_units: 100 };
    case Genre.POST_APOCALYPTIC:    return { caps: 25, ammo: 10, food: 5, water: 3 };
  }
}

export function createNewMasterState(
  genre: Genre,
  characterName: string,
  background: string,
  difficulty: Difficulty = Difficulty.NORMAL
): MasterState {
  const now        = new Date().toISOString();
  const sessionId  = crypto.randomUUID();
  const startLoc   = `${genre}_start_01`;

  const player_state: PlayerState = {
    name:       characterName,
    background,
    health:     100,
    max_health: 100,
    ...(genre === Genre.HORROR_LOVECRAFTIAN && { sanity: 100, max_sanity: 100 }),
    resources:  buildStartingResources(genre),
    attributes: {
      strength:     3,
      agility:      3,
      charisma:     3,
      intelligence: 3,
      perception:   3,
    },
    inventory: [],
    level:     1,
    xp:        0,
    // Day 22 — initialize leveling fields. The /api/game/new route
    // overwrites attributes via buildStartingAttributes(background)
    // immediately after this factory call; pending_level_up + stat_cap
    // stay at these defaults.
    pending_level_up: false,
    stat_cap:  STAT_CAP,
  };

  const world_state: WorldState = {
    current_location_id: startLoc,
    visited_locations:   [startLoc],
    flags:               {},
    location_status:     LocationStatus.PRESENT,
  };

  const log_book: LogBook = {
    entries: [
      {
        id:        crypto.randomUUID(),
        timestamp: now,
        type:      LogEntryType.SYSTEM,
        content:   `${characterName} begins their journey.`,
      },
    ],
    session_summary: null,
  };

  return {
    metadata: {
      genre,
      tone:        GENRE_TONE[genre],
      difficulty,
      session_id:  sessionId,
      created_at:  now,
      last_played: now,
    },
    player_state,
    world_state,
    log_book,
    npc_registry: {},
  };
}
