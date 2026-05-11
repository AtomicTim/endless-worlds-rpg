/**
 * Day 20.4.4 — pure graph-building logic extracted from
 * app/api/game/apply-regional-bible/route.ts so the node-construction
 * pipeline can be unit-tested without a running Supabase instance.
 *
 * Per V8.40 rule 71: routing helpers and lookup keys must have
 * integration tests against real data. This module makes those tests
 * possible without mocking the entire Next.js route handler.
 *
 * The route handler still owns:
 *   • world_asset upserts (Supabase)
 *   • master_state persistence
 *   • session-scoped diagnostic logs (sessionId)
 *   • region zone world_asset write
 *
 * This module owns the WorldNode construction and graph merging —
 * everything that determines which nodes exist, what they're named,
 * and how they connect.
 */

import { mergeNodePreservingDiscovered } from "./region-expansion-guard";
import type { RegionBible, WorldGraph, WorldNode } from "@/types/game";

export interface RegionGraphBuildResult {
  /** Merged node map — existing graph nodes + all new region nodes. */
  mergedNodes:    Record<string, WorldNode>;
  /** Settlement hub node id (is_settlement_node=true, main town entry). */
  startingNodeId: string;
  /** Geographic region zone node id. Player lands here on cross-region
   *  arrival. Equals startingNodeId only in the legacy single-tier shape. */
  regionZoneId:   string;
}

type Pos = { x: number; y: number };

const isValidPos = (p: unknown): p is Pos =>
  !!p &&
  typeof (p as Pos).x === "number" && Number.isFinite((p as Pos).x) &&
  typeof (p as Pos).y === "number" && Number.isFinite((p as Pos).y);

function hasConflict(pos: Pos, existing: Pos[], minDist = 20): boolean {
  if (!isValidPos(pos)) return false;
  return existing.some((p) => {
    if (!isValidPos(p)) return false;
    return (
      Math.abs(p.x - pos.x) < minDist &&
      Math.abs(p.y - pos.y) < minDist
    );
  });
}

/**
 * Build the WorldNode map for a freshly-applied RegionBible.
 *
 * Preconditions (caller must satisfy before passing bible here):
 *   1. `bible` has already gone through `splitConflatedRegionSettlement`.
 *   2. `bible.enemies` has been validated (warn-don't-500 pass).
 *   3. encounter_rosters have been scrubbed.
 *
 * Postconditions:
 *   - result.mergedNodes contains the existing graph nodes PLUS all
 *     new nodes from the bible.
 *   - The geographic region zone node (id=bible.id) is self-zoned
 *     (zone_id=bible.id, is_expandable=true) and its connections
 *     include the settlement id.
 *   - The settlement node (is_settlement_node=true) has zone_id=bible.id
 *     and its connections include the region zone id.
 *   - Sub-location nodes use WorldNode.name = loc.name (display name).
 *   - region_locations are bidirectionally stitched to the settlement.
 */
