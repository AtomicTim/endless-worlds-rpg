import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Genre } from "@/types/game";
import type {
  RegionBible,
  RegionOutline,
  WorldConsistencyDocument,
} from "@/types/game";
import { formatWcdBlock } from "@/lib/game/prompt-builder";

// Audit Issue E fix: lift the function timeout to 5 minutes (Vercel
// caps at 300s for Pro). Default 10s/60s budgets weren't enough for
// the 3000-token sonnet response. Combined with the smaller skeleton
// below, this should land in <60s for most regions.
export const maxDuration = 300;
export const dynamic     = "force-dynamic";

/**
 * Day 19D — Generate a Regional Bible (Layer 2 of world generation).
 *
 * Fired when the player approaches a region the WorldBible only sketched.
 * Takes the original RegionOutline (from world_bible.adjacent_regions),
 * the WCD, and a list of already-existing region names; produces a full
 * RegionBible with named locations, real-name NPCs, Tier 1 objects, and
 * exits — ready to be applied via /api/game/apply-regional-bible.
 *
 * One retry on parse failure. Validation enforces minimum array sizes
 * and the presence of a settlement node.
 */

interface RequestBody {
  session_id?:            string;
  outline?:               RegionOutline;
  origin_region_name?:    string;
  direction_from_origin?: string;
  genre?:                 Genre;
  wcd?:                   WorldConsistencyDocument;
  existing_region_names?: string[];
}

const SYSTEM_PROMPT =
  "You are a world-building engine for a procedurally generated RPG. " +
  "Expand the provided region outline into a full Regional Bible. All " +
  "content must be consistent with the World Consistency Document. " +
  "Respond ONLY with valid JSON. No markdown, no code fences, no " +
  "explanation.";

const OPPOSITE: Record<string, string> = {
  north:     "south",
  south:     "north",
  east:      "west",
  west:      "east",
  northeast: "southwest",
  southwest: "northeast",
  northwest: "southeast",
  southeast: "northwest",
};

function buildUserPrompt(
  genre:               Genre,
  outline:             RegionOutline,
  originRegionName:    string,
  directionFromOrigin: string,
  wcd:                 WorldConsistencyDocument,
  existingNames:       string[]
): string {
  const wcdBlock = formatWcdBlock(wcd);
  const opposite = OPPOSITE[directionFromOrigin.toLowerCase()] ?? "the opposite direction";
  const existing = existingNames.length > 0 ? existingNames.join(", ") : "(none)";
  const factionLine = outline.controlling_faction
    ? `Region is controlled by faction "${outline.controlling_faction}" — at least 1 NPC must be affiliated with that faction.`
    : "Faction affiliations only when consistent with the WCD.";
  const landmarkLine = outline.landmark_id
    ? `If outline.landmark_id ("${outline.landmark_id}") is set, feature it prominently in one location's atmosphere and objects.`
    : "";

  // Audit Issue E fix: tightened to a small skeleton. The previous
  // bullet-list prompt produced 3000-token responses that timed out.
  // New shape: 1 settlement + 2 sub-locations + 3 NPCs + 1 outward
  // exit (back to origin is implicit). Skeleton format reduces drift
  // to alias names / nested wrappers (same approach as WorldBible).
  return `${wcdBlock}

Expand this region outline into a Regional Bible for a ${genre} RPG.
The player is arriving from ${originRegionName} to the ${directionFromOrigin}.
Already-existing region names (do NOT duplicate): ${existing}

Region outline (locked facts):
${JSON.stringify(outline, null, 2)}

CRITICAL ARCHITECTURAL RULE — read before generating:
The settlement node (is_settlement_node: true) MUST be a public hub
(square, crossroads, market plaza). It must NEVER be a tavern, inn,
smithy, shop, temple, or other named building. Those are sub-locations
(is_interior: true) connected to the hub via parent_location_id.

Return EXACTLY this JSON structure (fill in the values):
{
  "id": "${outline.id}",
  "name": "${outline.name}",
  "type": "${outline.type}",
  "grid_centre": ${JSON.stringify(outline.grid_centre)},
  "grid_radius": 4,
  "atmosphere": "2 sentence description (must echo: ${outline.atmosphere_hint})",
  "controlling_faction": ${outline.controlling_faction ? `"${outline.controlling_faction}"` : "null"},
  "locations": [
    {
      "id": "hub_slug",
      "name": "Hub Name (square / crossroads / plaza — NEVER a building)",
      "type": "settlement",
      "grid_position": ${JSON.stringify(outline.grid_centre)},
      "region_id": "${outline.id}",
      "is_settlement_node": true,
      "is_interior": false,
      "atmosphere": "2 sentences describing arrival impressions.",
      "connections": ["sub_one_slug", "sub_two_slug"],
      "npc_ids": [],
      "objects": [
        {"id": "obj_a_slug", "name": "Object A Name", "description": "1 sentence", "is_interactable": true},
        {"id": "obj_b_slug", "name": "Object B Name", "description": "1 sentence", "is_interactable": true}
      ],
      "ambient_type": "town_square"
    },
    {
      "id": "sub_one_slug",
      "name": "Sub-location One Name",
      "type": "tavern",
      "grid_position": {"x": ${outline.grid_centre.x}, "y": ${outline.grid_centre.y}},
      "region_id": "${outline.id}",
      "is_settlement_node": false,
      "is_interior": true,
      "parent_location_id": "hub_slug",
      "atmosphere": "2 sentences.",
      "connections": ["hub_slug"],
      "npc_ids": ["character_one_slug"],
      "objects": [
        {"id": "obj_c_slug", "name": "Object C Name", "description": "1 sentence", "is_interactable": true},
        {"id": "obj_d_slug", "name": "Object D Name", "description": "1 sentence", "is_interactable": true}
      ],
      "ambient_type": "tavern_common_room"
    },
    {
      "id": "sub_two_slug",
      "name": "Sub-location Two Name",
      "type": "market",
      "grid_position": {"x": ${outline.grid_centre.x}, "y": ${outline.grid_centre.y}},
      "region_id": "${outline.id}",
      "is_settlement_node": false,
      "is_interior": true,
      "parent_location_id": "hub_slug",
      "atmosphere": "2 sentences.",
      "connections": ["hub_slug"],
      "npc_ids": ["character_two_slug", "character_three_slug"],
      "objects": [
        {"id": "obj_e_slug", "name": "Object E Name", "description": "1 sentence", "is_interactable": true},
        {"id": "obj_f_slug", "name": "Object F Name", "description": "1 sentence", "is_interactable": true}
      ],
      "ambient_type": "market_stall"
    }
  ],
  "npcs": [
    {
      "id": "character_one_slug",
      "name": "Full Name",
      "home_location_id": "sub_one_slug",
      "role": "innkeeper",
      "archetype": "1-2 word archetype",
      "appearance": "1 sentence",
      "personality": "1 sentence (2-3 traits)",
      "speech_style": "brief",
      "knowledge": ["fact 1", "fact 2"],
      "default_trust": 50
    },
    {
      "id": "character_two_slug",
      "name": "Full Name",
      "home_location_id": "sub_two_slug",
      "role": "merchant",
      "archetype": "1-2 word archetype",
      "appearance": "1 sentence",
      "personality": "1 sentence",
      "speech_style": "brief",
      "knowledge": ["fact 1"],
      "default_trust": 50
    },
    {
      "id": "character_three_slug",
      "name": "Full Name",
      "home_location_id": "sub_two_slug",
      "role": "patron",
      "archetype": "1-2 word archetype",
      "appearance": "1 sentence",
      "personality": "1 sentence",
      "speech_style": "brief",
      "knowledge": ["fact 1"],
      "default_trust": 50
    }
  ],
  "exits": [
    {
      "direction": "${opposite}",
      "target_region_id": "${outline.id === originRegionName.toLowerCase().replace(/[^a-z0-9]+/g, "_") ? outline.id : originRegionName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}",
      "from_location_id": "hub_slug",
      "description": "1 sentence describing the path back to ${originRegionName}."
    },
    {
      "direction": "outward",
      "target_region_id": "outward_region_slug",
      "from_location_id": "hub_slug",
      "description": "1 sentence hinting at undiscovered territory."
    }
  ]
}

Constraints:
- Settlement node MUST be a hub (square/crossroads), never a building.
- 1 settlement node + 2 sub-locations (no more, no less).
- 3 NPCs total. Real names. No placeholders. ${factionLine}
- 2 Tier 1 objects per location with specific evocative names.
- ${landmarkLine}
- All connections bidirectional. NPC knowledge must be WCD-consistent.
- No breadcrumbs in this layer — those live in the WorldBible.

Respond with valid JSON matching the structure above. No markdown.`;
}

function stripJsonFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

function validateBible(parsed: unknown): { ok: true; bible: RegionBible } | { ok: false; error: string } {
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "RegionBible is not an object" };
  }
  const o = parsed as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) return { ok: false, error: "id missing" };
  if (typeof o.name !== "string" || !o.name.trim()) return { ok: false, error: "name missing" };
  if (!Array.isArray(o.locations) || o.locations.length < 2) {
    return {
      ok: false,
      error: `locations must have at least 2 entries (got ${Array.isArray(o.locations) ? o.locations.length : "non-array"})`,
    };
  }
  if (!Array.isArray(o.npcs) || o.npcs.length < 1) {
    return {
      ok: false,
      error: `npcs must have at least 1 entry (got ${Array.isArray(o.npcs) ? o.npcs.length : "non-array"})`,
    };
  }

  const hasSettlementNode = (o.locations as Array<Record<string, unknown>>).some(
    (l) => l && l.is_settlement_node === true
  );
  if (!hasSettlementNode) {
    return { ok: false, error: "RegionBible has no settlement_node in locations" };
  }

  return { ok: true, bible: parsed as RegionBible };
}

async function callClaude(client: Anthropic, userPrompt: string): Promise<string> {
  // Audit Issue E fix: max_tokens reduced from 3000 → 2000 to keep
  // the wall time within the function budget. Pair with the smaller
  // skeleton prompt above which targets ~1500-1800 tokens of output.
  const message = await client.messages.create({
    model:      "claude-sonnet-4-5",
    max_tokens: 2000,
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

  const {
    session_id,
    outline,
    origin_region_name,
    direction_from_origin,
    genre,
    wcd,
    existing_region_names,
  } = body;

  if (!session_id || !outline || !origin_region_name || !direction_from_origin || !genre || !wcd) {
    return NextResponse.json(
      { error: "Missing required fields: session_id, outline, origin_region_name, direction_from_origin, genre, wcd" },
      { status: 400 }
    );
  }
  if (!Object.values(Genre).includes(genre)) {
    return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
  }

  const existing = Array.isArray(existing_region_names) ? existing_region_names : [];
  const userPrompt = buildUserPrompt(genre, outline, origin_region_name, direction_from_origin, wcd, existing);

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
          { error: "Failed to parse RegionBible JSON after retry", first: parseError, retry: retryParseErr },
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
      { error: `RegionBible validation failed: ${validated.error}` },
      { status: 400 }
    );
  }

  const bible = validated.bible;

  console.log(
    `[RegionBible] Generated: ${bible.name}, ` +
    `${bible.locations.length} locations, ` +
    `${bible.npcs.length} NPCs.`
  );
  return NextResponse.json({ bible });
}
