import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createNewMasterState } from "@/lib/game/state-factory";
import { saveMasterState } from "@/lib/game/state-persistence";
import { Genre, Difficulty } from "@/types/game";
import type { Attributes } from "@/types/game";
import { BACKGROUND_CONFIGS, buildItem } from "@/lib/game/starting-equipment";

/**
 * Day 20.1 — combat-functional starting equipment now lives in
 * lib/game/starting-equipment.ts (Next.js App Router routes can only
 * export HTTP handlers + a small whitelist of config symbols).
 */

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

  // Apply background bonus and add starting items.
  const bgConfig = BACKGROUND_CONFIGS[genre]?.[background];
  if (bgConfig) {
    state.player_state.attributes[bgConfig.bonusAttribute] = Math.min(
      10,
      state.player_state.attributes[bgConfig.bonusAttribute] + 2
    );
    for (const spec of bgConfig.startingItems) {
      state.player_state.inventory.push(buildItem(spec));
    }
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
