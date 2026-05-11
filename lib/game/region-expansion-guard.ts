import type {
  MasterState,
  RegionBible,
  WorldGraph,
  WorldNode,
} from "@/types/game";

/**
 * V8.33 — pure predicates that decide whether a region is already
 * expanded. Extracted so the same semantic gates two call sites:
 *
 *   1. useGameLoop step 4d: FIX 1 — reclassify "WORLD_EXPLORE to a
 *      known region" as GRAPH_NAVIGATE; skip apply-regional-bible.
 *   2. apply-regional-bible: FIX 2 — idempotence guard short-circuits
 *      a redundant re-apply.
 *
 * Kept as standalone pure functions (no Supabase, no React) so jest
 * can exercise them with minimal MasterState slices.
 */

type StateSlice = Pick<MasterState, "metadata" | "world_graph">;

/**
 * The region identified by `regionId` is already fully expanded
 * when:
 *   - its RegionBible is in metadata.region_bibles
 *   - its graph node exists AND discovered === true
 *
 * Used by useGameLoop step 4d (FIX 1) before firing apply-regional-bible.
 */
export function isRegionAlreadyExpanded(
  state:    StateSlice,
  regionId: string
): boolean {
  if (!state.metadata?.region_bibles?.[regionId]) return false;
  const node: WorldNode | undefined = state.world_graph?.nodes?.[regionId];
  if (!node) return false;
  return node.discovered === true;
}

/**
 * Stronger check for the apply-regional-bible idempotence guard
 * (FIX 2). Bible is fully applied when:
 *   - its RegionBible is in metadata.region_bibles
 *   - every location in bible.locations + bible.region_locations
 *     is already in world_graph.nodes
 *
 * The discovered flag is NOT checked here because apply-regional-bible
 * runs even on partial-apply recovery: if the bible is in metadata
 * but some node is missing, the route should re-apply to fill the gap.
 */
export function isApplyRegionalBibleRedundant(
  state: StateSlice,
  bible: RegionBible
): boolean {
  if (!state.metadata?.region_bibles?.[bible.id]) return false;
  const graph: WorldGraph | undefined = state.world_graph;
  const nodeIds = new Set(Object.keys(graph?.nodes ?? {}));
  if (!bible.locations.every((l) => nodeIds.has(l.id))) return false;
  const regionLocs = bible.region_locations ?? [];
  if (!regionLocs.every((l) => nodeIds.has(l.id))) return false;
  return true;
}

/**
 * Merge a freshly-built WorldNode against an existing graph entry
 * for the same id, preserving the player-state `discovered` flag.
 * The bible authoritatively overwrites content fields (atmosphere,
 * connections, encounter_chance, etc.); only `discovered` is
 * carried forward when it was already true (FIX 3).
 *
 * Returns the input `fresh` unchanged when there is no existing
 * node OR when the existing node was undiscovered.
 */
export function mergeNodePreservingDiscovered(
  existing: WorldNode | undefined,
  fresh:    WorldNode
): WorldNode {
  if (!existing) return fresh;
  if (existing.discovered === true && fresh.discovered !== true) {
    return { ...fresh, discovered: true };
  }
  return fresh;
}

/**
 * Day 20.4.3 Region Expansion Hotfix — pure helper that detects a
 * region bible whose settlement location collapsed onto the region
 * id (a structural side effect of an older generate-regional-bible
 * prompt template that hardcoded `locations[0].id = outline.id`).
 * When the collapse is detected, mutate the bible IN PLACE so the
 * settlement location gets a distinct slug
 * (`${bible.settlement_id}` if present and distinct, else
 * `${bible.id}_settlement`), and re-point every reference
 * (sub-location parent_location_id + connections, region_location
 * connections, NPC home_location_id, exits from_location_id) at the
 * new slug.
 *
 * Returns an object describing what was done so the route can emit
 * the V8.39-style diagnostic log line:
 *   - { collapsed: false }            — no repair needed
 *   - { collapsed: true, oldId, newId } — repair applied
 *
 * Per V8.40 rule 71, this lives in a pure module so jest can
 * exercise it without spinning up the Supabase-bound route handler.
 */
export type SplitResult =
  | { collapsed: false }
  | { collapsed: true; oldSettlementId: string; newSettlementId: string };

export function splitConflatedRegionSettlement(bible: RegionBible): SplitResult {
  const collapsedSettlement = bible.locations.find(
    (l) => l.is_settlement_node === true && l.id === bible.id
  );
  if (!collapsedSettlement) return { collapsed: false };

  const oldSettlementId = collapsedSettlement.id; // === bible.id
  const newSettlementId =
    bible.settlement_id && bible.settlement_id !== bible.id
      ? bible.settlement_id
      : `${bible.id}_settlement`;

  // 1. Rename the settlement location's id.
  collapsedSettlement.id = newSettlementId;
  // 2. Stamp the canonical bible.settlement_id so downstream consumers
  //    and the persisted region_bibles entry reflect the corrected shape.
  bible.settlement_id = newSettlementId;
  if (!bible.settlement_name) {
    bible.settlement_name = collapsedSettlement.name;
  }
  // 3. Re-point sub-locations: parent_location_id + connections.
  for (const loc of bible.locations) {
    if (loc.id === newSettlementId) continue;
    if (loc.parent_location_id === oldSettlementId) {
      loc.parent_location_id = newSettlementId;
    }
    loc.connections = loc.connections.map(
      (c) => (c === oldSettlementId ? newSettlementId : c)
    );
  }
  // 4. Re-point region_locations connections. They structurally link
  //    to the settlement hub, not the region zone.
  for (const loc of bible.region_locations ?? []) {
    loc.connections = loc.connections.map(
      (c) => (c === oldSettlementId ? newSettlementId : c)
    );
  }
  // 5. Re-point NPCs' home_location_id.
  for (const npc of bible.npcs) {
    if (npc.home_location_id === oldSettlementId) {
      npc.home_location_id = newSettlementId;
    }
  }
  // 6. Re-point exits.from_location_id (RegionExit shape).
  for (const exit of bible.exits ?? []) {
    if (exit.from_location_id === oldSettlementId) {
      exit.from_location_id = newSettlementId;
    }
  }

  return { collapsed: true, oldSettlementId, newSettlementId };
}
