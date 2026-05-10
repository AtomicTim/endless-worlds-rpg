import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AssetCategory, LocationStatus } from "@/types/game";
import type { Json } from "@/types/database";
import type {
  Enemy,
  LocationDefinition,
  MasterState,
  NPCDefinition,
  WorldAsset,
  WorldBible,
  WorldConsistencyDocument,
  WorldGraph,
  WorldNode,
} from "@/types/game";
import { Genre } from "@/types/game";
import { getGenreBestiary } from "@/lib/game/bestiary";

/**
 * Day 19B — Apply a freshly-generated WorldBible to a session.
 *
 * Writes every location, NPC, region outline, and interactable LocationObject
 * as a permanent world_asset, builds the WorldGraph, and patches master_state
 * with the starting location, world_graph, world_consistency, and main_quest.
 *
 * Replaces apply-world-seed for new games. Old saves with a world_seed but
 * no world_bible continue to use the legacy apply-world-seed path.
 *
 * Atomic at the master_state level — assets are upserted with
 * ignoreDuplicates so partial writes are safe to re-run.
 */

interface RequestBody {
  session_id?: string;
  bible?:      WorldBible;
  wcd?:        WorldConsistencyDocument;
}

// ── Day 20 Combat — Enemy validation + encounter scrubbing ─────────────────────

const VALID_DAMAGE_DIE = /^\d+d\d+$/;

/**
 * Validate a single enemy entry against the Enemy interface shape.
 * Returns the enemy on success or null when any required field is
 * missing / malformed. Resilience pattern from V8.30: warn-don't-500
 * — the world is still playable without one enemy slot filled.
 */
function validateEnemy(raw: unknown, context: string): Enemy | null {
  if (!raw || typeof raw !== "object") {
    console.warn(`[apply-world-bible] Enemy in ${context} is not an object — dropping.`);
    return null;
  }
  const o = raw as Record<string, unknown>;
  const id   = typeof o.id   === "string" ? o.id.trim()   : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const desc = typeof o.description === "string" ? o.description.trim() : "";
  if (!id || !name || !desc) {
    console.warn(`[apply-world-bible] Enemy in ${context} missing id/name/description — dropping.`);
    return null;
  }
  const hpRange = Array.isArray(o.hp_range) ? o.hp_range : null;
  if (
    !hpRange ||
    hpRange.length !== 2 ||
    typeof hpRange[0] !== "number" || typeof hpRange[1] !== "number" ||
    hpRange[0] <= 0 || hpRange[0] > hpRange[1]
  ) {
    console.warn(`[apply-world-bible] Enemy ${id} has malformed hp_range — dropping.`);
    return null;
  }
  const damageDie = typeof o.damage_die === "string" ? o.damage_die.trim() : "";
  if (!VALID_DAMAGE_DIE.test(damageDie)) {
    console.warn(`[apply-world-bible] Enemy ${id} has invalid damage_die "${damageDie}" — dropping.`);
    return null;
  }
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return {
    id,
    name,
    description:     desc,
    hp_range:        [hpRange[0], hpRange[1]],
    agi_mod:         num(o.agi_mod,     0),
    str_mod:         num(o.str_mod,     0),
    damage_die:      damageDie,
    armor_bonus:     num(o.armor_bonus, 0),
    xp_value:        num(o.xp_value,   25),
    loot_table_id:   typeof o.loot_table_id === "string" && o.loot_table_id.trim()
                       ? o.loot_table_id.trim()
                       : `${id}_loot`,
    is_boss:         typeof o.is_boss === "boolean" ? o.is_boss : false,
    behavior_flavor: typeof o.behavior_flavor === "string"
                       ? o.behavior_flavor.trim() || "aggressive"
                       : "aggressive",
  };
}

/**
 * Run the enemy validator over an enemies array. Returns only the
 * entries that passed, never throws — keeps the apply route
 * resilient when the AI emits one malformed entry.
 */
function validateEnemies(rawList: unknown, context: string): Enemy[] {
  if (!Array.isArray(rawList)) return [];
  const out: Enemy[] = [];
  for (const raw of rawList) {
    const enemy = validateEnemy(raw, context);
    if (enemy) out.push(enemy);
  }
  return out;
}

/**
 * Strip encounter_roster ids that don't resolve to either the
 * region's enemies array OR the genre bestiary. Logs each dropped
 * id so unwired references show up in the server log instead of
 * surfacing as a missing-enemy crash at combat time.
 */
function scrubEncounterRoster(
  roster:        string[] | undefined,
  validIds:      Set<string>,
  context:       string
): string[] {
  if (!Array.isArray(roster)) return [];
  const out: string[] = [];
  for (const id of roster) {
    if (typeof id !== "string" || !id.trim()) continue;
    const trimmed = id.trim();
    if (!validIds.has(trimmed)) {
      console.warn(
        `[apply-world-bible] encounter_roster at ${context} references unknown enemy "${trimmed}" — stripping.`
      );
      continue;
    }
    out.push(trimmed);
  }
  return out;
}

// ── Helpers: convert bible entries into WorldAsset rows ────────────────────────

