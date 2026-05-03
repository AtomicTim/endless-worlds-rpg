import { Genre } from "@/types/game";

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
}

export const GENRE_CONFIGS: Record<Genre, GenreConfig> = {
  [Genre.FANTASY]: {
    id:   Genre.FANTASY,
    name: "Fantasy",
    tone: "heroic",
    colorPalette: {
      primary: "#f59e0b",
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
  },
};
