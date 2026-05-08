import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AssetCategory, LocationStatus } from "@/types/game";
import type { Json } from "@/types/database";
import type {
  LocationDefinition,
  MasterState,
  NPCDefinition,
  RegionBible,
  WorldAsset,
  WorldGraph,
  WorldNode,
} from "@/types/game";

/**
 * Day 19D — Apply a freshly-generated RegionBible to a session.
 *
 * Mirrors apply-world-bible but extends the existing WorldGraph rather
 * than building one from scratch:
 *   • Writes every new location, NPC, and interactable Tier 1 object
 *     as a permanent world_asset (write-once via ignoreDuplicates).
 *   • Adds new WorldNodes for each location in the bible.
 *   • Wires the new region's settlement node bidirectionally to the
 *     origin node the player crossed from.
 *   • Replaces the placeholder outline-zone node from the WorldBible
 *     pass (graphNodes[bible.id]) with the fully-fleshed settlement node.
 *
 * Returns the updated graph and the settlement node id so the caller
 * can navigate the player into the new region.
 */

interface RequestBody {
  session_id?:           string;
  bible?:                RegionBible;
  origin_node_id?:       string;
  existing_world_graph?: WorldGraph;
  /** Bug 2 — the outline.id the client expects this bible to belong to.
   *  Compared against bible.id; mismatch indicates cache poisoning or
   *  the model echoing a different id back, and we 400 instead of
   *  silently writing nodes with a corrupted zone_id. */
  expected_region_id?:   string;
}

// ── Helpers: convert bible entries into WorldAsset rows ────────────────────────