function locationToAsset(loc: LocationDefinition, sessionId: string): WorldAsset {
  return {
    id:                  `location_${loc.id}`,
    category:            AssetCategory.LOCATION,
    name:                loc.name,
    constitution: {
      physical_description: loc.atmosphere,
      // Tier 1 object names — narrator reads this so it can describe the
      // place's prominent features without inventing new ones.
      key_landmarks:        loc.objects.map((o) => o.name),
      // Day 19C — Tier 2 router key. The game loop reads this to decide
      // whether an EXAMINE/INTERACT target maps to a built-in ambient
      // template (instant response, no AI call). Empty string falls
      // through to Tier 3 for legacy locations without an ambient_type.
      ambient_type:         loc.ambient_type ?? "",
      available_services:   [],
    },
    significance:        loc.is_settlement_node ? "MAJOR" : "NOTABLE",
    first_seen_location: loc.id,
    session_id:          sessionId,
    name_known:          true,
    created_at:          new Date().toISOString(),
  };
}

/**
 * Architecture C — coerce an arbitrary NPC knowledge entry to the
 * canonical `{topic, content}` shape so apply-time can write a single
 * format into world_assets.constitution.knowledge. The dialogue option
 * builder reads this back without a second normalization pass.
 */
function normalizeKnowledgeEntry(
  raw: unknown
): { topic: string; content: string } | null {
  if (typeof raw === "string") {
    const content = raw.trim();
    if (!content) return null;
    const topic = content.split(/\s+/).slice(0, 5).join(" ").replace(/[.!?,;:]+$/, "").trim();
    return { topic: topic || content.slice(0, 40), content };
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const topic   = typeof o.topic   === "string" ? o.topic.trim()   : "";
    const content = typeof o.content === "string" ? o.content.trim() : "";
    if (!content) return null;
    return {
      topic:   topic || content.split(/\s+/).slice(0, 5).join(" "),
      content,
    };
  }
  return null;
}

function npcToAsset(npc: NPCDefinition, sessionId: string): WorldAsset {
  const knowledgeItems = (npc.knowledge ?? [])
    .map((k) => normalizeKnowledgeEntry(k))
    .filter((k): k is { topic: string; content: string } => k !== null);
  // Keep `notes` populated for the legacy ACTIVE NPC CONTEXT block in
  // prompt-builder ("Motivations: ${c.notes}"); writing the structured
  // `knowledge` array alongside it powers the code-built dialogue
  // option list (Architecture C) without removing prompt context.
  const notes = knowledgeItems.map((k) => k.content).join(". ");
  return {
    id:                  npc.id,
    category:            AssetCategory.CHARACTER,
    name:                npc.name,
    constitution: {
      appearance:      npc.appearance,
      personality:     npc.personality,
      role:            npc.role,
      speech_patterns: npc.speech_style,
      ...(npc.faction_id ? { faction: npc.faction_id } : {}),
      knowledge:       knowledgeItems,
      notes,
    },
    significance:        npc.quest_relevance === "key" ? "MAJOR" : "NOTABLE",
    first_seen_location: npc.home_location_id,
    session_id:          sessionId,
    name_known:          true,
    created_at:          new Date().toISOString(),
  };
}

/**
 * Map a geographic region's `type` field to one of the open-world
 * ambient_type templates (open_wilderness / open_road / open_ruins).
 * Drives the Tier 2 ambient router so the narrator gets a usable
 * fallback when the player examines random objects in the region.
 */
function regionAmbientType(rawType: string | undefined): string {
  const t = (rawType ?? "").toLowerCase();
  if (t.includes("wilderness") || t.includes("forest") ||
      t.includes("mountain")   || t.includes("swamp")) {
    return "open_wilderness";
  }
  if (t.includes("road") || t.includes("crossing") ||
      t.includes("pass") || t.includes("route")) {
    return "open_road";
  }
  if (t.includes("ruin")    || t.includes("waste") ||
      t.includes("badland") || t.includes("desert")) {
    return "open_ruins";
  }
  return "open_wilderness";
}

function regionZoneToAsset(
  regionId: string,
  regionName: string,
  regionType: string | undefined,
  atmosphere: string,
  sessionId: string
): WorldAsset {
  // FIX 2 — populate BOTH constitution.physical_description AND
  // constitution.atmosphere from the same atmosphere prose. The
  // narrator pipeline (and the codex first-visit fallback) reads
  // physical_description; WorldMap.tsx::firstAtmosphere falls back
  // through both fields. Writing both means every consumer finds
  // the prose regardless of which field they happen to query.
  const trimmedAtm = (atmosphere ?? "").trim();
  return {
    id:                  `location_${regionId}`,
    category:            AssetCategory.LOCATION,
    name:                regionName,
    constitution: {
      physical_description: trimmedAtm,
      atmosphere:           trimmedAtm,
      key_landmarks:        [],
      ambient_type:         regionAmbientType(regionType),
      available_services:   [],
    },
    significance:        "NOTABLE",
    first_seen_location: regionId,
    session_id:          sessionId,
    name_known:          true,
    created_at:          new Date().toISOString(),
  };
}

