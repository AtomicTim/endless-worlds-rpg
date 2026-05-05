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
  const locCount = Math.max(2, outline.location_count);
  const npcCount = Math.max(1, outline.key_npc_count);

  return [
    wcdBlock,
    "",
    `Expand this region outline into a full Regional Bible for a ${genre} RPG.`,
    "",
    "Region outline:",
    JSON.stringify(outline, null, 2),
    "",
    `The player is arriving from ${originRegionName} to the ${directionFromOrigin}.`,
    "",
    `Already-existing region names (do not duplicate): ${existing}`,
    "",
    "Requirements:",
    "",
    `LOCATIONS — generate ${locCount} notable locations:`,
    "- 1 must be a settlement node (is_settlement_node: true, is_interior: false) that serves as the arrival point",
    "- Remaining locations are notable sub-locations (is_interior: true, parent_location_id pointing to the settlement node)",
    `- Each location: id (normalized slug), name (permanent), type, grid_position (cluster within outline.grid_centre +/- 2 cells), is_settlement_node, is_interior, parent_location_id (if interior), atmosphere (2-3 sentences), connections (bidirectional — sub-locations connect back to the settlement node), npc_ids, objects (3-5 Tier 1 objects with id, name, description, is_interactable: true), ambient_type (e.g. tavern_common_room, smithy, market_stall, town_square, wilderness_path, dungeon_corridor, dungeon_chamber, station_hub, ship_bridge, manor_entrance, etc.)`,
    "- If outline.landmark_id is set, that landmark must be prominently featured in one location's atmosphere and objects",
    `- Connect back to the origin region (${originRegionName}) via an exit from the settlement node in the ${opposite} direction`,
    "",
    `NPCS — generate ${npcCount} NPCs:`,
    "- Every NPC has a REAL NAME — no placeholders ever",
    "- Each NPC: id (character_[slug]), name, home_location_id, role, archetype, appearance (1-2 sentences), personality (descriptive sentence with 2-3 traits), speech_style, faction_id (optional, must match a WCD faction if set), knowledge (3-5 WCD-consistent facts), default_trust (40-60 for strangers)",
    outline.controlling_faction
      ? `- Region is controlled by faction "${outline.controlling_faction}" — at least 1 NPC must be affiliated with that faction.`
      : "- Faction affiliations only when consistent with the WCD.",
    "",
    `EXITS — include at least 1 exit back to ${originRegionName} (${opposite}) and 1-2 exits to further undiscovered territory.`,
    "",
    "Rules:",
    "- REAL NAMES only — no placeholders",
    "- Every name is permanent",
    `- Atmosphere must be consistent with the WCD and the outline's atmosphere_hint: "${outline.atmosphere_hint}"`,
    "- NPC knowledge must be WCD-consistent",
    "- All location connections must be bidirectional",
    "- Object names must be specific and evocative, not generic (not just 'shelf' or 'table')",
    "",
    "Respond with valid JSON matching the RegionBible schema exactly.",
  ].join("\n");
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
  const message = await client.messages.create({
    model:      "claude-sonnet-4-5",
    max_tokens: 3000,
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
