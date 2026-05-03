import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createNewMasterState } from "@/lib/game/state-factory";
import { saveMasterState } from "@/lib/game/state-persistence";
import { Genre, Difficulty, ItemType, ItemRarity } from "@/types/game";
import type { Attributes, Item } from "@/types/game";

interface BackgroundConfig {
  bonusAttribute: keyof Attributes;
  startingItemName: string;
  startingItemType: ItemType;
  startingItemDescription: string;
}

const BACKGROUND_CONFIGS: Record<Genre, Record<string, BackgroundConfig>> = {
  [Genre.FANTASY]: {
    knight: {
      bonusAttribute: "strength",
      startingItemName: "Iron Sword",
      startingItemType: ItemType.WEAPON,
      startingItemDescription: "A well-balanced iron sword, worn but reliable.",
    },
    rogue: {
      bonusAttribute: "agility",
      startingItemName: "Lockpicks",
      startingItemType: ItemType.KEY,
      startingItemDescription: "A set of delicate picks. Not many doors remain closed to you.",
    },
    mage: {
      bonusAttribute: "intelligence",
      startingItemName: "Spell Tome",
      startingItemType: ItemType.LORE,
      startingItemDescription: "A tome of basic arcane knowledge. The ink seems to shift when unobserved.",
    },
  },
  [Genre.CYBERPUNK]: {
    netrunner: {
      bonusAttribute: "intelligence",
      startingItemName: "Neural Deck",
      startingItemType: ItemType.WEAPON,
      startingItemDescription: "A jury-rigged interface deck. It still jacks in.",
    },
    fixer: {
      bonusAttribute: "charisma",
      startingItemName: "Burner Phone",
      startingItemType: ItemType.KEY,
      startingItemDescription: "Pre-loaded with a dozen untraceable contacts. Handle with care.",
    },
    street_samurai: {
      bonusAttribute: "agility",
      startingItemName: "Katana",
      startingItemType: ItemType.WEAPON,
      startingItemDescription: "A mono-edged blade. Old world steel. Doesn't need batteries.",
    },
  },
  [Genre.HORROR_LOVECRAFTIAN]: {
    investigator: {
      bonusAttribute: "intelligence",
      startingItemName: "Case Notes",
      startingItemType: ItemType.LORE,
      startingItemDescription: "Pages of investigation notes. The last entry trails off mid-sentence.",
    },
    cultist: {
      bonusAttribute: "perception",
      startingItemName: "Forbidden Text",
      startingItemType: ItemType.LORE,
      startingItemDescription: "A fragment of a text that should not exist. Reading it costs something.",
    },
    survivor: {
      bonusAttribute: "strength",
      startingItemName: "Makeshift Club",
      startingItemType: ItemType.WEAPON,
      startingItemDescription: "Table leg, nails, duct tape. It works.",
    },
  },
  [Genre.SPACE_OPERA]: {
    commander: {
      bonusAttribute: "charisma",
      startingItemName: "Command Badge",
      startingItemType: ItemType.KEY,
      startingItemDescription: "Worn insignia of rank. Doors open. Crews listen. Sometimes.",
    },
    pilot: {
      bonusAttribute: "agility",
      startingItemName: "Nav Charts",
      startingItemType: ItemType.LORE,
      startingItemDescription: "Star charts of the outer sectors. Several routes are marked unsafe.",
    },
    engineer: {
      bonusAttribute: "intelligence",
      startingItemName: "Engineer's Toolkit",
      startingItemType: ItemType.KEY,
      startingItemDescription: "Multi-tool with calibrated instruments. You can fix almost anything.",
    },
  },
  [Genre.POST_APOCALYPTIC]: {
    scavenger: {
      bonusAttribute: "perception",
      startingItemName: "Scrap Tool",
      startingItemType: ItemType.KEY,
      startingItemDescription: "A repurposed multi-tool salvaged from the ruins. Worth its weight.",
    },
    raider: {
      bonusAttribute: "strength",
      startingItemName: "Pipe Wrench",
      startingItemType: ItemType.WEAPON,
      startingItemDescription: "Heavy. Durable. Persuasive.",
    },
    medic: {
      bonusAttribute: "intelligence",
      startingItemName: "First Aid Kit",
      startingItemType: ItemType.CONSUMABLE,
      startingItemDescription: "Half-depleted but still useful. Bandages, antibiotics, a tourniquet.",
    },
  },
};

interface NewGameBody {
  genre: Genre;
  characterName: string;
  background: string;
  attributes: Attributes;
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: NewGameBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { genre, characterName, background, attributes } = body;

  if (!genre || !characterName || !background || !attributes) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!Object.values(Genre).includes(genre)) {
    return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
  }

  const nameRegex = /^[a-zA-Z0-9\-' ]{2,24}$/;
  if (!nameRegex.test(characterName.trim())) {
    return NextResponse.json({ error: "Invalid character name" }, { status: 400 });
  }

  const totalPoints = Object.values(attributes).reduce((sum, v) => sum + v, 0);
  if (totalPoints !== 20) {
    return NextResponse.json({ error: "Attributes must total exactly 20 points" }, { status: 400 });
  }

  for (const val of Object.values(attributes)) {
    if (val < 1 || val > 8) {
      return NextResponse.json({ error: "Each attribute must be between 1 and 8" }, { status: 400 });
    }
  }

  const state = createNewMasterState(genre, characterName.trim(), background, Difficulty.NORMAL);

  // Override default attributes with player's chosen distribution
  state.player_state.attributes = { ...attributes };

  // Apply background bonus and add starting item
  const bgConfig = BACKGROUND_CONFIGS[genre]?.[background];
  if (bgConfig) {
    const attr = bgConfig.bonusAttribute;
    state.player_state.attributes[attr] = Math.min(10, state.player_state.attributes[attr] + 2);

    const startingItem: Item = {
      id:          crypto.randomUUID(),
      name:        bgConfig.startingItemName,
      type:        bgConfig.startingItemType,
      rarity:      ItemRarity.COMMON,
      description: bgConfig.startingItemDescription,
      quantity:    1,
      stackable:   bgConfig.startingItemType === ItemType.CONSUMABLE,
    };
    state.player_state.inventory.push(startingItem);
  }

  const sessionId = state.metadata.session_id;

  try {
    await saveMasterState(supabase, sessionId, state);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save game state";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ sessionId });
}
