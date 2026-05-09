import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Genre } from "@/types/game";
import type {
  RegionBible,
  RegionExit,
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
  void existingNames;
  void genre;

  // Audit Issue E follow-up: shrunk to the bare minimum that still
  // produces a playable region. Day 20 expansion: the geographic
  // region also gets ONE standalone region_location (a dungeon /
  // wilderness point) alongside the settlement.
  const originRegionId = originRegionName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const subSlug        = `${outline.id}_inn`;
  const regionLocSlug  = `${outline.id}_point`;
  const npc1Slug       = `${outline.id}_npc1`;
  const npc2Slug       = `${outline.id}_npc2`;
  const npc3Slug       = `${outline.id}_npc3`;
  const obj1Slug       = `${outline.id}_obj1`;
  const obj2Slug       = `${outline.id}_obj2`;
  const obj3Slug       = `${outline.id}_obj3`;
  const obj4Slug       = `${outline.id}_obj4`;
  const obj5Slug       = `${outline.id}_obj5`;
  const obj6Slug       = `${outline.id}_obj6`;

  return `${wcdBlock}

Expand this region outline into a RegionBible JSON.
Region: ${JSON.stringify(outline)}
Arriving from: ${originRegionName} to the ${directionFromOrigin}

CONTENT REQUIREMENT — EVERY LOCATION MUST HAVE PURPOSE:
Every location in this region must give the player a reason
to visit. Requirements:
- Settlement sub-location: must have 1-2 NPCs and 2 Tier 1 objects
- Standalone region location (dungeon/wilderness): must have
  AT LEAST 1 NPC and 2 Tier 1 interactable objects
- An empty location with no NPCs and no objects is NOT acceptable
- Objects must be genuinely interesting (not just 'a rock' or
  'some dirt') — give them lore relevance or mystery
- The NPC at a standalone location should have a reason for
  being there (explorer, guard, cultist, hermit, etc.)

Return EXACTLY this structure (fill with creative content
consistent with the WCD):
{
  "id": "${outline.id}",
  "name": "${outline.name}",
  "type": "${outline.type}",
  "grid_centre": ${JSON.stringify(outline.grid_centre)},
  "grid_radius": 3,
  "atmosphere": "[2 sentences, consistent with WCD]",
  "controlling_faction": ${outline.controlling_faction ? `"${outline.controlling_faction}"` : "null"},
  "locations": [
    {
      "id": "${outline.id}",
      "name": "[Hub Name — a public gathering space, NOT a building]",
      "type": "settlement",
      "is_settlement_node": true,
      "is_interior": false,
      "atmosphere": "[2 sentences]",
      "grid_position": ${JSON.stringify(outline.grid_centre)},
      "connections": ["${subSlug}"],
      "npc_ids": [],
      "objects": [
        {
          "id": "${obj1Slug}",
          "name": "[Exact Object Name with lore weight]",
          "description": "[1 sentence — hint at history or mystery]",
          "is_interactable": true
        },
        {
          "id": "${obj2Slug}",
          "name": "[Exact Object Name with lore weight]",
          "description": "[1 sentence — hint at history or mystery]",
          "is_interactable": true
        }
      ],
      "ambient_type": "town_square"
    },
    {
      "id": "${subSlug}",
      "name": "[Sub-location Name]",
      "type": "tavern",
      "is_settlement_node": false,
      "is_interior": true,
      "parent_location_id": "${outline.id}",
      "atmosphere": "[2 sentences]",
      "grid_position": {"x": ${outline.grid_centre.x - 1}, "y": ${outline.grid_centre.y}},
      "connections": ["${outline.id}"],
      "npc_ids": ["character_${npc1Slug}", "character_${npc2Slug}"],
      "objects": [
        {
          "id": "${obj3Slug}",
          "name": "[Exact Object Name with lore weight]",
          "description": "[1 sentence — hint at history or mystery]",
          "is_interactable": true
        },
        {
          "id": "${obj4Slug}",
          "name": "[Exact Object Name with lore weight]",
          "description": "[1 sentence — hint at history or mystery]",
          "is_interactable": true
        }
      ],
      "ambient_type": "tavern_common_room"
    }
  ],
  "npcs": [
    {
      "id": "character_${npc1Slug}",
      "name": "[Full Real Name]",
      "home_location_id": "${subSlug}",
      "role": "innkeeper",
      "appearance": "[1 sentence]",
      "personality": "[1 sentence]",
      "speech_style": "[3 words]",
      "knowledge": [{"topic": "[3-5 word label]", "content": "[Full WCD-consistent sentence]"}],
      "default_trust": 50
    },
    {
      "id": "character_${npc2Slug}",
      "name": "[Full Real Name]",
      "home_location_id": "${subSlug}",
      "role": "patron",
      "appearance": "[1 sentence]",
      "personality": "[1 sentence]",
      "speech_style": "[3 words]",
      "knowledge": [{"topic": "[3-5 word label]", "content": "[Full WCD-consistent sentence]"}],
      "default_trust": 50
    },
    {
      "id": "character_${npc3Slug}",
      "name": "[Full Real Name]",
      "home_location_id": "${regionLocSlug}",
      "role": "explorer",
      "appearance": "[1 sentence]",
      "personality": "[1 sentence — give them a reason to be at this remote spot]",
      "speech_style": "[3 words]",
      "knowledge": ["[WCD-consistent fact specific to this site]"],
      "default_trust": 50
    }
  ],
  "region_locations": [
    {
      "id": "${regionLocSlug}",
      "name": "[Standalone landmark name — dungeon / wilderness / shrine]",
      "type": "dungeon",
      "is_settlement_node": false,
      "is_interior": false,
      "atmosphere": "[1 sentence]",
      "grid_position": {"x": ${outline.grid_centre.x + 1}, "y": ${outline.grid_centre.y}},
      "connections": ["${outline.id}"],
      "npc_ids": ["character_${npc3Slug}"],
      "objects": [
        {
          "id": "${obj5Slug}",
          "name": "[Exact Object Name with lore weight]",
          "description": "[1 sentence — hint at history or mystery]",
          "is_interactable": true
        },
        {
          "id": "${obj6Slug}",
          "name": "[Exact Object Name with lore weight]",
          "description": "[1 sentence — hint at history or mystery]",
          "is_interactable": true
        }
      ],
      "ambient_type": "dungeon_corridor",
      "encounter_chance": 0.6,
      "encounter_roster": ["fantasy_skeleton", "${outline.id}_themed_enemy_id"],
      "is_boss_room": false
    }
  ],
  "exits": [
    {
      "direction": "${opposite}",
      "target_region_id": "${originRegionId}",
      "from_location_id": "${outline.id}",
      "description": "[1 sentence]"
    }
  ],
  "enemies": [
    {
      "id": "${outline.id}_themed_enemy_id",
      "name": "[Themed Enemy Name]",
      "description": "[1 sentence of WCD-consistent flavor for narration]",
      "hp_range": [12, 18],
      "agi_mod": 1,
      "str_mod": 2,
      "damage_die": "1d8",
      "armor_bonus": 1,
      "xp_value": 60,
      "loot_table_id": "${outline.id}_themed_enemy_id_loot",
      "is_boss": false,
      "behavior_flavor": "[1-3 word phrase]"
    }
  ]
}

Make everything original and consistent with the WCD.
Real names for all NPCs. No placeholders.
The region_locations entry is a STANDALONE point in the geographic
area (dungeon / wilderness / shrine) — NOT inside the settlement.
It connects directly to the settlement hub. It MUST have an NPC
with a believable reason to be there, plus 2 evocative Tier 1
objects.

NPC KNOWLEDGE FORMAT (Architecture C): every NPC's "knowledge"
array must be objects of shape {topic, content}. The topic is a
3-5 word button label the player sees ("The cult below",
"Roads east"); content is the full WCD-consistent sentence the
NPC reveals on a passed stat check. Generate 1-2 entries per NPC.
Do NOT emit plain strings — always {topic, content}.

DAY 20 COMBAT — REGION ENEMIES & ENCOUNTER TAGGING:

The "enemies" array must contain 3-5 region-themed enemies that
thematically fit the WCD flavor and the region's atmosphere.
Constraints:
- 3-5 entries with UNIQUE ids prefixed with the region id
  (e.g. "${outline.id}_husk_warden")
- description: 1 sentence of WCD-consistent flavor for narration
- hp_range: [min, max] — common 8-25, elite 25-50, boss 50-100
- agi_mod and str_mod: integers between -2 and +4
- armor_bonus: integer between 0 and 3
- damage_die: one of "1d4", "1d6", "1d8", "1d10", "2d4", "2d6", "2d8"
- xp_value: integer between 25 and 1000 scaled to difficulty
- behavior_flavor: 1-3 word phrase
- is_boss: false unless this enemy IS a region-tied boss
- loot_table_id: stub of form "<enemy_id>_loot"

ENCOUNTER TAGGING for combat-eligible region_locations:
The standalone region_location IS combat-eligible. It MUST carry:
- encounter_chance: 0.4-0.7 for normal areas, 1.0 for boss rooms,
  0.0 for peaceful sites
- encounter_roster: 2-4 enemy ids drawn from this region's enemies
  array AND/OR the genre bestiary (e.g. "fantasy_skeleton",
  "fantasy_cultist"). Mix region-specific and bestiary entries.
- is_boss_room: true only for the climactic location of a boss

The settlement hub and tavern sub-location are NOT combat-eligible
— omit encounter_chance/encounter_roster on those (or set chance
to 0).

CRITICAL: Keep total response under 5500 tokens. Be concise.
Atmosphere: max 2 sentences. NPC fields: 1 sentence each.
Object descriptions: 1 short sentence. Enemy descriptions: 1
sentence. Do not elaborate beyond the template lengths shown
above.`;
}

