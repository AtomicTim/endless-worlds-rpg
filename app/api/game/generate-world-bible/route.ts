import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Genre } from "@/types/game";
import type { WorldBible, WorldConsistencyDocument } from "@/types/game";
import { formatWcdBlock } from "@/lib/game/prompt-builder";

/**
 * Day 19B — Generate the World Bible (Layer 1 of world generation).
 *
 * Single Claude call seeded with the WCD as absolute facts. Produces a
 * fully-detailed starting region with named locations, real-name NPCs,
 * Tier 1 objects, plus structural outlines of adjacent regions and the
 * main quest with five breadcrumbs.
 *
 * One retry on parse failure. Validation enforces minimum array sizes
 * and the 5-breadcrumb invariant per the architecture spec.
 */

interface RequestBody {
  genre?:           Genre;
  character_name?:  string;
  character_class?: string;
  /** Required — the WCD constrains every facet of the bible. */
  wcd?:             WorldConsistencyDocument;
}

const SYSTEM_PROMPT =
  "You are a world-building engine for a procedurally generated RPG. " +
  "Generate a complete World Bible for the starting region. This document " +
  "defines every location, NPC, and object the player will encounter at " +
  "the start of their adventure. All content must be consistent with the " +
  "World Consistency Document provided. Respond ONLY with valid JSON. " +
  "No markdown, no code fences, no explanation.";

function buildUserPrompt(
  genre:    Genre,
  name:     string,
  klass:    string,
  wcd:      WorldConsistencyDocument
): string {
  const wcdBlock = formatWcdBlock(wcd);
  return [
    wcdBlock,
    "",
    `Generate a WorldBible for a ${genre} RPG. Character: ${name}, a ${klass}.`,
    "",
    "STARTING REGION — generate a settlement_hub:",
    "The starting region must have:",
    "- 1 settlement node (the main arrival point — the central square, crossroads, or entry point of the settlement)",
    "- 4-5 notable sub-locations within the settlement. Always include: 1 inn or tavern, 1 merchant or shop. Also include 2-3 of: smithy or workshop, temple or shrine or chapel, guild hall or civic building, garrison or guard post, market area, docks or port (if coastal), back alley or underground contact, genre-appropriate equivalent.",
    "- Do NOT generate private homes or non-notable buildings.",
    "- Each sub-location must have: id (normalized slug), name (permanent display name), type, grid_position (cluster within 1-2 cells of settlement node), is_interior: true, atmosphere (2-3 vivid sensory sentences), connections (bidirectional — each sub-location connects back to the settlement node at minimum), npc_ids (list of NPCs assigned here), objects (3-5 Tier 1 landmark objects — the meaningful, interactable things. Each object: id, name, description, is_interactable: true, and optionally contains_lore or quest_relevance).",
    "- The settlement node itself: is_settlement_node: true, is_interior: false, connections to all sub-locations and at least 2 region exits.",
    "",
    "NPCS — generate 5-7 total for the starting region:",
    "Every NPC must have a REAL NAME. No placeholders. No 'the innkeeper' or 'mysterious stranger' as names.",
    "Required: at least 1 innkeeper or tavern owner, at least 1 merchant, at least 1 NPC relevant to the main quest (quest_relevance: key or supporting, knows_breadcrumb: 0).",
    "Each NPC: id (character_[slug]), name, home_location_id, role, archetype, appearance (1-2 sentences), personality (descriptive sentence with 2-3 traits), speech_style (how they talk), knowledge (3-5 WCD-consistent facts this person plausibly knows), default_trust (40-60 for strangers, 65-80 for friendly locals).",
    "",
    "ADJACENT REGIONS — generate 3-4 outlines:",
    "Must be consistent with WCD landmarks and faction territories.",
    "Include variety: at least 1 wilderness or natural area, 1 settlement or port, 1 dungeon or ruin or stronghold.",
    "Grid centres must not overlap. Directions must be logical (north, south, east, west, or diagonals).",
    "At least 1 must contain or border a WCD landmark (set landmark_id).",
    "",
    "MAIN QUEST:",
    "Antagonist must be consistent with WCD factions and their territories.",
    "The opening_hook must be something the player can encounter in the starting region naturally.",
    "Breadcrumb 0 must be deliverable by a starting region NPC or object — set npc_id or object_id.",
    "Breadcrumbs 1-4 escalate in danger and revelation.",
    "Each breadcrumb must feel like a natural discovery, never direct exposition.",
    "",
    "RULES (critical):",
    "- Every NPC has a real name — no placeholders ever",
    "- Every name is permanent and must be used consistently",
    "- Atmosphere must not contradict the WCD",
    "- NPC knowledge arrays must contain only WCD-consistent facts",
    "- All location connections must be bidirectional",
    "- Object names must be specific and evocative, not generic (not just 'shelf' or 'table')",
    "- Objects with quest_relevance: true must relate to the main quest opening hook",
    "",
    "Respond with valid JSON matching the WorldBible schema exactly.",
  ].join("\n");
}

function stripJsonFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

function validateBible(parsed: unknown): { ok: true; bible: WorldBible } | { ok: false; error: string } {
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "WorldBible is not an object" };
  const o = parsed as Record<string, unknown>;

  const sr = o.starting_region as Record<string, unknown> | undefined;
  if (!sr || typeof sr !== "object") return { ok: false, error: "starting_region missing" };
  if (typeof sr.name !== "string" || !sr.name.trim()) return { ok: false, error: "starting_region.name missing" };
  if (!Array.isArray(sr.locations) || sr.locations.length < 3) {
    return { ok: false, error: `starting_region.locations must have at least 3 entries (got ${Array.isArray(sr.locations) ? sr.locations.length : "non-array"})` };
  }
  if (!Array.isArray(sr.npcs) || sr.npcs.length < 4) {
    return { ok: false, error: `starting_region.npcs must have at least 4 entries (got ${Array.isArray(sr.npcs) ? sr.npcs.length : "non-array"})` };
  }

  if (!Array.isArray(o.adjacent_regions) || o.adjacent_regions.length < 2) {
    return { ok: false, error: `adjacent_regions must have at least 2 entries (got ${Array.isArray(o.adjacent_regions) ? o.adjacent_regions.length : "non-array"})` };
  }

  const mq = o.main_quest as Record<string, unknown> | undefined;
  if (!mq || typeof mq !== "object") return { ok: false, error: "main_quest missing" };
  if (!Array.isArray(mq.breadcrumbs) || mq.breadcrumbs.length !== 5) {
    return { ok: false, error: `main_quest.breadcrumbs must have exactly 5 entries (got ${Array.isArray(mq.breadcrumbs) ? mq.breadcrumbs.length : "non-array"})` };
  }

  return { ok: true, bible: parsed as WorldBible };
}

async function callClaude(client: Anthropic, userPrompt: string): Promise<string> {
  const message = await client.messages.create({
    model:      "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: "user", content: userPrompt }],
  });
  return message.content[0]?.type === "text" ? message.content[0].text : "";
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

  const { genre, character_name, character_class, wcd } = body;
  if (!genre || !character_name || !character_class || !wcd) {
    return NextResponse.json(
      { error: "Missing required fields: genre, character_name, character_class, wcd" },
      { status: 400 }
    );
  }
  if (!Object.values(Genre).includes(genre)) {
    return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
  }

  const userPrompt = buildUserPrompt(genre, character_name, character_class, wcd);

  // Per-request client so the API key is read fresh each call.
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let parsed: unknown;
  let parseError = "";
  try {
    const rawText = await callClaude(anthropic, userPrompt);
    try {
      parsed = JSON.parse(stripJsonFences(rawText));
    } catch (err) {
      parseError = err instanceof Error ? err.message : "JSON parse failed";
      const retryPrompt = userPrompt + "\n\nReturn ONLY the JSON object, nothing else. No markdown.";
      const retryRaw = await callClaude(anthropic, retryPrompt);
      try {
        parsed = JSON.parse(stripJsonFences(retryRaw));
      } catch (retryErr) {
        const retryParseErr = retryErr instanceof Error ? retryErr.message : "JSON parse failed (retry)";
        return NextResponse.json(
          { error: "Failed to parse WorldBible JSON after retry", first: parseError, retry: retryParseErr },
          { status: 500 }
        );
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Anthropic call failed" },
      { status: 500 }
    );
  }

  const validated = validateBible(parsed);
  if (!validated.ok) {
    return NextResponse.json(
      { error: `WorldBible validation failed: ${validated.error}` },
      { status: 400 }
    );
  }

  // Stamp generated_at if the model didn't supply one.
  const bible: WorldBible = {
    ...validated.bible,
    generated_at: validated.bible.generated_at || new Date().toISOString(),
  };

  console.log(
    `[WorldBible] Generated: ${bible.starting_region.name}, ` +
    `${bible.starting_region.locations.length} locations, ` +
    `${bible.starting_region.npcs.length} NPCs.`
  );
  return NextResponse.json({ bible });
}
