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
  const wcdBlock    = formatWcdBlock(wcd);
  const generatedAt = new Date().toISOString();
  // Skeleton-based prompt: showing the model the exact JSON shape (with
  // every required key) is the single most reliable way to keep it from
  // wandering into alias names / nested wrappers / missing fields.
  return `${wcdBlock}

Generate a WorldBible JSON for a ${genre} RPG.
Character: ${name}, a ${klass}.

Return EXACTLY this JSON structure (fill in the values):
{
  "starting_region": {
    "id": "settlement_slug",
    "name": "Settlement Name",
    "type": "settlement_hub",
    "atmosphere": "2 sentence description",
    "locations": [
      {
        "id": "location_slug",
        "name": "Location Name",
        "type": "tavern",
        "is_settlement_node": true,
        "is_interior": false,
        "atmosphere": "description",
        "grid_position": {"x": 0, "y": 0},
        "connections": ["other_location_id"],
        "npc_ids": ["character_slug"],
        "objects": [{"id": "obj_slug", "name": "Object Name", "description": "1 sentence", "is_interactable": true}],
        "ambient_type": "town_square"
      }
    ],
    "npcs": [
      {
        "id": "character_slug",
        "name": "Full Name",
        "home_location_id": "location_slug",
        "role": "innkeeper",
        "appearance": "1 sentence",
        "personality": "1 sentence",
        "speech_style": "brief",
        "knowledge": ["fact 1"],
        "default_trust": 50
      }
    ],
    "exits": []
  },
  "adjacent_regions": [
    {
      "id": "region_slug",
      "name": "Region Name",
      "type": "wilderness",
      "grid_centre": {"x": 5, "y": 0},
      "direction_from_start": "north",
      "distance": "adjacent",
      "atmosphere_hint": "1 sentence",
      "key_npc_count": 2,
      "location_count": 3
    }
  ],
  "main_quest": {
    "title": "Quest Title",
    "antagonist_name": "Name",
    "antagonist_location": "location_id",
    "goal": "1 sentence",
    "opening_hook": "1 sentence",
    "breadcrumbs": [
      {"index": 0, "content": "hint", "delivery_method": "npc_dialogue", "suggested_location": "location_id"},
      {"index": 1, "content": "hint", "delivery_method": "environmental", "suggested_location": "location_id"},
      {"index": 2, "content": "hint", "delivery_method": "discovered_object", "suggested_location": "location_id"}
    ],
    "win_condition": "1 sentence"
  },
  "generated_at": "${generatedAt}"
}

Generate 1 settlement node + 3 sub-locations + 4-5 NPCs.
Make content original, specific to the WCD and genre.
REAL NAMES for all NPCs. No placeholders.`;
}

function stripJsonFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

// ── Normalization helpers ────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/**
 * Pull the first array-shaped value found at one of the alternate keys.
 * Used by normalizeWorldBible so that AI variants (sub_locations, places,
 * characters, residents…) all collapse to the canonical field name without
 * losing the data.
 */
function pickArray(o: Record<string, unknown>, keys: string[]): unknown[] | null {
  for (const k of keys) {
    const v = o[k];
    if (Array.isArray(v)) return v;
  }
  return null;
}

/**
 * Pre-validation pass that maps common AI field-name variants to the
 * canonical schema and fills missing mechanical fields with safe defaults.
 * Creative content (names, descriptions) is preserved verbatim — we only
 * default fields the AI tends to skip when racing to fit the token budget.
 */
