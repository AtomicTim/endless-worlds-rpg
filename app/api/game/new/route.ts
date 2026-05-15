import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createNewMasterState } from "@/lib/game/state-factory";
import { saveMasterState } from "@/lib/game/state-persistence";
import { Genre, Difficulty } from "@/types/game";
import type { Attributes } from "@/types/game";
import { BACKGROUND_CONFIGS, buildItem } from "@/lib/game/starting-equipment";
import { buildStartingAttributes } from "@/lib/game/archetypes";
import { STAT_CAP } from "@/lib/game/constants";
import {
  drawStartingLearnedPool,
  getPassiveForClass,
  getSlotAbilitiesForClass,
} from "@/lib/game/abilities";

/**
 * Day 20.1 — combat-functional starting equipment now lives in
 * lib/game/starting-equipment.ts (Next.js App Router routes can only
 * export HTTP handlers + a small whitelist of config symbols).
 */

interface NewGameBody {
  genre: Genre;
  characterName: string;
  background: string;
  /** Day 22 — attributes payload is no longer authoritative. The
   *  archetype map deterministically computes starting stats from
   *  `background`. Field kept optional purely so older clients that
   *  still send it don't 400. The route IGNORES the value. */
  attributes?: Attributes;
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

  const { genre, characterName, background } = body;

  if (!genre || !characterName || !background) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!Object.values(Genre).includes(genre)) {
    return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
  }

  const nameRegex = /^[a-zA-Z0-9\-' ]{2,24}$/;
  if (!nameRegex.test(characterName.trim())) {
    return NextResponse.json({ error: "Invalid character name" }, { status: 400 });
  }

  // Day 22 — point-buy validation removed. Starting attributes are
  // deterministically computed from the archetype map: base 2 across
  // the board, +2 to primary, +1 to secondary. body.attributes (if
  // sent by an older client) is ignored — the archetype IS the spec.

  const state = createNewMasterState(genre, characterName.trim(), background, Difficulty.NORMAL);

  // Day 22 — archetype-deterministic starting attributes (replaces the
  // legacy +2 bonusAttribute bump on top of a point-buy distribution).
  state.player_state.attributes = buildStartingAttributes(background);
  state.player_state.level = 1;
  state.player_state.xp = 0;
  state.player_state.pending_level_up = false;
  state.player_state.stat_cap = STAT_CAP;

  // Starting items continue to flow through BACKGROUND_CONFIGS unchanged.
  // The bonusAttribute field on BackgroundConfig is now redundant with
  // the archetype map (primary stat in both); it stays on the type for
  // back-compat but is no longer read here.
  const bgConfig = BACKGROUND_CONFIGS[genre]?.[background];
  if (bgConfig) {
    for (const spec of bgConfig.startingItems) {
      state.player_state.inventory.push(buildItem(spec));
    }
  }

  // P7 — class ability seeding. Every class ships with:
  //   • slot 1 (the fixed class identity ability)
  //   • passive (always active, never slotted)
  //   • a starting learned pool of 3 abilities drawn from slots 2/3/4
  //     candidates (v1 = the single ability per slot, so all 3 land).
  // Slots 2/3/4 stay null until levels 5/10/15 — the LevelUpModal opens
  // the slot-unlock step and either auto-assigns (slot 2) or offers a
  // pick (slots 3/4).
  const passive   = getPassiveForClass(background);
  const slot1Pool = getSlotAbilitiesForClass(background, 1);
  const slot1     = slot1Pool[0];
  const learned   = drawStartingLearnedPool(background);

  if (passive) state.player_state.passive_ability = passive.id;
  if (slot1) {
    state.player_state.equipped_ability_slots[0] = slot1.id;
    // The slot-1 ability also lives in the learned pool (the player
    // "knows" it; the equipped slot just locks it into the loadout).
    if (!learned.includes(slot1.id)) learned.push(slot1.id);
  }
  state.player_state.learned_abilities = learned;

  const sessionId = state.metadata.session_id;

  try {
    await saveMasterState(supabase, sessionId, state);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save game state";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ sessionId });
}
