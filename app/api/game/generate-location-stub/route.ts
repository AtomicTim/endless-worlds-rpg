import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Genre } from "@/types/game";
import type { SeedLocation, WorldSeed } from "@/types/game";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_TYPES = new Set([
  "tavern", "settlement", "wilderness", "dungeon",
  "market", "stronghold", "ruin", "port", "other",
]);

function stripJsonFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

function summariseSeed(seed: WorldSeed | null | undefined): string {
  if (!seed) return "(no world seed available)";
  const parts: string[] = [];
  parts.push(`World: ${seed.world_name} — ${seed.world_tagline}`);
  if (seed.factions?.length > 0) {
    parts.push(
      `Factions: ${seed.factions.map((f) => `${f.name} (${f.disposition})`).join(", ")}`
    );
  }
  const locs = [seed.starting_location, ...(seed.known_locations ?? [])]
    .filter(Boolean)
    .map((l) => l.name);
  if (locs.length > 0) parts.push(`Known locations: ${locs.join(", ")}`);
  return parts.join("\n");
}

function fallbackStub(hint: string, genre: Genre): SeedLocation {
  const slug = hint.toLowerCase().replace(/[^a-z0-9_\s]/g, "").trim().replace(/\s+/g, "_") || `unknown_${genre.toLowerCase()}`;
  return {
    id:          slug,
    name:        hint || "Unnamed Place",
    type:        "other",
    description: "A previously unmentioned location. The narrator will fill in the details.",
  };
}

interface RequestBody {
  locationHint?:    string;
  currentLocation?: string;
  worldSeed?:       WorldSeed;
  genre?:           Genre;
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { locationHint, currentLocation, worldSeed, genre } = body;
  if (!locationHint || !currentLocation || !genre) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!Object.values(Genre).includes(genre)) {
    return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
  }

  const systemPrompt = `Generate a single location for a ${genre} RPG.
The player is moving to: ${locationHint}
Coming from: ${currentLocation}

World context (treat as facts, do not contradict):
${summariseSeed(worldSeed)}

Return JSON with this exact shape (no markdown, no code fences):
{
  "id": "snake_case_slug",
  "name": "Specific Display Name",
  "type": "tavern|settlement|wilderness|dungeon|market|stronghold|ruin|port|other",
  "description": "two sentences of structural facts only",
  "faction_id": "optional snake_case faction id"
}

Rules:
- id must be a normalized slug (lowercase, underscores, no punctuation).
- name must be specific to this world — not generic like "the village".
- description: 2 sentences of structural facts only. No flavor prose, no
  in-character description — that's the narrator's job. Just what the
  place IS, who controls it, what's notable.
- faction_id: only set when the location clearly belongs to a faction
  named in the world context.`;

  try {
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 512,
      system:     systemPrompt,
      messages: [
        { role: "user", content: `Generate the location for "${locationHint}".` },
      ],
    });

    const rawText =
      message.content[0]?.type === "text" ? message.content[0].text : "";
    const cleaned = stripJsonFences(rawText);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ stub: fallbackStub(locationHint, genre) });
    }

    const id   = typeof parsed.id   === "string" ? parsed.id   : "";
    const name = typeof parsed.name === "string" ? parsed.name : "";
    const type = typeof parsed.type === "string" && VALID_TYPES.has(parsed.type)
      ? (parsed.type as SeedLocation["type"])
      : "other";
    const description = typeof parsed.description === "string" ? parsed.description : "";

    if (!id || !name || !description) {
      return NextResponse.json({ stub: fallbackStub(locationHint, genre) });
    }

    const stub: SeedLocation = {
      id,
      name,
      type,
      description,
      ...(typeof parsed.faction_id === "string" && parsed.faction_id ? { faction_id: parsed.faction_id } : {}),
    };
    return NextResponse.json({ stub });
  } catch (err) {
    console.error("[generate-location-stub] unexpected", err);
    return NextResponse.json({ stub: fallbackStub(locationHint, genre) });
  }
}