/**
 * FIX 5 — minimal stub RegionBible returned when both Haiku attempts
 * produce unparseable JSON. The stub passes validateBible (2 locations,
 * 1 NPC, a settlement node) and includes a back-stitch exit so
 * apply-regional-bible can wire the nav bar return card. The player
 * can still enter the region; content is sparse but the game doesn't
 * hard-wall on a 500.
 */
function buildStubBible(
  outline:             RegionOutline,
  originRegionId:      string,
  originRegionName:    string,
  directionFromOrigin: string,
): RegionBible {
  const hubId  = outline.id;
  const subId  = `${outline.id}_inn`;
  const npcId  = `character_${outline.id}_npc1`;
  const opposite = OPPOSITE[directionFromOrigin.toLowerCase()] ?? "south";
  return {
    id:          outline.id,
    name:        outline.name,
    type:        outline.type,
    grid_centre: outline.grid_centre,
    grid_radius: 3,
    atmosphere:  outline.atmosphere_hint,
    locations: [
      {
        id:                 hubId,
        name:               `${outline.name} Approach`,
        type:               "settlement",
        grid_position:      outline.grid_centre,
        region_id:          outline.id,
        is_settlement_node: true,
        is_interior:        false,
        atmosphere:         outline.atmosphere_hint,
        connections:        [subId],
        npc_ids:            [],
        objects:            [],
        ambient_type:       "town_square",
      },
      {
        id:                 subId,
        name:               "Traveler's Rest",
        type:               "tavern",
        grid_position:      { x: outline.grid_centre.x - 1, y: outline.grid_centre.y },
        region_id:          outline.id,
        is_settlement_node: false,
        is_interior:        true,
        parent_location_id: hubId,
        atmosphere:         "A sparse waystation offering shelter to weary travelers.",
        connections:        [hubId],
        npc_ids:            [npcId],
        objects:            [],
        ambient_type:       "tavern_common_room",
      },
    ],
    npcs: [
      {
        id:               npcId,
        name:             "A Traveling Merchant",
        home_location_id: subId,
        role:             "traveler",
        archetype:        "wanderer",
        appearance:       "A road-worn figure with little to say.",
        personality:      "Guarded and brief.",
        speech_style:     "terse",
        knowledge: [
          { topic: "The road ahead", content: `The path from ${originRegionName} winds on through uncertain country.` },
        ],
        default_trust:    30,
      },
    ],
    region_locations: [],
    exits: [
      {
        direction:        opposite as RegionExit["direction"],
        target_region_id: originRegionId,
        from_location_id: hubId,
        description:      `The track leads back toward ${originRegionName}.`,
      },
    ],
    // Day 20 Combat — stub bible has no enemies. Encounter triggers
    // at combat-eligible nodes will fall through to the genre
    // bestiary. The region simply has no themed roster until it's
    // re-generated.
    enemies: [],
  };
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
  // Architecture spec ("Model Selection"): RegionBible generation runs on
  // haiku because the outline already locks the region's identity. Quality
  // from a simpler prompt is acceptable; speed matters more here than for
  // WCD/WorldBible/narration.
  //
  // Day 20 — bumped 6000 → 7000 to give the haiku headroom for the
  // 3-5 enemy entries added at combat-spec §6.5. The stub fallback in
  // the POST handler still catches any remaining truncation.
  console.log("[RegionBible] Using haiku model");
  const message = await client.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 7000,
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
        // FIX 5 — surface parse errors in logs for diagnostics, then
        // return a minimal stub RegionBible (200) instead of 500. The
        // player can still enter the region; content is sparse but the
        // game doesn't hard-wall. A warning tag lets us grep for stub
        // incidents to investigate the truncation root cause later.
        console.error("[RegionBible] JSON parse failed after retry.", {
          first:        parseError,
          retry:        retryParseErr,
          regionId:     outline?.id,
          regionName:   outline?.name,
        });
        const originRegionId = (origin_region_name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
        const stubBible = buildStubBible(
          outline!,
          originRegionId,
          origin_region_name ?? "the origin region",
          direction_from_origin ?? "south"
        );
        console.warn(
          `[RegionBible] Returning stub fallback for ${outline?.name} (${outline?.id}). ` +
          "Full content will be unavailable until the region is re-generated."
        );
        return NextResponse.json({ bible: stubBible, stub: true });
      }
    }
  } catch (err) {
    // FIX 1 — same diagnostic for an Anthropic-level failure (network,
    // rate limit, etc.) so server logs show the actual exception instead
    // of just the swallowed message.
    console.error("[RegionBible] Anthropic call failed:", err);
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
