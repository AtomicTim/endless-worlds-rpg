/**
 * Polish Round 4c — rule 81.
 *
 * chooseTierForNode extracted as a pure function so WorldMap.tsx and unit
 * tests can both consume it without pulling in React or the map renderers.
 *
 * Tier 1 = World, 2 = Region, 3 = Local.
 *
 * Logic mirrors the former chooseInitialTier function (WorldMap.tsx) which
 * previously only ran on mount. Rule 81 wires this into the navigation
 * useEffect so the map tier auto-switches on EVERY node arrival — not just
 * cross-region arrivals — using the same mapping rules.
 *
 * Rule 81: region zone → Region (2), settlement / sub-location / other → Local (3).
 */

import type { WorldNode } from "@/types/game";

/** Numeric tier identifier. 1 = World, 2 = Region, 3 = Local.
 *  Structurally identical to the Tier type in components/game/map/renderers. */
export type MapTier = 1 | 2 | 3;

/**
 * Map the player's current WorldNode to the most contextually useful map
 * tier.
 *
 *   Geographic region zone (is_expandable + self-zoned) → Region (2):
 *     the region tier shows all landmarks and sub-locations the player
 *     can step into — exactly the right view when standing at a new
 *     area's entry point.
 *
 *   Sub-location (type === "sub_location") → Local (3):
 *     only the interior itself is relevant.
 *
 *   Settlement hub, dungeon, wilderness zone, or unknown → Local (3):
 *     nearby sub-locations and NPCs are what the player wants to see.
 *
 *   Undefined node → Region (2) as a safe fallback.
 */
export function chooseTierForNode(node: WorldNode | undefined): MapTier {
  if (!node) return 2;
  if (node.type === "sub_location") return 3;
  if (node.is_expandable === true && node.zone_id === node.id) return 2;
  return 3;
}