export function buildRegionGraphNodes(
  bible:         RegionBible,
  existingGraph: WorldGraph,
  originNodeId:  string,
): RegionGraphBuildResult {
  const regionLocations = bible.region_locations ?? [];
  const allLocations    = [...bible.locations, ...regionLocations];

  // ── 3. Resolve settlement ──────────────────────────────────────────────────
  const settlementNode    = bible.locations.find((l) => l.is_settlement_node);
  const startingNodeId    = settlementNode?.id ?? bible.id;
  const settlementIdForZone = startingNodeId;

  // ── 4. Validate NPC + connection id sets ──────────────────────────────────
  const validNpcIds = new Set(bible.npcs.map((n) => n.id));
  const validLocationIds = new Set([
    ...allLocations.map((l) => l.id),
    bible.id,
    ...Object.keys(existingGraph.nodes),
  ]);

  const newNodes: Record<string, WorldNode> = {};

  // ── 4a. Settlement-side locations ─────────────────────────────────────────
  for (const loc of bible.locations) {
    const filteredNpcIds = loc.npc_ids.filter((id) => validNpcIds.has(id));
    let finalNpcIds = filteredNpcIds;
    if (filteredNpcIds.length === 0) {
      const homeNpcs = bible.npcs
        .filter((n) => n.home_location_id === loc.id)
        .map((n) => n.id);
      if (homeNpcs.length > 0) finalNpcIds = homeNpcs;
    }

    const validConnections: string[] = [];
    for (const id of loc.connections) {
      if (validLocationIds.has(id)) validConnections.push(id);
    }

    let zoneId: string;
    if (loc.is_interior && loc.parent_location_id) {
      zoneId = loc.parent_location_id;
    } else if (loc.is_settlement_node) {
      zoneId = bible.id;
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
      discovered:         loc.is_settlement_node,
      map_position:       loc.grid_position,
      is_settlement_node: loc.is_settlement_node === true,
      encounter_chance:   typeof loc.encounter_chance === "number"
                            ? loc.encounter_chance : undefined,
      encounter_roster:   Array.isArray(loc.encounter_roster) && loc.encounter_roster.length > 0
                            ? [...loc.encounter_roster] : undefined,
      is_boss_room:       loc.is_boss_room === true ? true : undefined,
    };
  }

  // ── 4b. Standalone region_locations ──────────────────────────────────────
  for (const loc of regionLocations) {
    const filteredNpcIds = loc.npc_ids.filter((id) => validNpcIds.has(id));
    let finalNpcIds = filteredNpcIds;
    if (filteredNpcIds.length === 0) {
      const homeNpcs = bible.npcs
        .filter((n) => n.home_location_id === loc.id)
        .map((n) => n.id);
      if (homeNpcs.length > 0) finalNpcIds = homeNpcs;
    }
    const validConnections: string[] = [];
    for (const id of loc.connections) {
      if (validLocationIds.has(id)) validConnections.push(id);
    }
    if (!validConnections.includes(settlementIdForZone)) {
      validConnections.push(settlementIdForZone);
    }

    newNodes[loc.id] = {
      id:                 loc.id,
      name:               loc.name,
      type:               "zone",
      category:           loc.type,
      zone_id:            bible.id,
      is_expandable:      false,
      connections:        validConnections,
      npc_ids:            finalNpcIds,
      item_ids:           loc.objects.map((o) => `item_${o.id}`),
      asset_id:           `location_${loc.id}`,
      discovered:         false,
      map_position:       loc.grid_position,
      is_settlement_node: false,
      encounter_chance:   typeof loc.encounter_chance === "number"
                            ? loc.encounter_chance : undefined,
      encounter_roster:   Array.isArray(loc.encounter_roster) && loc.encounter_roster.length > 0
                            ? [...loc.encounter_roster] : undefined,
      is_boss_room:       loc.is_boss_room === true ? true : undefined,
    };
  }

  // ── 4b-2. Bidirectional region_location ↔ settlement stitch ──────────────
  for (const r of regionLocations) {
    const rNode = newNodes[r.id];
    if (!rNode) continue;
    if (!rNode.connections.includes(settlementIdForZone)) {
      newNodes[r.id] = {
        ...rNode,
        connections: [...rNode.connections, settlementIdForZone],
      };
    }
    const settlement = newNodes[settlementIdForZone];
    if (settlement && !settlement.connections.includes(r.id)) {
      newNodes[settlementIdForZone] = {
        ...settlement,
        connections: [...settlement.connections, r.id],
      };
    }
  }

  // ── 5. Merge into existing graph ──────────────────────────────────────────
  const mergedNodes: Record<string, WorldNode> = { ...existingGraph.nodes };
  if (mergedNodes[bible.id] && !newNodes[bible.id]) {
    delete mergedNodes[bible.id];
  }
  for (const [id, node] of Object.entries(newNodes)) {
    mergedNodes[id] = mergeNodePreservingDiscovered(mergedNodes[id], node);
  }

  const isSameAsSettlement = bible.id === startingNodeId;

  // Resolve the origin's root region zone id.
  const originRegionZoneId = (() => {
    let cur = mergedNodes[originNodeId];
    const vis = new Set<string>();
    while (cur && !vis.has(cur.id)) {
      vis.add(cur.id);
      if (!cur.zone_id || cur.zone_id === cur.id) return cur.id;
      cur = mergedNodes[cur.zone_id];
    }
    return originNodeId;
  })();

  if (!isSameAsSettlement && !mergedNodes[bible.id]) {
    // Build region zone connections: settlement + origin + region_locations.
    const regionConnections: string[] = [startingNodeId];
    if (originRegionZoneId && originRegionZoneId !== bible.id) {
      regionConnections.push(originRegionZoneId);
    }
    for (const r of regionLocations) {
      if (!regionConnections.includes(r.id)) regionConnections.push(r.id);
    }

    // Grid-position collision avoidance (mirrors route handler).
    const existingPositions: Pos[] = [];
    for (const n of Object.values(existingGraph.nodes)) {
      if (n.is_expandable !== true) continue;
      if (n.id === bible.id) continue;
      if (!isValidPos(n.map_position)) continue;
      existingPositions.push(n.map_position);
    }
    const seedPos: Pos = isValidPos(bible.grid_centre)
      ? { x: bible.grid_centre.x, y: bible.grid_centre.y }
      : { x: 0, y: 0 };
    const adjustedPos: Pos = { ...seedPos };
    let nudges = 0;
    while (hasConflict(adjustedPos, existingPositions) && nudges < 50) {
      adjustedPos.x += 12;
      if (adjustedPos.x > 80) { adjustedPos.x = -40; adjustedPos.y += 12; }
      nudges++;
    }

    mergedNodes[bible.id] = {
      id:            bible.id,
      name:          bible.name,
      type:          "zone",
      category:      bible.type,
      zone_id:       bible.id,
      is_expandable: true,
      connections:   regionConnections,
      npc_ids:       [],
      item_ids:      [],
      asset_id:      `location_${bible.id}`,
      discovered:    true,
      map_position:  adjustedPos,
    };

    // Explicit bidirectional stitch guarantee (Day 20.4.4).
    const rzNode  = mergedNodes[bible.id];
    const stlNode = mergedNodes[startingNodeId];
    if (rzNode && !rzNode.connections.includes(startingNodeId)) {
      mergedNodes[bible.id] = {
        ...rzNode,
        connections: [...rzNode.connections, startingNodeId],
      };
    }
    if (stlNode && !stlNode.connections.includes(bible.id)) {
      mergedNodes[startingNodeId] = {
        ...stlNode,
        connections: [...stlNode.connections, bible.id],
      };
    }
  }

  // ── 6. Wire the origin node ────────────────────────────────────────────────
  const originNode = mergedNodes[originNodeId];
  if (originNode) {
    const filteredConnections = originNode.connections.filter(
      (c) => c !== bible.id
    );
    if (!filteredConnections.includes(startingNodeId)) {
      filteredConnections.push(startingNodeId);
    }
    if (!isSameAsSettlement && !filteredConnections.includes(bible.id)) {
      filteredConnections.push(bible.id);
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

  const regionZoneId = isSameAsSettlement ? startingNodeId : bible.id;
  return { mergedNodes, startingNodeId, regionZoneId };
}