function regionOutlineToAsset(
  region: WorldBible["adjacent_regions"][number],
  sessionId: string
): WorldAsset {
  return {
    id:                  `location_${region.id}`,
    category:            AssetCategory.LOCATION,
    name:                region.name,
    constitution: {
      physical_description: region.atmosphere_hint,
      ...(region.controlling_faction ? { faction_affiliation: region.controlling_faction } : {}),
    },
    significance:        "NOTABLE",
    first_seen_location: region.id,
    session_id:          sessionId,
    name_known:          true,
    created_at:          new Date().toISOString(),
  };
}

function objectToAsset(
  obj: LocationDefinition["objects"][number],
  parentLocationId: string,
  sessionId: string
): WorldAsset {
  return {
    id:                  `item_${obj.id}`,
    category:            AssetCategory.ITEM,
    name:                obj.name,
    constitution: {
      item_description: obj.description,
      ...(obj.contains_lore ? { lore_content: obj.contains_lore } : {}),
    },
    significance:        "NOTABLE",
    first_seen_location: parentLocationId,
    session_id:          sessionId,
    name_known:          true,
    created_at:          new Date().toISOString(),
  };
}

/**
 * After all graphNodes are built, walk the map and spread any group of
 * nodes that share the same `map_position`. The first node in each
 * group keeps its coordinates (it's typically the hub or earliest-
 * registered location); siblings get small integer offsets so the
 * renderer always receives unique positions to project.
 *
 * The skeleton prompt asks the AI for unique positions, but generators
 * still occasionally collide them — this is a runtime safety net so
 * map layout never collapses to a single point.
 */
function deduplicatePositions(
  nodes: Record<string, WorldNode>
): Record<string, WorldNode> {
  const byPos: Record<string, string[]> = {};
  for (const [id, node] of Object.entries(nodes)) {
    const pos = node.map_position;
    if (!pos || typeof pos.x !== "number") continue;
    const key = `${pos.x},${pos.y}`;
    if (!byPos[key]) byPos[key] = [];
    byPos[key].push(id);
  }

  const result = { ...nodes };

  // Spread spiral: index 0 keeps the original; later siblings spiral
  // outward through cardinal then diagonal directions. Beyond the
  // pre-baked offsets, we fall back to the last entry — collisions of
  // 9+ at the exact same coord are vanishingly rare in practice.
  const OFFSETS: Array<[number, number]> = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];

  for (const ids of Object.values(byPos)) {
    if (ids.length <= 1) continue;
    ids.forEach((id, i) => {
      if (i === 0) return; // first node keeps its original position
      const original = result[id].map_position!;
      const offset   = OFFSETS[Math.min(i, OFFSETS.length - 1)];
      result[id] = {
        ...result[id],
        map_position: {
          x: original.x + offset[0],
          y: original.y + offset[1],
        },
      };
      console.log(
        `[apply-world-bible] De-duplicated position for ${id}:`,
        result[id].map_position
      );
    });
  }

  return result;
}

