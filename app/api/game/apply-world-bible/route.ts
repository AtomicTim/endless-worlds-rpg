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

    graphNodes[loc.id] = {
      id:                 loc.id,
      name:               loc.name,
      type:               loc.is_interior ? "sub_location" : "zone",
      category:           loc.type,
      zone_id:            zoneId,
      is_expandable:      !loc.is_interior,
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
    graphNodes[loc.id] = {
      id:                 loc.id,
      name:               loc.name,
      type:               "zone",
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
    };
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
  }

  // 4d. Adjacent regions appear as undiscovered zone nodes so the world
  // map can render them as dim outlines.
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

  // Day 20 — current_node_id starts at the SETTLEMENT, not the
  // geographic zone. The player arrives in town, not in the abstract
  // landscape around it.
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
