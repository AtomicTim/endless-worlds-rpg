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

CRITICAL ARCHITECTURAL RULE — read before generating:
The settlement node (is_settlement_node: true) MUST be a public
gathering space — a town square, crossroads, market plaza, central
courtyard, hub, or equivalent. It must NEVER be a specific building
such as a tavern, inn, smithy, shop, temple, or guild hall. Those
are sub-locations (is_interior: true) connected to the settlement
node. The settlement node is an exterior arrival point that the
player can leave by entering any of its sub-locations.

GEOGRAPHIC vs SETTLEMENT NAMING (Day 20):
The region 'name' MUST be a geographic area name (landscape,
district, territory) — NOT a town or building name.
The 'settlement_name' is the name of the town within that area.
Example: region name "The Ashwood Forest", settlement name
"Thornwick Crossing". NOT: region name "Thornwick Crossing".
Other valid region names: "The Salt Plains", "Rust Peaks
Foothills", "Neon Quarter", "The Bone-Drift Steppe".
Other valid settlement names: "Salt-Iron Crossing",
"Waystation Seven", "The Refuge", "Hollow Mark".

REGION LOCATIONS (Day 20):
The geographic region also contains ONE standalone location
alongside the settlement — a dungeon entrance, wilderness point,
ancient shrine, or abandoned structure. It is NOT inside the
settlement (is_interior: false, no parent_location_id). It has its
own atmosphere, 0-1 NPCs, 1-2 Tier 1 objects.

COORDINATE SYSTEM — read carefully:
grid_position is in a shared world coordinate space using
integers. ONE coordinate space covers everything.
- The settlement hub is ALWAYS at {"x": 0, "y": 0}.
- Sub-locations cluster around the hub: use values in the
  range -5 to +5 on both axes. Spread them out — do NOT put
  two sub-locations at the same position.
- The standalone region_location sits 8-15 units from the hub,
  e.g. {10,-5}, {-12,4}, {7,11}.
- Adjacent regions sit 18-35 units away, e.g. {22,8}, {-25,12}.
- Every location MUST have a UNIQUE grid_position. No two
  locations may share the same x and y values.
- CRITICAL: Do NOT place sub-locations in a cardinal cross
  pattern (e.g. {-1,0}, {1,0}, {0,-1}, {0,1}). Use diagonal
  and varied offsets instead — for example: {-3,1}, {2,-2},
  {1,4}, {-4,-1}. The layout should look organic, not like
  a compass rose.

