import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Genre } from "@/types/game";
import type { WorldBible, WorldConsistencyDocument } from "@/types/game";
import { formatWcdBlock } from "@/lib/game/prompt-builder";

interface RequestBody {
  genre?:           Genre;
  character_name?:  string;
  character_class?: string;
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
    "- 1 settlement node (the main arrival point)",
    "- 3-4 notable sub-locations (keep it tight — fewer, richer locations). Always include: 1 inn or tavern, 1 merchant or shop. Add 1-2 more: smithy, temple, guild hall, or garrison.",
    "- Each sub-location: id (slug), name, type, grid_position, is_interior: true, atmosphere (2 sentences max), connections, npc_ids, objects (2-3 Tier 1 objects only — name, description, is_interactable: true), ambient_type.",
    "- Settlement node: is_settlement_node: true, is_interior: false.",
    "",
    "NPCS — generate 4-5 total (keep it focused):",
    "Every NPC must have a REAL NAME. Required: 1 innkeeper, 1 merchant, 1 quest-relevant NPC.",
    "Each NPC: id (character_[slug]), name, home_location_id, role, archetype, appearance (1 sentence), personality (1 sentence), speech_style (3 words), knowledge (2-3 facts), default_trust (50).",
    "",
    "ADJACENT REGIONS — generate exactly 3 outlines (brief):",
    "Each: id, name, type, grid_centre, direction_from_start, distance, atmosphere_hint (1 sentence), key_npc_count (2), location_count (3).",
    "",
    "MAIN QUEST (keep it brief):",
    "antagonist_name, antagonist_location, goal (1 sentence), opening_hook (1 sentence).",
    "breadcrumbs: exactly 3 entries. Each: index, content (1 sentence), delivery_method, suggested_location.",
    "",
    "CRITICAL: Be concise. Every field should be short. The JSON must fit within the token limit.",
    "Respond with valid JSON matching the WorldBible schema.",
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
  if (!Array.isArray(sr.locations) || sr.locations.length < 2) {
    return { ok: false, error: `starting_region.locations must have at least 2 entries (got ${Array.isArray(sr.locations) ? sr.locations.length : "non-array"})` };
  }
  if (!Array.isArray(sr.npcs) || sr.npcs.length < 3) {
    return { ok: false, error: `starting_region.npcs must have at least 3 entries (got ${Array.isArray(sr.npcs) ? sr.npcs.length : "non-array"})` };
  }

  if (!Array.isArray(o.adjacent_regions) || o.adjacent_regions.length < 1) {
    return { ok: false, error: `adjacent_regions must have at least 1 entry (got ${Array.isArray(o.adjacent_regions) ? o.adjacent_regions.length : "non-array"})` };
  }

  const mq = o.main_quest as Record<string, unknown> | undefined;
  if (!mq || typeof mq !== "object") return { ok: false, error: "main_quest missing" };
  if (!Array.isArray(mq.breadcrumbs) || mq.breadcrumbs.length < 2) {
    return { ok: false, error: `main_quest.breadcrumbs must have at least 2 entries (got ${Array.isArray(mq.breadcrumbs) ? mq.breadcrumbs.length : "non-array"})` };
  }

  return { ok: true, bible: parsed as WorldBible };
}

async function callClaude(client: Anthropic, userPrompt: string): Promise<string> {
  const message = await client.messages.create({
    model:      "claude-sonnet-4-20250514",
    max_tokens: 8000,
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