function locationToAsset(loc: LocationDefinition, sessionId: string): WorldAsset {
  return {
    id:                  `location_${loc.id}`,
    category:            AssetCategory.LOCATION,
    name:                loc.name,
    constitution: {
      physical_description: loc.atmosphere,
      key_landmarks:        loc.objects.map((o) => o.name),
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
 * canonical `{topic, content}` shape. Mirrors apply-world-bible so
 * region-expanded NPCs land in world_assets with the same structured
 * knowledge format.
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
 * Mirrors apply-world-bible so newly-expanded regions get the same
 * Tier 2 ambient router fallback.
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
  regionId:  string,
  regionName: string,
  regionType: string | undefined,
  atmosphere: string,
  sessionId: string
): WorldAsset {
  return {
    id:                  `location_${regionId}`,
    category:            AssetCategory.LOCATION,
    name:                regionName,
    constitution: {
      physical_description: atmosphere,
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

  const { session_id, bible, origin_node_id, existing_world_graph, expected_region_id } = body;
  if (!session_id || !bible || !origin_node_id || !existing_world_graph) {
    return NextResponse.json(
      { error: "Missing required fields: session_id, bible, origin_node_id, existing_world_graph" },
      { status: 400 }
    );
  }

  // Alias the narrowed body objects so closures defined below see the
  // non-undefined types — TS doesn't propagate narrowing into deferred
  // closures the way it does for inline expressions.
  const sessionId          = session_id;
  const bibleNarrowed:     RegionBible = bible;
  const originNodeId       = origin_node_id;
  const existingGraph:     WorldGraph  = existing_world_graph;

  // Bug 2 guard — refuse to apply when the bible's id doesn't match the
  // destination the client is expanding into. This would only trip on
  // cache poisoning or the AI echoing a different id back; in either
  // case writing nodes with a corrupted zone_id silently is worse than
  // a 400 the player can retry.
  if (expected_region_id && bibleNarrowed.id !== expected_region_id) {
    console.error(
      "[apply-regional-bible] ZONE_ID MISMATCH:",
      { bibleId: bibleNarrowed.id, expectedRegionId: expected_region_id, sessionId }
    );
    return NextResponse.json(
      {
        error:               "Region bible id does not match the expected destination region id",
        bible_id:            bibleNarrowed.id,
        expected_region_id,
      },
      { status: 400 }
    );
  }

  // Audit Issue K fix: load the current master_state so we can patch
  // it with the merged graph and current_location_id, then write the
  // patched state back. Previously the route only persisted world_assets,
  // which meant a reload before the next 10-action auto-save lost the
  // entire region's graph nodes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error: fetchErr } = await (supabase.from("game_sessions") as any)
    .select("id, master_state")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single() as { data: { id: string; master_state: Json } | null; error: unknown };

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const currentMasterState = row.master_state as unknown as MasterState;

  // ── 1. Build all world_asset rows ──────────────────────────────────────────
  // Day 20 — geographic restructure: region_locations are standalone
  // landmarks in the geographic region (dungeons, wilderness points)
  // alongside the settlement, NOT inside it.
  const regionLocations = bibleNarrowed.region_locations ?? [];
  const allLocations    = [...bibleNarrowed.locations, ...regionLocations];
  const locationAssets  = allLocations.map((l) => locationToAsset(l, sessionId));
  const npcAssets       = bibleNarrowed.npcs.map((n) => npcToAsset(n, sessionId));
  const objectAssets:    WorldAsset[] = [];
  for (const loc of allLocations) {
    for (const obj of loc.objects) {
      if (obj.is_interactable) {
        objectAssets.push(objectToAsset(obj, loc.id, sessionId));
      }
    }
  }
  const allAssets = [...locationAssets, ...npcAssets, ...objectAssets];

  // ── 2. Upsert every asset (write-once via ignoreDuplicates) ────────────────
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
      console.error("[apply-regional-bible] world_asset write failed for", asset.id, error);
    }
  }

  // ── 3. Resolve the settlement node ─────────────────────────────────────────
  const settlementNode = bibleNarrowed.locations.find((l) => l.is_settlement_node);
  if (!settlementNode) {
    return NextResponse.json(
      { error: "RegionBible has no settlement_node in locations" },
      { status: 400 }
    );
  }
  const startingNodeId = settlementNode.id;

  // ── 4. Build the new region's WorldNodes ───────────────────────────────────
  // Audit Issue L / Area 2 fix: validate npc_ids against the bible's npcs[]
  // and re-stitch via home_location_id when a location has zero valid ids.
  const validNpcIds = new Set(bibleNarrowed.npcs.map((n) => n.id));
  // FIX 1 — connections also validated against the region's own location
  // ids PLUS the existing graph (so a connection back to the origin node
  // isn't accidentally dropped as "unknown").
  const validLocationIds = new Set([
    ...allLocations.map((l) => l.id),
    bibleNarrowed.id,
    ...Object.keys(existingGraph.nodes),
  ]);

  const settlementNodeForZone = bibleNarrowed.locations.find((l) => l.is_settlement_node);
  const settlementIdForZone   = settlementNodeForZone?.id ?? bibleNarrowed.id;

  const newNodes: Record<string, WorldNode> = {};

  // 4a. Settlement-side locations (the town and its sub-locations).
  for (const loc of bibleNarrowed.locations) {
    const filteredNpcIds = loc.npc_ids.filter((id) => validNpcIds.has(id));
    let finalNpcIds = filteredNpcIds;
    if (filteredNpcIds.length === 0) {
      const homeNpcs = bibleNarrowed.npcs
        .filter((n) => n.home_location_id === loc.id)
        .map((n) => n.id);
      if (homeNpcs.length > 0) {
        finalNpcIds = homeNpcs;
        console.log(
          `[apply-regional-bible] Re-stitched npc_ids via home_location_id for ${loc.id}:`,
          homeNpcs
        );
      }
    }
    if (filteredNpcIds.length !== loc.npc_ids.length) {
      const dropped = loc.npc_ids.filter((id) => !validNpcIds.has(id));
      console.warn(
        `[apply-regional-bible] Dropped ${dropped.length} dangling npc_id reference(s) at ${loc.id}:`,
        dropped
      );
    }

    // FIX 1 — filter connections.
    const validConnections: string[] = [];
    for (const id of loc.connections) {
      if (validLocationIds.has(id)) {
        validConnections.push(id);
      } else {
        console.warn(
          "[apply-regional-bible] Dropping invalid connection:",
          id,
          "from location:",
          loc.id
        );
      }
    }

    // Day 20 zone_id rules (mirror apply-world-bible):
    //   sub_location  → zone_id = settlement node
    //   settlement    → zone_id = geographic region
    let zoneId: string;
    if (loc.is_interior && loc.parent_location_id) {
      zoneId = loc.parent_location_id;
    } else if (loc.is_settlement_node) {
      zoneId = bibleNarrowed.id;
    } else {
      zoneId = loc.id;
    }

    newNodes[loc.id] = {
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
      // The settlement node is what the player just crossed into — mark it
      // discovered so the world map renders it without delay.
      discovered:         loc.is_settlement_node,
      map_position:       loc.grid_position,
      // CHANGE 2 — flag the settlement node so NavigationBar's parent
      // search succeeds. Sub-locations and standalone zones carry false.
      is_settlement_node: loc.is_settlement_node === true,
    };
  }

  // 4b. Day 20 — standalone region_locations.
  for (const loc of regionLocations) {
    const filteredNpcIds = loc.npc_ids.filter((id) => validNpcIds.has(id));
    let finalNpcIds = filteredNpcIds;
    if (filteredNpcIds.length === 0) {
      const homeNpcs = bibleNarrowed.npcs
        .filter((n) => n.home_location_id === loc.id)
        .map((n) => n.id);
      if (homeNpcs.length > 0) finalNpcIds = homeNpcs;
    }
    const validConnections: string[] = [];
    for (const id of loc.connections) {
      if (validLocationIds.has(id)) validConnections.push(id);
    }
    // FIX 1a — ALWAYS guarantee the back-link to the settlement. Same
    // failure mode as apply-world-bible: the AI occasionally drops the
    // settlement from connections and the player has no nav bar option
    // back. The settlement is the only structurally-required peer of
    // every region_location.
    if (!validConnections.includes(settlementIdForZone)) {
      validConnections.push(settlementIdForZone);
    }
    // Bug 2 — diagnostic logging for region_location zone_id assignment.
    // Captures the full context at the moment we lock zone_id to the
    // bible's id so we can confirm the bible matches the player's
    // intended target region (no cross-region cache leakage).
    console.log("[apply-regional-bible] zone_id assignment:", {
      locationId:   loc.id,
      bibleId:      bibleNarrowed.id,
      bibleName:    bibleNarrowed.name,
      originNodeId,
      sessionId,
    });

    newNodes[loc.id] = {
      id:                 loc.id,
      name:               loc.name,
      type:               "zone",
      category:           loc.type,
      // CHANGE 2 — region_location lives IN the geographic region, not
      // its own zone. Locking zone_id to bibleNarrowed.id makes
      // NavigationBar's sibling-settlement lookup succeed.
      zone_id:            bibleNarrowed.id,
      is_expandable:      false,
      connections:        validConnections,
      npc_ids:            finalNpcIds,
      item_ids:           loc.objects.map((o) => `item_${o.id}`),
      asset_id:           `location_${loc.id}`,
      discovered:         false,
      map_position:       loc.grid_position,
      is_settlement_node: false,
    };
  }

  // 4b-2. CHANGE 2 — symmetric back-connection validation pass.
  // Iterate every region_location and guarantee the bidirectional
  // edge to the settlement, logging each stitched edge so generation
  // failures are visible in the server log instead of getting patched
  // up silently by NavigationBar later.
  for (const r of regionLocations) {
    const rNode = newNodes[r.id];
    if (!rNode) continue;
    if (!rNode.connections.includes(settlementIdForZone)) {
      newNodes[r.id] = {
        ...rNode,
        connections: [...rNode.connections, settlementIdForZone],
      };
      console.log(
        `[apply-regional-bible] Stitched back-connection: ${r.id} ↔ ${settlementIdForZone}`
      );
    }
    const settlement = newNodes[settlementIdForZone];
    if (settlement && !settlement.connections.includes(r.id)) {
      newNodes[settlementIdForZone] = {
        ...settlement,
        connections: [...settlement.connections, r.id],
      };
      console.log(
        `[apply-regional-bible] Stitched back-connection: ${settlementIdForZone} ↔ ${r.id}`
      );
    }
  }

  // ── 5. Merge the new nodes into the existing graph ─────────────────────────
  // Replace the placeholder outline node (added by apply-world-bible at
  // bibleNarrowed.id with discovered=false) with a fully-fleshed
  // geographic-region zone node, mirroring step 4c of apply-world-bible.
  // The settlement and region_locations point their zone_id at
  // bibleNarrowed.id, so the zone node MUST exist after this pass.
  const mergedNodes: Record<string, WorldNode> = { ...existingGraph.nodes };
  // Drop the outline first so the fresh region zone can take its place
  // cleanly, regardless of whether the settlement uses the same id.
  if (mergedNodes[bibleNarrowed.id] && !newNodes[bibleNarrowed.id]) {
    delete mergedNodes[bibleNarrowed.id];
  }
  for (const [id, node] of Object.entries(newNodes)) {
    mergedNodes[id] = node;
  }

  // CHANGE 4 — geographic region zone node + world_asset.
  // Skip when the bible reused the settlement id as the region id
  // (legacy single-tier shape) — the settlement node already lives at
  // that id and creating a second zone would orphan it.
  const isSameAsSettlement = bibleNarrowed.id === startingNodeId;
  if (!isSameAsSettlement && !mergedNodes[bibleNarrowed.id]) {
    const regionConnections: string[] = [startingNodeId];
    for (const r of regionLocations) {
      if (!regionConnections.includes(r.id)) regionConnections.push(r.id);
    }

    // Architecture CHANGE 2 — world map coordinate overlap fix.
    // The bible's grid_centre comes from the WorldBible outline that
    // sketched this region. Outlines from different sessions (or the
    // model itself drifting) sometimes land within visual range of
    // an existing region zone, which projects to overlapping markers
    // on the world-tier map. Detect collisions against every other
    // is_expandable node and nudge the new region until it has at
    // least 20 grid units of separation. Cap iterations so a fully
    // crowded map still terminates.
    const existingPositions = Object.values(existingGraph.nodes)
      .filter((n) => n.is_expandable === true && n.id !== bibleNarrowed.id)
      .map((n) => n.map_position);
    const hasConflict = (
      pos:      { x: number; y: number },
      existing: Array<{ x: number; y: number }>,
      minDist = 20
    ): boolean =>
      existing.some(
        (p) =>
          Math.abs(p.x - pos.x) < minDist &&
          Math.abs(p.y - pos.y) < minDist
      );
    const adjustedPos = { ...bibleNarrowed.grid_centre };
    let nudges = 0;
    while (hasConflict(adjustedPos, existingPositions) && nudges < 50) {
      adjustedPos.x += 12;
      if (adjustedPos.x > 80) {
        adjustedPos.x = -40;
        adjustedPos.y += 12;
      }
      nudges++;
    }
    if (nudges > 0) {
      console.log(
        "[apply-regional-bible] map_position nudged to avoid overlap:",
        { original: bibleNarrowed.grid_centre, adjusted: adjustedPos, nudges }
      );
    }

    mergedNodes[bibleNarrowed.id] = {
      id:            bibleNarrowed.id,
      name:          bibleNarrowed.name,
      type:          "zone",
      category:      bibleNarrowed.type,
      zone_id:       bibleNarrowed.id,
      is_expandable: true,
      connections:   regionConnections,
      npc_ids:       [],
      item_ids:      [],
      asset_id:      `location_${bibleNarrowed.id}`,
      discovered:    true,
      map_position:  adjustedPos,
    };
    // Wire the settlement back to the region zone so the player can
    // step onto the open-world layer from town.
    const settlement = mergedNodes[startingNodeId];
    if (settlement && !settlement.connections.includes(bibleNarrowed.id)) {
      mergedNodes[startingNodeId] = {
        ...settlement,
        connections: [...settlement.connections, bibleNarrowed.id],
      };
    }

    // World_asset for the region zone — the narrator needs a Tier 1
    // location asset to read when the player arrives in the
    // open-world layer.
    const regionZoneAsset = regionZoneToAsset(
      bibleNarrowed.id,
      bibleNarrowed.name,
      bibleNarrowed.type,
      bibleNarrowed.atmosphere,
      sessionId
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
      { onConflict: "session_id,asset_id", ignoreDuplicates: true }
    );
    if (regionAssetErr) {
      console.error(
        "[apply-regional-bible] region-zone world_asset write failed for",
        regionZoneAsset.id,
        regionAssetErr
      );
    }
  }

  // ── 6. Wire the bidirectional link from the origin node ────────────────────
  const originNode = mergedNodes[originNodeId];
  if (originNode) {
    const filteredConnections = originNode.connections.filter(
      (c) => c !== bibleNarrowed.id // strip the stale outline link
    );
    if (!filteredConnections.includes(startingNodeId)) {
      filteredConnections.push(startingNodeId);
    }
    mergedNodes[originNodeId] = {
      ...originNode,
      connections: filteredConnections,
    };
  }
  const settlementMerged = mergedNodes[startingNodeId];
  if (settlementMerged && !settlementMerged.connections.includes(originNodeId)) {
    mergedNodes[startingNodeId] = {
      ...settlementMerged,
      connections: [...settlementMerged.connections, originNodeId],
    };
  }

  // Architecture CHANGE 1 — the player lands at the geographic region
  // zone (is_expandable=true), NOT the settlement hub. The settlement
  // is reachable via ← BACK from the region zone. When the bible
  // collapsed both ids into one (legacy single-tier shape), the region
  // zone IS the settlement node so this falls back gracefully.
  const regionZoneId = isSameAsSettlement ? startingNodeId : bibleNarrowed.id;

  const updatedWorldGraph: WorldGraph = {
    ...existingGraph,
    nodes:           mergedNodes,
    current_node_id: regionZoneId,
  };

  // ── 7. Audit Issue K fix — persist patched master_state + world_graph ──────
  // Mirror apply-world-bible's persistence pattern so a reload mid-region
  // expansion never loses the new region. The master_state copy includes:
  //   - the merged world_graph with the new region's nodes
  //   - current_location_id / current_node_id pointing at the region zone
  //   - visited_locations including the region zone
  //   - location_status: ARRIVING (the player just crossed the border)
  const patchedMasterState: MasterState = {
    ...currentMasterState,
    world_state: {
      ...currentMasterState.world_state,
      current_location_id: regionZoneId,
      current_node_id:     regionZoneId,
      visited_locations: Array.from(
        new Set([
          ...(currentMasterState.world_state.visited_locations ?? []),
          regionZoneId,
        ])
      ),
      location_status: LocationStatus.ARRIVING,
    },
    world_graph: updatedWorldGraph,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: persistErr } = await (supabase.from("game_sessions") as any)
    .update({
      master_state: patchedMasterState as unknown as Json,
      world_graph:  updatedWorldGraph  as unknown as Json,
    })
    .eq("id", sessionId)
    .eq("user_id", user.id);
  if (persistErr) {
    console.error("[apply-regional-bible] master_state persist failed", persistErr);
    // Non-fatal — assets and the response payload are still useful, but
    // surface the failure so the client can decide whether to retry.
  }

  console.log(
    `[apply-regional-bible] Applied: ${bibleNarrowed.name}, ` +
    `${bibleNarrowed.locations.length} locations, ` +
    `${bibleNarrowed.npcs.length} NPCs, ` +
    `${objectAssets.length} interactable objects.`
  );

  return NextResponse.json({
    success:             true,
    /** Settlement hub node id (intra-region down-card target). */
    starting_node_id:    startingNodeId,
    /** Geographic region zone node id — the player lands here. Equals
     *  starting_node_id only in the legacy single-tier shape. */
    region_zone_id:      regionZoneId,
    updated_world_graph: updatedWorldGraph,
    location_count:      bibleNarrowed.locations.length,
    npc_count:           bibleNarrowed.npcs.length,
  });
}