Return EXACTLY this JSON structure (fill in the values):
{
  "starting_region": {
    "id": "the_geographic_region_slug",
    "name": "The Geographic Region Name (landscape — NOT a town)",
    "settlement_id": "settlement_slug",
    "settlement_name": "Town Name",
    "type": "settlement_hub",
    "atmosphere": "2 sentence description of the geographic area",
    "locations": [
      {
        "id": "settlement_slug",
        "name": "Town Name (matches settlement_name above)",
        "type": "settlement",
        "is_settlement_node": true,
        "is_interior": false,
        "atmosphere": "Outdoor hub description — what the player sees and hears arriving at the town centre.",
        "grid_position": {"x": 0, "y": 0},
        "connections": ["tavern_slug", "shop_slug", "smithy_slug", "fourth_slug"],
        "npc_ids": [],
        "objects": [{"id": "well_slug", "name": "The Communal Well", "description": "1 sentence", "is_interactable": true}],
        "ambient_type": "town_square"
      },
      {
        "id": "tavern_slug",
        "name": "The Tavern Name",
        "type": "tavern",
        "is_settlement_node": false,
        "is_interior": true,
        "parent_location_id": "settlement_slug",
        "atmosphere": "Tavern interior description.",
        "grid_position": {"x": -2, "y": 1},
        "connections": ["settlement_slug"],
        "npc_ids": ["character_innkeeper_slug"],
        "objects": [{"id": "fireplace_slug", "name": "The Hearth", "description": "1 sentence", "is_interactable": true}],
        "ambient_type": "tavern_common_room"
      },
      {
        "id": "shop_slug",
        "name": "The Shop Name",
        "type": "market",
        "is_settlement_node": false,
        "is_interior": true,
        "parent_location_id": "settlement_slug",
        "atmosphere": "Shop interior description.",
        "grid_position": {"x": 3, "y": -1},
        "connections": ["settlement_slug"],
        "npc_ids": ["character_merchant_slug"],
        "objects": [{"id": "counter_slug", "name": "The Counter", "description": "1 sentence", "is_interactable": true}],
        "ambient_type": "market_stall"
      },
      {
        "id": "smithy_slug",
        "name": "The Smithy Name",
        "type": "smithy",
        "is_settlement_node": false,
        "is_interior": true,
        "parent_location_id": "settlement_slug",
        "atmosphere": "Smithy interior description.",
        "grid_position": {"x": -1, "y": 3},
        "connections": ["settlement_slug"],
        "npc_ids": [],
        "objects": [{"id": "anvil_slug", "name": "The Anvil", "description": "1 sentence", "is_interactable": true}],
        "ambient_type": "smithy"
      },
      {
        "id": "fourth_slug",
        "name": "The Fourth Sub-Location Name",
        "type": "shrine",
        "is_settlement_node": false,
        "is_interior": true,
        "parent_location_id": "settlement_slug",
        "atmosphere": "Fourth sub-location interior description.",
        "grid_position": {"x": 2, "y": 2},
        "connections": ["settlement_slug"],
        "npc_ids": [],
        "objects": [{"id": "altar_slug", "name": "The Altar", "description": "1 sentence", "is_interactable": true}],
        "ambient_type": "temple_shrine"
      }
    ],
    "region_locations": [
      {
        "id": "region_landmark_slug",
        "name": "The Region Landmark Name (dungeon / wilderness / shrine — NOT inside the town)",
        "type": "dungeon",
        "is_settlement_node": false,
        "is_interior": false,
        "atmosphere": "1-2 sentences describing this standalone point in the geographic area.",
        "grid_position": {"x": 10, "y": -5},
        "connections": ["settlement_slug"],
        "npc_ids": [],
        "objects": [{"id": "region_obj_slug", "name": "Tier 1 Object Name", "description": "1 sentence", "is_interactable": true}],
        "ambient_type": "dungeon_corridor"
      }
    ],
    "npcs": [
      {
        "id": "character_innkeeper_slug",
        "name": "Full Name",
        "home_location_id": "tavern_slug",
        "role": "innkeeper",
        "appearance": "1 sentence",
        "personality": "1 sentence",
        "speech_style": "brief",
        "knowledge": ["fact 1"],
        "default_trust": 50
      },
      {
        "id": "character_merchant_slug",
        "name": "Full Name",
        "home_location_id": "shop_slug",
        "role": "merchant",
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
      "grid_centre": {"x": 22, "y": 8},
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

Generate exactly:
- 1 settlement node + 4 sub-locations inside it (tavern + shop + smithy/guild + one more) + 4-5 NPCs.
- 1 standalone region_location alongside the settlement (dungeon / wilderness / shrine).

The settlement node is a town square / crossroads / hub — NEVER a
named building. Each sub-location is is_interior: true and references
the settlement node via parent_location_id. NPCs live in the
sub-locations (their home_location_id), not in the square itself.
The region_locations entry is is_interior: false with no
parent_location_id — it sits in the geographic area, NOT inside the
town. Connect it to the settlement node via connections.
'name' is the geographic region. 'settlement_name' is the town.
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

    // Object-shaped containers: AI sometimes emits keyed dictionaries
    // ({ "town_square": {...}, "inn": {...} }) instead of arrays. Flatten
    // to Object.values() and stamp the dict key as the entry id when the
    // entry doesn't carry one already.
    if (
      region.locations &&
      !Array.isArray(region.locations) &&
      typeof region.locations === "object"
    ) {
      const dict = region.locations as Record<string, unknown>;
      region.locations = Object.entries(dict).map(([k, v]) => {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          const inner = v as Record<string, unknown>;
          if (!inner.id || typeof inner.id !== "string" || !(inner.id as string).trim()) {
            return { ...inner, id: k };
          }
          return inner;
        }
        return v;
      });
      console.log("[WorldBible] Converted locations object to array");
    }

    if (
      region.npcs &&
      !Array.isArray(region.npcs) &&
      typeof region.npcs === "object"
    ) {
      const dict = region.npcs as Record<string, unknown>;
      region.npcs = Object.entries(dict).map(([k, v]) => {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          const inner = v as Record<string, unknown>;
          if (!inner.id || typeof inner.id !== "string" || !(inner.id as string).trim()) {
            return { ...inner, id: k };
          }
          return inner;
        }
        return v;
      });
      console.log("[WorldBible] Converted npcs object to array");
    }

    // exits: accept connections fallback
    if (!Array.isArray(region.exits)) {
      const alt = pickArray(region, ["exits", "connections"]);
      region.exits = alt ?? [];
    }

    // Day 20 — region_locations is the new "standalone locations in
    // the geographic region (NOT inside the settlement)" field.
    // Default to [] when absent so apply-world-bible can iterate
    // unconditionally. Accept a few aliases the model occasionally
    // emits in its place.
    if (!Array.isArray(region.region_locations)) {
      const alt = pickArray(region, [
        "region_locations", "regional_locations",
        "standalone_locations", "outdoor_locations",
        "wilderness_points", "landmarks",
      ]);
      region.region_locations = alt ?? [];
    }
    region.region_locations = (region.region_locations as unknown[]).map((loc, idx) => {
      if (!loc || typeof loc !== "object") return loc;
      const l = { ...(loc as Record<string, unknown>) };
      if (!l.name || typeof l.name !== "string" || !(l.name as string).trim()) {
        l.name = `Region Landmark ${idx + 1}`;
      }
      if (!l.id || typeof l.id !== "string" || !(l.id as string).trim()) {
        l.id = slugify(l.name as string);
      }
      if (!Array.isArray(l.connections)) l.connections = [];
      if (!Array.isArray(l.npc_ids))     l.npc_ids     = [];
      if (!Array.isArray(l.objects))     l.objects     = [];
      // Standalone region locations are NEVER settlement nodes and
      // NEVER interior — coerce in case the model got confused.
      l.is_settlement_node = false;
      l.is_interior        = false;
      return l;
    });

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
    model:      "claude-sonnet-4-5",
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
    // Debug: dump head + tail of the raw response so we can see exactly
    // what the AI emitted when normalization can't reach a valid shape.
    console.log(
      "[WorldBible] Raw response (first 2000 chars):",
      rawText.substring(0, 2000)
    );
    console.log(
      "[WorldBible] Raw response (last 500 chars):",
      rawText.substring(Math.max(0, rawText.length - 500))
    );
    try {
      parsed = JSON.parse(stripJsonFences(rawText));
    } catch (err) {
      parseError = err instanceof Error ? err.message : "JSON parse failed";
      const retryPrompt = userPrompt + "\n\nReturn ONLY the JSON object, nothing else. No markdown.";
      const retryRaw = await callClaude(anthropic, retryPrompt);
      console.log(
        "[WorldBible] Retry response (first 2000 chars):",
        retryRaw.substring(0, 2000)
      );
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

  // Capture the raw shape BEFORE normalize runs — normalizeWorldBible
  // mutates its argument in place, so we'd otherwise log post-normalize
  // values under the "Raw structure" header.
  const rawSnapshot = (() => {
    const r = (parsed ?? {}) as Record<string, unknown>;
    const sr = r.starting_region as Record<string, unknown> | undefined;
    const rootLocs = r.locations;
    return {
      topLevelKeys:        Object.keys(r),
      startingRegionType:  typeof sr,
      startingRegionKeys:  Object.keys(sr ?? {}),
      hasLocationsAtRoot:  Array.isArray(rootLocs),
      hasNpcsAtRoot:       Array.isArray(r.npcs),
      rootLocationsCount:  Array.isArray(rootLocs) ? rootLocs.length : 0,
    };
  })();
  console.log("[WorldBible] Raw structure:", JSON.stringify(rawSnapshot));

  // Normalize before validation — maps AI field-name variants to the
  // canonical schema and fills missing mechanical fields with defaults.
  const normalized       = normalizeWorldBible(parsed);
  const normalizedRecord = (normalized ?? {}) as Record<string, unknown>;
  const normalizedSr     = normalizedRecord.starting_region as Record<string, unknown> | undefined;
  const normalizedLocs   = Array.isArray(normalizedSr?.locations)
    ? (normalizedSr!.locations as unknown[])
    : null;

  // Debug: log the post-normalization shape so we can see whether the
  // various restructure paths actually landed locations / npcs in the
  // canonical place before validateBible runs.
  console.log("[WorldBible] After normalization:", JSON.stringify({
    hasStartingRegion: !!normalizedSr,
    locationsType:     typeof normalizedSr?.locations,
    locationsIsArray:  normalizedLocs !== null,
    locationsLength:   normalizedLocs !== null ? normalizedLocs.length : "N/A",
    startingRegionKeys: Object.keys(normalizedSr ?? {}),
  }));

  const validated = validateBible(normalized);
  if (!validated.ok) {
    const sr = normalizedSr;
    return NextResponse.json(
      {
        error: `WorldBible validation failed: ${validated.error}`,
        debug: {
          topLevelKeys:       Object.keys(normalizedRecord),
          startingRegionKeys: Object.keys(sr ?? {}),
          locationsType:      typeof sr?.locations,
          locationsValue:     JSON.stringify(sr?.locations)?.substring(0, 200),
        },
      },
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
