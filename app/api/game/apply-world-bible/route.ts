import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AssetCategory, LocationStatus } from "@/types/game";
import type { Json } from "@/types/database";
import type {
  LocationDefinition,
  MasterState,
  NPCDefinition,
  WorldAsset,
  WorldBible,
  WorldConsistencyDocument,
  WorldGraph,
  WorldNode,
} from "@/types/game";

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

function npcToAsset(npc: NPCDefinition, sessionId: string): WorldAsset {
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
      notes:           npc.knowledge.join(". "),
    },
    significance:        npc.quest_relevance === "key" ? "MAJOR" : "NOTABLE",
    first_seen_location: npc.home_location_id,
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

  // ── 2. Build all world_assets rows ─────────────────────────────────────────
  const locationAssets = bibleNarrowed.starting_region.locations.map((l) => locationToAsset(l, sessionId));
  const npcAssets      = bibleNarrowed.starting_region.npcs.map((n) => npcToAsset(n, sessionId));
  const regionAssets   = bibleNarrowed.adjacent_regions.map((r) => regionOutlineToAsset(r, sessionId));
  const objectAssets: WorldAsset[] = [];
  for (const loc of bibleNarrowed.starting_region.locations) {
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
  const settlementNode = bibleNarrowed.starting_region.locations.find((l) => l.is_settlement_node);
  if (!settlementNode) {
    return NextResponse.json(
      { error: "WorldBible has no settlement_node in starting_region.locations" },
      { status: 400 }
    );
  }
  const startingNodeId = settlementNode.id;

  // Audit Issue L / Area 2 fix: build a valid NPC id set so we can drop
  // dangling references emitted by the AI (loc.npc_ids: ["foo"] when the
  // npcs[] array uses ["character_foo"], or vice-versa). When a location
  // ends up with zero valid ids but the bible's npcs[] declares an NPC
  // whose home_location_id matches the location, re-stitch via that
  // home_location_id so NPCS PRESENT renders correctly.
  const validNpcIds = new Set(bibleNarrowed.starting_region.npcs.map((n) => n.id));

  const graphNodes: Record<string, WorldNode> = {};
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

    graphNodes[loc.id] = {
      id:            loc.id,
      name:          loc.name,
      type:          loc.is_interior ? "sub_location" : "zone",
      category:      loc.type,
      zone_id:       loc.is_interior && loc.parent_location_id ? loc.parent_location_id : loc.id,
      is_expandable: !loc.is_interior,
      connections:   [...loc.connections],
      npc_ids:       finalNpcIds,
      item_ids:      loc.objects.map((o) => `item_${o.id}`),
      asset_id:      `location_${loc.id}`,
      discovered:    loc.is_settlement_node,
      map_position:  loc.grid_position,
    };
  }

  // Adjacent regions appear as undiscovered zone nodes so the world map
  // can render them as dim outlines.
  for (const region of bibleNarrowed.adjacent_regions) {
    if (graphNodes[region.id]) continue; // shouldn't collide, but defensive
    graphNodes[region.id] = {
      id:            region.id,
      name:          region.name,
      type:          "zone",
      category:      region.type,
      zone_id:       region.id,
      is_expandable: true,
      connections:   [],
      npc_ids:       [],
      item_ids:      [],
      asset_id:      `location_${region.id}`,
      discovered:    false,
      map_position:  region.grid_centre,
    };
  }

  const worldGraph: WorldGraph = {
    nodes:            graphNodes,
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
