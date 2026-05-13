import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Genre } from "@/types/game";
import type { NPCDefinition } from "@/types/game";
import { generateSideQuests, type SideQuestGenerationContext } from "@/lib/game/side-quest-generator";

/**
 * Day 23D — Side quest generator HTTP wrapper (V8.66).
 *
 * The core lives in lib/game/side-quest-generator.ts. This route is the
 * external HTTP entry point — used by manual regeneration / debug
 * tooling. apply-regional-bible calls the core directly so the quests
 * land in the same persistence transaction as the rest of the bible.
 *
 * Haiku model. Returns 1-2 quests per quest_hook NPC. Empty array on
 * parse failure / Anthropic error — the apply flow never breaks because
 * of side-quest generation.
 */

export const maxDuration = 60;
export const dynamic     = "force-dynamic";

interface RequestBody {
  session_id?:    string;
  region_id?:     string;
  /** Full NPC array from the RegionBible — we filter to quest_hook
   *  inside the generator core. */
  quest_npcs?:    NPCDefinition[];
  world_context?: Partial<SideQuestGenerationContext>;
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { session_id, region_id, quest_npcs, world_context } = body;
  if (!session_id || !region_id || !Array.isArray(quest_npcs) || !world_context) {
    return NextResponse.json(
      { error: "Missing required fields: session_id, region_id, quest_npcs, world_context" },
      { status: 400 }
    );
  }

  const ctx: SideQuestGenerationContext = {
    world_name:         world_context.world_name         ?? "this world",
    archetype:          world_context.archetype          ?? "ancient_awakening",
    threat_description: world_context.threat_description ?? "an unresolved threat",
    genre:              world_context.genre              ?? Genre.FANTASY,
    tone:               world_context.tone               ?? "grounded",
  };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const sideQuests = await generateSideQuests({
    npcs:     quest_npcs,
    regionId: region_id,
    ctx,
    client,
  });

  console.log(
    `[SideQuests] (route) Generated ${sideQuests.length} quest(s) for ${region_id}`
  );

  return NextResponse.json({ side_quests: sideQuests });
}