// ── Route handler ─────────────────────────────────────────────────────────────

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

  const { session_id, bible, wcd } = body;
  if (!session_id || !bible || !wcd) {
    return NextResponse.json(
      { error: "Missing required fields: session_id, bible, wcd" },
      { status: 400 }
    );
  }

  // Alias the narrowed body objects so closures defined below see the
  // non-undefined types — TS doesn't propagate narrowing into deferred
  // closures the way it does for inline expressions.
  const sessionId = session_id;
  const bibleNarrowed: WorldBible = bible;
  const wcdNarrowed:  WorldConsistencyDocument = wcd;

  // ── 1. Load the session's current master_state ─────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error: fetchErr } = await (supabase.from("game_sessions") as any)
    .select("master_state")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single() as { data: { master_state: Json } | null; error: unknown };

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const current = row.master_state as unknown as MasterState;

  // ── 1b. Audit Area 1 fix — coerce settlement node to a hub type ────────────
  // The AI sometimes flags a tavern / inn / smithy as the settlement node.
  // The architecture intends the settlement node to be a public gathering
  // space; specific buildings should be sub-locations of it. Rather than
  // rejecting the bible, we rewrite the settlement node's type to
  // "settlement" so the rest of the pipeline (move classifier, narrator)
  // treats it as a hub.
  const BUILDING_TYPES = new Set([
    "tavern", "inn", "pub", "alehouse",
    "smithy", "shop", "market_stall",
    "temple", "guild", "garrison",
  ]);
  for (const loc of bibleNarrowed.starting_region.locations) {
    if (loc.is_settlement_node && BUILDING_TYPES.has(loc.type)) {
      console.warn(
        `[apply-world-bible] Settlement node generated as building type "${loc.type}" — coercing to "settlement". (id=${loc.id})`
      );
      loc.type = "settlement";
      loc.is_interior = false;
    }
  }

  // ── 1c. Day 20 Combat — validate enemies + scrub encounter rosters ─────────
  // The AI sometimes drops fields or emits malformed numbers. validateEnemy
  // returns null on bad shape; we collect only the survivors. The
  // bibleNarrowed object is mutated in place so the JSON blob persisted in
  // step 6 contains only validated enemies (no garbage rides along).
  //
  // PERSISTENCE NOTE: enemies live inside the WorldBible JSON blob written
  // to game_sessions.world_bible (jsonb). They ride along with the bible —
  // no separate column or table needed. The mirror onto
  // master_state.metadata.world_bible carries the same data into runtime.
  const startingEnemies = validateEnemies(
    bibleNarrowed.starting_region.enemies,
    `starting_region "${bibleNarrowed.starting_region.id}"`
  );
  bibleNarrowed.starting_region.enemies = startingEnemies;
  console.log(
    `[apply-world-bible] starting_region.enemies validated: ${startingEnemies.length} entries.`
  );

  for (const region of bibleNarrowed.adjacent_regions) {
    const validated = validateEnemies(region.enemies, `adjacent_region "${region.id}"`);
    region.enemies = validated;
  }
  const adjacentTotal = bibleNarrowed.adjacent_regions.reduce(
    (n, r) => n + (r.enemies?.length ?? 0), 0
  );
  console.log(
    `[apply-world-bible] adjacent_regions enemies validated: ${adjacentTotal} entries across ${bibleNarrowed.adjacent_regions.length} outlines.`
  );

  // Build the set of every enemy id that's resolvable from this WorldBible:
  //   - the genre's hand-authored bestiary
  //   - this region's validated enemies
  //   - every adjacent_region's validated outline enemies
  // encounter_roster references are scrubbed against this set; unknown ids
  // are dropped with a warning (they would otherwise crash at combat time).
  const wbGenre        = (current.metadata?.genre ?? Genre.FANTASY) as Genre;
  const validEnemyIds  = new Set<string>();
  for (const e of getGenreBestiary(wbGenre)) validEnemyIds.add(e.id);
  for (const e of startingEnemies) validEnemyIds.add(e.id);
  for (const region of bibleNarrowed.adjacent_regions) {
    for (const e of region.enemies ?? []) validEnemyIds.add(e.id);
  }

  for (const loc of bibleNarrowed.starting_region.locations) {
    if (Array.isArray(loc.encounter_roster)) {
      loc.encounter_roster = scrubEncounterRoster(
        loc.encounter_roster, validEnemyIds, `location "${loc.id}"`
      );
    }
  }
  for (const loc of bibleNarrowed.starting_region.region_locations ?? []) {
    if (Array.isArray(loc.encounter_roster)) {
      loc.encounter_roster = scrubEncounterRoster(
        loc.encounter_roster, validEnemyIds, `region_location "${loc.id}"`
      );
    }
  }

  // ── 2. Build all world_assets rows ─────────────────────────────────────────
  // Day 20 geographic restructure: region_locations are standalone
  // locations in the geographic area (dungeons, wilderness, shrines)
  // alongside the settlement, NOT inside it. Treat them as first-class
  // locations for asset and graph purposes.
  const regionLocations = bibleNarrowed.starting_region.region_locations ?? [];
  const allLocations    = [
    ...bibleNarrowed.starting_region.locations,
    ...regionLocations,
  ];
  const locationAssets = allLocations.map((l) => locationToAsset(l, sessionId));
  const npcAssets      = bibleNarrowed.starting_region.npcs.map((n) => npcToAsset(n, sessionId));
  const regionAssets   = bibleNarrowed.adjacent_regions.map((r) => regionOutlineToAsset(r, sessionId));
  const objectAssets: WorldAsset[] = [];
  for (const loc of allLocations) {
    for (const obj of loc.objects) {
      if (obj.is_interactable) {
        objectAssets.push(objectToAsset(obj, loc.id, sessionId));
      }
    }
  }
  const allAssets = [...locationAssets, ...npcAssets, ...regionAssets, ...objectAssets];

  // ── 3. Upsert every asset (write-once via ignoreDuplicates) ────────────────
  for (const asset of allAssets) {
    const insertRow: Record<string, unknown> = {
      session_id:          sessionId,
      asset_id:            asset.id,
      category:            asset.category,
      name:                asset.name,
      constitution:        asset.constitution,
      significance:        asset.significance,
      first_seen_location: asset.first_seen_location,
      name_known:          asset.name_known,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("world_assets") as any).upsert(
      insertRow,
      { onConflict: "session_id,asset_id", ignoreDuplicates: true }
    );
    if (error) {
      console.error("[apply-world-bible] world_asset write failed for", asset.id, error);
    }
  }

  // ── 4. Build the WorldGraph ────────────────────────────────────────────────
  // Day 20 geographic restructure:
  //   • The geographic REGION is itself a zone node (id = bible.starting_region.id).
  //     It's the top-level "place" that contains the settlement and any
  //     standalone region_locations (dungeons, wilderness points).
  //   • The settlement node sits inside the geographic region — its
  //     zone_id points at the region.
  //   • Sub-locations (tavern, shop, smithy) sit inside the settlement —
  //     their zone_id points at the settlement node id.
  //   • region_locations[] sit inside the geographic region alongside
  //     the settlement — their zone_id points at the region.
  const settlementNode = bibleNarrowed.starting_region.locations.find((l) => l.is_settlement_node);
  if (!settlementNode) {
    return NextResponse.json(
      { error: "WorldBible has no settlement_node in starting_region.locations" },
      { status: 400 }
    );
  }
  const startingNodeId      = settlementNode.id;
  const geographicRegionId  = bibleNarrowed.starting_region.id;
  const isSameAsSettlement  = geographicRegionId === startingNodeId;

  // Audit Issue L / Area 2 fix: build a valid NPC id set so we can drop
  // dangling references emitted by the AI (loc.npc_ids: ["foo"] when the
  // npcs[] array uses ["character_foo"], or vice-versa). When a location
  // ends up with zero valid ids but the bible's npcs[] declares an NPC
  // whose home_location_id matches the location, re-stitch via that
  // home_location_id so NPCS PRESENT renders correctly.
  const validNpcIds = new Set(bibleNarrowed.starting_region.npcs.map((n) => n.id));
  // FIX 1 — Same validation for connection IDs. AI sometimes references
  // a location id that doesn't exist (typo, alias, hallucination).
  // Day 20: include both settlement-locations AND standalone
  // region_locations PLUS the geographic region id itself so connections
  // back to the region are honoured.
  const validLocationIds = new Set([
    ...allLocations.map((l) => l.id),
    geographicRegionId,
  ]);

  const graphNodes: Record<string, WorldNode> = {};

  // 4a. Settlement-side locations (the town and its sub-locations).
  for (const loc of bibleNarrowed.starting_region.locations) {
    const filteredNpcIds = loc.npc_ids.filter((id) => validNpcIds.has(id));
    let finalNpcIds = filteredNpcIds;
    if (filteredNpcIds.length === 0) {
      const homeNpcs = bibleNarrowed.starting_region.npcs
        .filter((n) => n.home_location_id === loc.id)
        .map((n) => n.id);
      if (homeNpcs.length > 0) {
        finalNpcIds = homeNpcs;
        console.log(
          `[apply-world-bible] Re-stitched npc_ids via home_location_id for ${loc.id}:`,
          homeNpcs
        );
      }
    }
    if (filteredNpcIds.length !== loc.npc_ids.length) {
      const dropped = loc.npc_ids.filter((id) => !validNpcIds.has(id));
      console.warn(
        `[apply-world-bible] Dropped ${dropped.length} dangling npc_id reference(s) at ${loc.id}:`,
        dropped
      );
    }

    // FIX 1 — filter connections to known locations only.
    const validConnections: string[] = [];
    for (const id of loc.connections) {
      if (validLocationIds.has(id)) {
        validConnections.push(id);
      } else {
        console.warn(
          "[apply-world-bible] Dropping invalid connection:",
          id,
          "from location:",
          loc.id
        );
      }
    }

    // Day 20 zone_id rules:
    //   sub_location  → zone_id = settlement node (the town)
    //   settlement    → zone_id = geographic region (the area)
    let zoneId: string;
    if (loc.is_interior && loc.parent_location_id) {
      zoneId = loc.parent_location_id;
    } else if (loc.is_settlement_node) {
      // The settlement sits inside the geographic region. When the AI
      // happens to reuse the same id for both (`isSameAsSettlement`),
      // self-reference is fine — the legacy single-tier behaviour still
      // works.
      zoneId = geographicRegionId;
    } else {
      zoneId = loc.id;
    }

    // The settlement hub is a Tier 2 node that lives INSIDE the
    // geographic region. It must never appear on the World map tier,
    // so it gets is_expandable: false even though it isn't an
    // interior. Only the geographic region zone (built in step 4c)
    // and adjacent region nodes (built in step 4d) carry true.
    const isExpandable = loc.is_settlement_node ? false : !loc.is_interior;
    console.log(
      `[apply-world-bible] is_expandable for ${loc.id}:`,
      isExpandable
    );

    graphNodes[loc.id] = {
      id:                 loc.id,
      name:               loc.name,
      type:               loc.is_interior ? "sub_location" : "zone",
      category:           loc.type,
      zone_id:            zoneId,
      is_expandable:      isExpandable,
      connections:        validConnections,
      npc_ids:            finalNpcIds,
      item_ids:           loc.objects.map((o) => `item_${o.id}`),
      asset_id:           `location_${loc.id}`,
      discovered:         loc.is_settlement_node,
      map_position:       loc.grid_position,
      // CHANGE 2 — mirror the bible's flag onto the graph node so the
      // NavigationBar's return-card logic can find the parent
      // settlement of a region_location without inferring from
      // is_expandable. Sub-locations and standalone region locations
      // explicitly carry false.
      is_settlement_node: loc.is_settlement_node === true,
      // Day 20 Combat — mirror encounter fields so the trigger reads
      // from the graph node (Prompt 2) without re-fetching the bible.
      encounter_chance:   typeof loc.encounter_chance === "number"
                            ? loc.encounter_chance : undefined,
      encounter_roster:   Array.isArray(loc.encounter_roster) && loc.encounter_roster.length > 0
                            ? [...loc.encounter_roster] : undefined,
      is_boss_room:       loc.is_boss_room === true ? true : undefined,
    };
  }

  // 4b. Day 20 — standalone region_locations (dungeons, wilderness,
  // shrines). Each lives in the geographic region alongside the
  // settlement, so its zone_id points at the geographic region id.
  for (const loc of regionLocations) {
    const filteredNpcIds = loc.npc_ids.filter((id) => validNpcIds.has(id));
    let finalNpcIds = filteredNpcIds;
    if (filteredNpcIds.length === 0) {
      const homeNpcs = bibleNarrowed.starting_region.npcs
        .filter((n) => n.home_location_id === loc.id)
        .map((n) => n.id);
      if (homeNpcs.length > 0) {
        finalNpcIds = homeNpcs;
      }
    }
    const validConnections: string[] = [];
    for (const id of loc.connections) {
      if (validLocationIds.has(id)) validConnections.push(id);
    }
    // FIX 1a — ALWAYS guarantee the back-link to the settlement. The AI
    // sometimes omits the settlement from a region_location's
    // connections array, which leaves the player stranded at "The
    // Bellhaven Road" with an empty NavigationBar (no way to walk back
    // to town). The settlement is structurally always reachable from
    // any sibling node in the geographic region.
    if (!validConnections.includes(startingNodeId)) {
      validConnections.push(startingNodeId);
    }
    const regionLocNode = {
      id:                 loc.id,
      name:               loc.name,
      // FIX 3 — region_locations MUST carry type: "zone" (NOT
      // "region_location" or "dungeon") so the WorldMap's
      // isAtNonSettlementZone predicate
      //   player.type === "zone" &&
      //   !player.is_settlement_node &&
      //   !player.is_expandable
      // disables the LOCAL tab when the player is standing on one.
      // The specific dungeon / wilderness flavour lives on
      // `category` instead.
      type:               "zone" as const,
      category:           loc.type,
      // CHANGE 2 — region_locations live IN the geographic region, not
      // in their own zone. zone_id is locked to the geographic region
      // id so NavigationBar's parent-settlement search succeeds.
      zone_id:            geographicRegionId,
      is_expandable:      false,
      connections:        validConnections,
      npc_ids:            finalNpcIds,
      item_ids:           loc.objects.map((o) => `item_${o.id}`),
      asset_id:           `location_${loc.id}`,
      // Discovered = false so the world map renders a dashed outline
      // until the player actually visits.
      discovered:         false,
      map_position:       loc.grid_position,
      // Standalone landmarks are never the settlement hub.
      is_settlement_node: false,
      // Day 20 Combat — mirror encounter fields. region_locations are
      // the most likely combat-eligible nodes in the starting region.
      encounter_chance:   typeof loc.encounter_chance === "number"
                            ? loc.encounter_chance : undefined,
      encounter_roster:   Array.isArray(loc.encounter_roster) && loc.encounter_roster.length > 0
                            ? [...loc.encounter_roster] : undefined,
      is_boss_room:       loc.is_boss_room === true ? true : undefined,
    };
    // FIX 3 — diagnostic. Surface the three fields the WorldMap
    // predicate keys off so a generation regression is immediately
    // visible in server logs the next time a dungeon/wilderness node
    // doesn't disable LOCAL.
    console.log(
      "[apply-world-bible] region_location node:",
      loc.id,
      "type:", regionLocNode.type,
      "is_expandable:", regionLocNode.is_expandable,
      "is_settlement_node:", regionLocNode.is_settlement_node
    );
    graphNodes[loc.id] = regionLocNode;
  }

  // 4b-2. CHANGE 2 — symmetric back-connection validation pass.
  // For every region_location, guarantee the bidirectional edge to the
  // settlement and log the stitch when an edge had to be added. This
  // runs at apply time, not runtime, so the graph is fully wired
  // BEFORE the world is persisted — no patching downstream.
  {
    for (const r of regionLocations) {
      const rNode = graphNodes[r.id];
      if (!rNode) continue;
      if (!rNode.connections.includes(startingNodeId)) {
        graphNodes[r.id] = {
          ...rNode,
          connections: [...rNode.connections, startingNodeId],
        };
        console.log(
          `[apply-world-bible] Stitched back-connection: ${r.id} ↔ ${startingNodeId}`
        );
      }
      const settlement = graphNodes[startingNodeId];
      if (settlement && !settlement.connections.includes(r.id)) {
        graphNodes[startingNodeId] = {
          ...settlement,
          connections: [...settlement.connections, r.id],
        };
        console.log(
          `[apply-world-bible] Stitched back-connection: ${startingNodeId} ↔ ${r.id}`
        );
      }
    }
  }

  // 4c. Day 20 — the geographic REGION itself is a top-level zone
  // node. The settlement node + region_locations are its children.
  // Skip when the AI reused the settlement id as the region id
  // (legacy single-tier shape) — we already created that node above.
  if (!isSameAsSettlement && !graphNodes[geographicRegionId]) {
    const regionConnections: string[] = [startingNodeId];
    for (const r of regionLocations) {
      if (!regionConnections.includes(r.id)) regionConnections.push(r.id);
    }
    // Adjacent region travel: wire each adjacent_region placeholder into
    // the geographic region zone's connections so NavigationBar's ◇
    // (peer-unknown) D2 filter (which gates on
    // current.connections.includes(r.id)) can surface them. classifyMove
    // will then return GRAPH_NAVIGATE on a ◇ click; useGameLoop step 4d
    // detects "navigating to an undiscovered adjacent placeholder" and
    // fires RegionBible expansion.
    for (const r of bibleNarrowed.adjacent_regions) {
      if (!regionConnections.includes(r.id)) regionConnections.push(r.id);
    }
    graphNodes[geographicRegionId] = {
      id:            geographicRegionId,
      name:          bibleNarrowed.starting_region.name,
      type:          "zone",
      category:      bibleNarrowed.starting_region.type,
      zone_id:       geographicRegionId,
      is_expandable: true,
      connections:   regionConnections,
      npc_ids:       [],
      item_ids:      [],
      asset_id:      `location_${geographicRegionId}`,
      discovered:    true,
      map_position:  bibleNarrowed.starting_region.grid_centre,
    };
    // Wire the settlement node back to the geographic region. The
    // settlement ↔ region_location wiring already happened in 4b/4b-2;
    // here we only add the region zone itself to the settlement's
    // connections so the player can step onto the broader landscape.
    const settlement = graphNodes[startingNodeId];
    if (settlement && !settlement.connections.includes(geographicRegionId)) {
      graphNodes[startingNodeId] = {
        ...settlement,
        connections: [...settlement.connections, geographicRegionId],
      };
    }

    // CHANGE 4 — write a world_asset for the region zone so the
    // narrator has location data to work with when the player steps
    // out into the open-world layer.
    //
    // FIX 2 — upsert WITHOUT ignoreDuplicates here. The settlement /
    // region_locations rows in step 3 already covered every other id;
    // this id (`location_<region>`) is unique to the geographic region
    // zone. Letting the upsert override an existing row guarantees a
    // re-applied bible refreshes stale region prose instead of
    // silently skipping. Diagnostic logs surface both the prose
    // length we are writing and any upsert error.
    const startingAtmosphere = bibleNarrowed.starting_region.atmosphere ?? "";
    const regionZoneAsset = regionZoneToAsset(
      geographicRegionId,
      bibleNarrowed.starting_region.name,
      bibleNarrowed.starting_region.type,
      startingAtmosphere,
      sessionId
    );
    console.log(
      "[apply-world-bible] region-zone asset write:",
      {
        id:                  regionZoneAsset.id,
        name:                regionZoneAsset.name,
        atmosphereLen:       startingAtmosphere.trim().length,
        atmospherePreview:   startingAtmosphere.trim().slice(0, 80),
      }
    );
    if (startingAtmosphere.trim().length === 0) {
      console.warn(
        "[apply-world-bible] starting_region.atmosphere is empty — region panel will show blank description for",
        regionZoneAsset.id
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: regionAssetErr } = await (supabase.from("world_assets") as any).upsert(
      {
        session_id:          sessionId,
        asset_id:            regionZoneAsset.id,
        category:            regionZoneAsset.category,
        name:                regionZoneAsset.name,
        constitution:        regionZoneAsset.constitution,
        significance:        regionZoneAsset.significance,
        first_seen_location: regionZoneAsset.first_seen_location,
        name_known:          regionZoneAsset.name_known,
      },
      { onConflict: "session_id,asset_id" }
    );
    if (regionAssetErr) {
      console.error(
        "[apply-world-bible] region-zone world_asset write failed for",
        regionZoneAsset.id,
        regionAssetErr
      );
    }
  } else if (isSameAsSettlement) {
    // FIX 2 — single-tier shape (region.id === settlement.id). The
    // settlement asset was written in step 3 with the SUB-LOCATION
    // atmosphere ("outdoor hub description"), not the broader
    // regional landscape prose. Overwrite the asset's constitution
    // with the region atmosphere so the Region map description panel
    // shows landscape prose instead of an interior hub blurb.
    const startingAtmosphere = bibleNarrowed.starting_region.atmosphere ?? "";
    if (startingAtmosphere.trim().length > 0) {
      const regionZoneAsset = regionZoneToAsset(
        geographicRegionId,
        bibleNarrowed.starting_region.name,
        bibleNarrowed.starting_region.type,
        startingAtmosphere,
        sessionId
      );
      console.log(
        "[apply-world-bible] single-tier region-zone asset overwrite:",
        {
          id:                regionZoneAsset.id,
          atmosphereLen:     startingAtmosphere.trim().length,
          atmospherePreview: startingAtmosphere.trim().slice(0, 80),
        }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: regionAssetErr } = await (supabase.from("world_assets") as any).upsert(
        {
          session_id:          sessionId,
          asset_id:            regionZoneAsset.id,
          category:            regionZoneAsset.category,
          name:                regionZoneAsset.name,
          constitution:        regionZoneAsset.constitution,
          significance:        regionZoneAsset.significance,
          first_seen_location: regionZoneAsset.first_seen_location,
          name_known:          regionZoneAsset.name_known,
        },
        { onConflict: "session_id,asset_id" }
      );
      if (regionAssetErr) {
        console.error(
          "[apply-world-bible] single-tier region-zone overwrite failed for",
          regionZoneAsset.id,
          regionAssetErr
        );
      }
    }
  }

  // 4d. Adjacent regions appear as undiscovered zone nodes so the world
  // map can render them as dim outlines.
  // Each placeholder back-links to the geographic region zone (or the
  // settlement if the AI reused a single id for both) so classifyMove's
  // connection lookup from the region zone resolves the placeholder via
  // its name/id rather than falling through to WORLD_EXPLORE.
  const placeholderBackLink = isSameAsSettlement ? startingNodeId : geographicRegionId;
  for (const region of bibleNarrowed.adjacent_regions) {
    if (graphNodes[region.id]) continue; // shouldn't collide, but defensive
    graphNodes[region.id] = {
      id:            region.id,
      name:          region.name,
      type:          "zone",
      category:      region.type,
      zone_id:       region.id,
      is_expandable: true,
      connections:   [placeholderBackLink],
      npc_ids:       [],
      item_ids:      [],
      asset_id:      `location_${region.id}`,
      discovered:    false,
      map_position:  region.grid_centre,
    };
  }
  // For the legacy single-tier shape (region.id === startingNodeId),
  // also wire the settlement to each adjacent placeholder so the ◇ card
  // can surface there. The non-legacy path already added them to the
  // geographic region zone above.
  if (isSameAsSettlement) {
    const settlement = graphNodes[startingNodeId];
    if (settlement) {
      const extra = bibleNarrowed.adjacent_regions
        .map((r) => r.id)
        .filter((id) => !settlement.connections.includes(id));
      if (extra.length > 0) {
        graphNodes[startingNodeId] = {
          ...settlement,
          connections: [...settlement.connections, ...extra],
        };
      }
    }
  }

  // Spread any colliding positions before persisting — the renderer's
  // bounding-box projection collapses to a single point when nodes
  // share coordinates, so this is a layout-safety net regardless of
  // how careful the upstream generator was.
  const deduplicatedNodes = deduplicatePositions(graphNodes);

  // Day 20 — current_node_id starts at the SETTLEMENT, not the
  // geographic zone. The player arrives in town, not in the abstract
  // landscape around it.
  const worldGraph: WorldGraph = {
    nodes:            deduplicatedNodes,
    current_node_id:  startingNodeId,
    starting_node_id: startingNodeId,
  };

  // ── 5. Patch master_state ──────────────────────────────────────────────────
  const patched: MasterState = {
    ...current,
    metadata: {
      ...current.metadata,
      world_consistency: wcdNarrowed,
      main_quest:        bibleNarrowed.main_quest,
      // Day 19D — mirror the bible into metadata so the game loop can
      // match WORLD_EXPLORE destinations against adjacent_regions without
      // an extra fetch on every move.
      world_bible:       bibleNarrowed,
    },
    world_state: {
      ...current.world_state,
      current_location_id: startingNodeId,
      current_node_id:     startingNodeId,
      visited_locations:   Array.from(
        new Set([...(current.world_state.visited_locations ?? []), startingNodeId])
      ),
      location_status:     LocationStatus.PRESENT,
    },
    world_graph: worldGraph,
    // Day 20.4 TASK 4 — seed last_settlement_hub_id at spawn so the
    // first defeat in any new game teleports back to the starting
    // settlement, not the region zone. World-gen always lands the
    // player at the starting region's settlement_id (which carries
    // is_settlement_node=true), so this is a one-line write.
    // useGameLoop step 7c-2 then keeps it current as the player
    // visits other settlements.
    last_settlement_hub_id: startingNodeId,
  };

  // ── 6. Persist master_state + dedicated columns ────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (supabase.from("game_sessions") as any)
    .update({
      master_state:      patched as unknown as Json,
      world_bible:       bibleNarrowed as unknown as Json,
      world_consistency: wcdNarrowed as unknown as Json,
      world_graph:       worldGraph as unknown as Json,
    })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (updateErr) {
    return NextResponse.json(
      { error: "Failed to persist master_state and world_bible" },
      { status: 500 }
    );
  }

  console.log(
    "[apply-world-bible] Set current_location_id:",
    startingNodeId
  );
  console.log(
    `[apply-world-bible] Applied: ${bibleNarrowed.starting_region.name}, ` +
    `${bibleNarrowed.starting_region.locations.length} locations, ` +
    `${bibleNarrowed.starting_region.npcs.length} NPCs, ` +
    `${objectAssets.length} interactable objects.`
  );

  return NextResponse.json({
    success:           true,
    starting_location: settlementNode.name,
    location_count:    bibleNarrowed.starting_region.locations.length,
    npc_count:         bibleNarrowed.starting_region.npcs.length,
  });
}
