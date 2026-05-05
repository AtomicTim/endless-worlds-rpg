import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Genre } from "@/types/game";
import type { WorldSeed } from "@/types/game";
import { fallbackWorldSeed } from "@/lib/game/world-seed-generator-fallback";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── System prompt ──────────────────────────────────────────────────────────────

function buildSystemPrompt(genre: Genre): string {
  return `You are a world-building engine for a ${genre} RPG.
Generate a world skeleton — the structural facts that exist before the player arrives.
Be specific and original. No clichés, no recognizable IP.

Respond ONLY with valid JSON matching the exact schema provided.
No markdown, no code fences, no explanation. Just the JSON object.`;
}

// ── User prompt ────────────────────────────────────────────────────────────────

function buildUserPrompt(genre: Genre, name: string, background: string): string {
  return `Genre: ${genre}
Player character: ${name}, a ${background}

Generate a world skeleton for the opening of this campaign:
- ONE starting_location with a specific evocative name (not generic).
- 2-3 known_locations connected to the starting area.
- 3+ key_npcs in the starting area, each with a real name from the start.
  At least ONE of them should be a merchant (is_merchant: true).
- ONE main_quest with a hook the player will encounter naturally and 5 breadcrumbs.
- 2 factions with clear dispositions and territory.

WORLD GRAPH STRUCTURE (Day 18) — every location must specify how it
connects to the others so the player can navigate a real map:
- starting_location.connections must include 2-3 of the known_location ids.
- Every known_location.connections must include the starting_location id
  (so the player can return) and may include other known_locations.
- map_position is a relative {x, y} pair used by the map renderer:
  starting_location is {x: 0, y: 0}; place neighbours at distance 1 in
  logical directions (e.g. {x: 1, y: 0} east, {x: -1, y: 0} west,
  {x: 0, y: 1} north, {x: 0, y: -1} south).
- is_expandable: true for zones the player can wander into sub-areas of
  (towns, settlements, large markets); false for tight discrete places
  (single rooms, stretches of road, ruins).
- npc_ids: list the SeedNPC ids whose location_id matches this location.

Every id must be a snake_case slug (lowercase letters, numbers, underscores only).
Names must be original and specific to this world — no Tolkien, Star Wars, etc.

Required JSON schema (return exactly this shape, fully populated):
{
  "world_name": "string",
  "world_tagline": "one evocative sentence",
  "starting_location": {
    "id": "snake_case_slug",
    "name": "Display Name",
    "type": "tavern|settlement|wilderness|dungeon|market|stronghold|ruin|port|other",
    "description": "2-3 sentences of structural facts",
    "faction_id": "optional snake_case faction id",
    "connected_to": ["other_location_slug_1", "other_location_slug_2"],
    "connections": ["other_location_slug_1", "other_location_slug_2"],
    "is_expandable": true,
    "map_position": { "x": 0, "y": 0 },
    "npc_ids": ["npc_slug_1", "npc_slug_2"]
  },
  "known_locations": [
    {
      "id": "snake_case_slug",
      "name": "Display Name",
      "type": "...",
      "description": "...",
      "faction_id": "optional",
      "connected_to": ["..."],
      "connections": ["..."],
      "is_expandable": false,
      "map_position": { "x": 1, "y": 0 },
      "npc_ids": []
    }
  ],
  "key_npcs": [
    {
      "id": "snake_case_slug",
      "name": "Real Name",
      "role": "innkeeper|merchant|quest_giver|guard|...",
      "location_id": "snake_case_slug of where they're found",
      "personality": "1-2 sentences",
      "knows_about": ["quest hook", "world fact"],
      "is_merchant": false
    }
  ],
  "main_quest": {
    "title": "internal label, player never sees this",
    "hook": "one-sentence hint to plant in the first scene",
    "antagonist": "who or what",
    "goal": "what resolving it requires",
    "breadcrumbs": ["hint 1", "hint 2", "hint 3", "hint 4", "hint 5"],
    "win_condition": "what completion looks like"
  },
  "factions": [
    {
      "id": "snake_case_slug",
      "name": "Faction Name",
      "disposition": "ally|neutral|enemy",
      "territory": "one or more locations or regions"
    }
  ]
}`;
}

// ── Validation / coercion ──────────────────────────────────────────────────────

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function validateWorldSeed(parsed: unknown): WorldSeed | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (typeof o.world_name !== "string") return null;
  if (!o.starting_location || typeof o.starting_location !== "object") return null;
  if (!Array.isArray(o.key_npcs)) return null;
  if (!o.main_quest || typeof o.main_quest !== "object") return null;
  // Cast through unknown — we've validated the shape minimally; the full
  // coercion happens via the schema below at runtime.
  return parsed as WorldSeed;
}

function stripJsonFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

// ── Route handler ──────────────────────────────────────────────────────────────

interface RequestBody {
  genre?:               Genre;
  characterName?:       string;
  characterBackground?: string;
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

  const { genre, characterName, characterBackground } = body;
  if (!genre || !characterName || !characterBackground) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!Object.values(Genre).includes(genre)) {
    return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
  }

  try {
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system:     buildSystemPrompt(genre),
      messages: [
        { role: "user", content: buildUserPrompt(genre, characterName, characterBackground) },
      ],
    });

    const rawText =
      message.content[0]?.type === "text" ? message.content[0].text : "";
    const cleaned = stripJsonFences(rawText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.warn("[generate-world-seed] JSON parse failed — using fallback");
      return NextResponse.json({ worldSeed: fallbackWorldSeed(genre, characterName) });
    }

    const validated = validateWorldSeed(parsed);
    if (!validated) {
      console.warn("[generate-world-seed] schema validation failed — using fallback");
      return NextResponse.json({ worldSeed: fallbackWorldSeed(genre, characterName) });
    }

    // Defensive defaults — fill in any missing optional fields.
    const seed: WorldSeed = {
      world_name:        asString(validated.world_name, `Unknown ${genre}`),
      world_tagline:     asString(validated.world_tagline, ""),
      starting_location: validated.starting_location,
      known_locations:   Array.isArray(validated.known_locations) ? validated.known_locations : [],
      key_npcs:          Array.isArray(validated.key_npcs)        ? validated.key_npcs        : [],
      main_quest: {
        ...validated.main_quest,
        breadcrumbs: isStringArray(validated.main_quest?.breadcrumbs)
          ? validated.main_quest.breadcrumbs
          : [],
      },
      factions: Array.isArray(validated.factions) ? validated.factions : [],
    };

    return NextResponse.json({ worldSeed: seed });
  } catch (err) {
    console.error("[generate-world-seed] unexpected", err);
    return NextResponse.json({ worldSeed: fallbackWorldSeed(genre, characterName) });
  }
}