function normalizeWorldBible(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const o = parsed as Record<string, unknown>;

  // ── Root-level restructure ────────────────────────────────────────────────
  // Some AI responses skip the starting_region wrapper entirely and emit
  // locations / npcs / exits at the top level. Detect that and wrap them
  // up so the downstream normalization sees a canonical shape.
  if (!o.starting_region || typeof o.starting_region !== "object") {
    const rootLocations = pickArray(o, [
      "locations", "sub_locations", "sublocation", "sublocations",
      "areas", "places", "nodes", "buildings", "sites",
    ]);
    const rootNpcs = pickArray(o, [
      "npcs", "characters", "people", "inhabitants", "npc_list",
    ]);

    const pickString = (keys: string[]): string | null => {
      for (const k of keys) {
        const v = o[k];
        if (typeof v === "string" && v.trim()) return v;
      }
      return null;
    };

    if ((rootLocations?.length ?? 0) > 0 || (rootNpcs?.length ?? 0) > 0) {
      o.starting_region = {
        id:         pickString(["id", "region_id", "settlement_id"]) ?? "starting_region",
        name:       pickString(["name", "region_name", "settlement_name"]) ?? "Starting Settlement",
        type:       pickString(["type", "region_type"]) ?? "settlement_hub",
        atmosphere: pickString(["atmosphere", "description", "setting"]) ?? "",
        locations:  rootLocations ?? [],
        npcs:       rootNpcs ?? [],
        exits:      pickArray(o, ["exits", "connections", "routes"]) ?? [],
      };
      console.log("[WorldBible] Restructured flat response into starting_region");
    }

    // If still no starting_region, scan for region data nested under a
    // different key (region / settlement / world / area / hub / etc.).
    if (!o.starting_region || typeof o.starting_region !== "object") {
      for (const key of [
        "region", "settlement", "world", "area", "hub",
        "starting_area", "start", "beginning",
      ]) {
        const candidateRaw = o[key];
        if (
          candidateRaw &&
          typeof candidateRaw === "object" &&
          !Array.isArray(candidateRaw)
        ) {
          const candidate = candidateRaw as Record<string, unknown>;
          const candLocations = pickArray(candidate, [
            "locations", "sub_locations", "sublocation", "areas", "places",
          ]);
          if ((candLocations?.length ?? 0) > 0) {
            o.starting_region = { ...candidate };
            console.log(`[WorldBible] Found starting_region under key: ${key}`);
            break;
          }
        }
      }
    }
  }

  // ── starting_region ───────────────────────────────────────────────────────
  const sr = o.starting_region;
  if (sr && typeof sr === "object") {
    const region = sr as Record<string, unknown>;

    // locations: accept several alternate keys
    if (!Array.isArray(region.locations)) {
      const alt = pickArray(region, [
        "sub_locations", "sublocation", "sublocations",
        "areas", "places", "nodes", "buildings", "sites",
      ]);
      region.locations = alt ?? [];
    }

    // npcs: accept several alternate keys
    if (!Array.isArray(region.npcs)) {
      const alt = pickArray(region, [
        "characters", "people", "inhabitants", "residents", "npc_list",
      ]);
      region.npcs = alt ?? [];
    }

    // exits: accept connections fallback
    if (!Array.isArray(region.exits)) {
      const alt = pickArray(region, ["exits", "connections"]);
      region.exits = alt ?? [];
    }

    // id / type / atmosphere defaults
    if (typeof region.name !== "string" || !(region.name as string).trim()) {
      region.name = "Starting Region";
    }
    if (!region.id || typeof region.id !== "string" || !(region.id as string).trim()) {
      region.id = slugify(region.name as string);
    }
    if (!region.type || typeof region.type !== "string" || !(region.type as string).trim()) {
      region.type = "settlement_hub";
    }
    if (typeof region.atmosphere !== "string") {
      region.atmosphere = "";
    }

    // Normalize each location
    if (Array.isArray(region.locations)) {
      region.locations = (region.locations as unknown[]).map((loc, idx) => {
        if (!loc || typeof loc !== "object") return loc;
        const l = { ...(loc as Record<string, unknown>) };

        if (!l.name || typeof l.name !== "string" || !(l.name as string).trim()) {
          l.name = `Unnamed Location ${idx + 1}`;
        }
        if (!l.id || typeof l.id !== "string" || !(l.id as string).trim()) {
          l.id = slugify(l.name as string);
        }
        if (!Array.isArray(l.connections)) l.connections = [];
        if (!Array.isArray(l.npc_ids))     l.npc_ids     = [];
        if (!Array.isArray(l.objects))     l.objects     = [];
        if (typeof l.is_settlement_node !== "boolean") l.is_settlement_node = false;
        if (typeof l.is_interior         !== "boolean") l.is_interior         = true;
        return l;
      });
    }

    // Normalize each NPC and capture the first location id for fallback home
    const firstLocId = (() => {
      const locs = region.locations;
      if (!Array.isArray(locs) || locs.length === 0) return "";
      const first = locs[0] as Record<string, unknown> | undefined;
      return typeof first?.id === "string" ? (first.id as string) : "";
    })();

    if (Array.isArray(region.npcs)) {
      region.npcs = (region.npcs as unknown[]).map((npc, idx) => {
        if (!npc || typeof npc !== "object") return npc;
        const n = { ...(npc as Record<string, unknown>) };

        if (!n.name || typeof n.name !== "string" || !(n.name as string).trim()) {
          n.name = `Unnamed Character ${idx + 1}`;
        }
        if (!n.id || typeof n.id !== "string" || !(n.id as string).trim()) {
          n.id = `character_${slugify(n.name as string)}`;
        }
        if (!Array.isArray(n.knowledge)) n.knowledge = [];
        if (typeof n.default_trust !== "number") n.default_trust = 50;
        if (!n.home_location_id || typeof n.home_location_id !== "string") {
          n.home_location_id = firstLocId;
        }
        return n;
      });
    }
  } else {
    // No starting_region at all — seed an empty shell so validateBible
    // produces a clear "starting_region.name missing" rather than the
    // generic "starting_region missing".
    o.starting_region = {
      id:        "starting_region",
      name:      "Starting Region",
      type:      "settlement_hub",
      atmosphere: "",
      locations: [],
      npcs:      [],
      exits:     [],
    };
  }

  // ── adjacent_regions ──────────────────────────────────────────────────────
  // Same alias treatment as starting_region — AI sometimes emits these
  // under "regions", "nearby_regions", etc. Promote the first match.
  if (!o.adjacent_regions || !Array.isArray(o.adjacent_regions)) {
    const rootRegions = pickArray(o, [
      "adjacent_regions", "regions", "nearby_regions", "other_regions",
      "surrounding_regions", "connected_regions", "region_outlines",
    ]);
    if (rootRegions && rootRegions.length > 0) {
      o.adjacent_regions = rootRegions;
    }
  }
  if (!Array.isArray(o.adjacent_regions)) {
    o.adjacent_regions = [];
  }
  o.adjacent_regions = (o.adjacent_regions as unknown[]).map((r, idx) => {
    if (!r || typeof r !== "object") return r;
    const region = { ...(r as Record<string, unknown>) };
    if (!region.name || typeof region.name !== "string" || !(region.name as string).trim()) {
      region.name = `Adjacent Region ${idx + 1}`;
    }
    if (!region.id || typeof region.id !== "string" || !(region.id as string).trim()) {
      region.id = slugify(region.name as string);
    }
    if (typeof region.key_npc_count !== "number") region.key_npc_count = 2;
    if (typeof region.location_count !== "number") region.location_count = 3;
    return region;
  });

  // ── main_quest ────────────────────────────────────────────────────────────
  // First try to promote from common alias keys (quest / story / plot / …)
  // before falling through to the placeholder default.
  if (!o.main_quest || typeof o.main_quest !== "object") {
    for (const key of [
      "main_quest", "quest", "story", "plot",
      "narrative", "main_story", "campaign",
    ]) {
      const candidate = o[key];
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
        o.main_quest = candidate;
        break;
      }
    }
  }

  const placeholderBreadcrumb = {
    index:              0,
    content:            "A strange rumour circulates",
    delivery_method:    "npc_dialogue",
    suggested_location: "",
  };

  if (!o.main_quest || typeof o.main_quest !== "object") {
    o.main_quest = {
      title:               "The Unknown Threat",
      antagonist_name:     "Unknown",
      antagonist_location: "",
      goal:                "Discover the truth",
      opening_hook:        "Something stirs in the shadows",
      breadcrumbs:         [placeholderBreadcrumb],
      win_condition:       "Defeat the antagonist",
    };
  } else {
    const mq = o.main_quest as Record<string, unknown>;
    if (!Array.isArray(mq.breadcrumbs) || mq.breadcrumbs.length === 0) {
      mq.breadcrumbs = [placeholderBreadcrumb];
    }
  }

  return o;
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

  // Debug: log the raw parsed schema shape so future AI variations are
  // easier to diagnose without firing the prompt again. Includes a peek
  // at root-level array fields so we catch flat-response variants too.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.log("[WorldBible] Raw structure:", JSON.stringify({
    topLevelKeys:        Object.keys(parsed as object),
    startingRegionType:  typeof (parsed as any)?.starting_region,
    startingRegionKeys:  Object.keys((parsed as any)?.starting_region ?? {}),
    hasLocationsAtRoot:  Array.isArray((parsed as any)?.locations),
    hasNpcsAtRoot:       Array.isArray((parsed as any)?.npcs),
    rootLocationsCount:  Array.isArray((parsed as any)?.locations) ? (parsed as any).locations.length : 0,
  }));

  // Normalize before validation — maps AI field-name variants to the
  // canonical schema and fills missing mechanical fields with defaults.
  const normalized = normalizeWorldBible(parsed);
  const validated = validateBible(normalized);
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
