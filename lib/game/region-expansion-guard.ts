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
