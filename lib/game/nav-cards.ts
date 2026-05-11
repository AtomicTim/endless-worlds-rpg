/**
 * Polish Round 4a — pure functions for the navigation bar's typed card
 * system. Extracted from components/game/NavigationBar.tsx so the card
 * builder and the direction grouper can be unit-tested without spinning
 * up React rendering. NavigationBar still owns presentation; this file
 * owns logic.
 *
 * Card grammar (left to right):
 *   [← BACK] [→ DEEPER...] [↑ EXIT] [◆ PEER...] [◇ UNDISCOVERED...]
 *
 * Routing rules:
 *   Sub-location  → ← back to hub ONLY
 *   Settlement hub → → deeper + ↑ exit to region zone
 *   Region zone   → → deeper (settlement hub) + ← back + ◆ known + ◇ undiscovered
 *   Dungeon       → ← back to region zone ONLY
 *
 * Day 20.4.4 — region zone DEEPER rule: the settlement hub is always
 * present as a DEEPER card at the region zone so the player has a direct
 * path into the settlement without needing to visit a sub-location first.
 * Symmetric with settlement → EXIT to region zone (TYPE C). Previously
 * the settlement was absent from all four card types when the player
 * landed at a freshly-expanded region zone via cross-region navigation.
 *
 * Polish 4a TASK 3a — at a region zone, the ← BACK card prefers the
 * PREVIOUS region's settlement when the player just arrived from a
 * different region. This keeps "back" meaning "where you came from"
 * instead of "into a settlement you haven't been to." We read the
 * previous node from `masterState.navigation_trail` (V8.32+ — last 5
 * visited node ids, most recent at end; trail[-2] is the prior node).
 */

import type { MasterState, WorldGraph, WorldNode } from "@/types/game";

export type CardKind = "back" | "deeper" | "exit" | "peer-known" | "peer-unknown";

/** Polish 4a TASK 2 — destination tier drives the card's accent color
 *  (border + title + leading icon). Computed by `tierOfNode` and stored
 *  on every card so the renderer doesn't need world_graph access. */
export type CardTier = "region" | "settlement" | "sub-location" | "dungeon";

/** Polish 4a TASK 1 — direction grouping bucket. EXIT folds into BACK
 *  so the player sees one combined "going back / leaving" row. */
export type CardDirection = "back" | "deeper" | "peer" | "undiscovered";

export interface Card {
  /** Stable key for React. */
  key:        string;
  kind:       CardKind;
  /** Node id (or adjacent region outline id) handed to onNavigate. */
  targetId:   string;
  /** Primary label — destination name, ALL CAPS. */
  name:       string;
  /** Secondary label — category / "EXIT TO REGION" / etc., ALL CAPS. */
  sublabel:   string;
  /** Whether the player has already visited this node. */
  discovered: boolean;
  /** Destination tier — drives color in the renderer. */
  tier:       CardTier;
}

/**
 * Polish 4a TASK 2 — classify a WorldNode by tier for nav card
 * coloring. Mirrors the canonical predicates used elsewhere
 * (NavigationBar's isAtRegionZone branch, WorldMap's region-zone
 * detection) so a single source of truth keeps map + nav consistent.
 *
 *   region       — geographic region zone (is_expandable && self-zoned)
 *   settlement   — settlement hub (is_settlement_node)
 *   sub-location — interior building (type === "sub_location")
 *   dungeon      — any other standalone zone (the everything-else case)
 */
export function tierOfNode(node: WorldNode): CardTier {
  if (node.is_expandable === true && node.zone_id === node.id) return "region";
  if (node.is_settlement_node === true) return "settlement";
  if (node.type === "sub_location") return "sub-location";
  return "dungeon";
}

/** Convert a card's kind to its grouping bucket. EXIT cards fold into
 *  the BACK group per TASK 1. */
export function directionOfCard(card: Card): CardDirection {
  switch (card.kind) {
    case "back":         return "back";
    case "exit":         return "back";  // folded into BACK group
    case "deeper":       return "deeper";
    case "peer-known":   return "peer";
    case "peer-unknown": return "undiscovered";
  }
}

/**
 * Polish 4a TASK 1 — group an ordered card list into 4 direction
 * buckets while preserving within-group order. Empty groups stay as
 * empty arrays so the renderer can decide whether to render the row.
 */
export function groupCardsByDirection(cards: readonly Card[]): Record<CardDirection, Card[]> {
  const out: Record<CardDirection, Card[]> = {
    back:         [],
    deeper:       [],
    peer:         [],
    undiscovered: [],
  };
  for (const c of cards) {
    out[directionOfCard(c)].push(c);
  }
  return out;
}

function typeLabel(node: WorldNode): string {
  if (node.is_expandable === true && node.zone_id === node.id) return "REGION";
  const raw = (node.category ?? node.type ?? "").toString();
  return raw.toUpperCase();
}

/**
 * Helper: walk up zone_id from a node until self-zoned, return that
 * region. Returns null when the chain breaks or no region resolves.
 */
function regionOfNode(
  node: WorldNode | undefined,
  graph: WorldGraph,
): WorldNode | null {
  if (!node) return null;
  let cur: WorldNode | undefined = node;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    if (cur.is_expandable === true && cur.zone_id === cur.id) return cur;
    cur = graph.nodes[cur.zone_id];
  }
  return null;
}

/**
 * Find the previous node id from the navigation trail. Returns the
 * second-to-last entry (the node visited immediately before the
 * current one). Returns null when the trail is too short.
 *
 * `masterState.navigation_trail` is maintained by useGameLoop's step
 * 7c-2 — last 5 visited node ids, most recent at end.
 */
export function previousNodeIdFromTrail(masterState: MasterState | null): string | null {
  const trail = masterState?.navigation_trail;
  if (!Array.isArray(trail) || trail.length < 2) return null;
  return trail[trail.length - 2] ?? null;
}

/**
 * Build the ordered nav card list for the player's current location.
 * Pure function — no React, no store reads.
 *
 * `masterState.navigation_trail` is used to detect cross-region
 * arrivals (TASK 3a). When the player just arrived at a region zone
 * from a different region, the BACK card targets the previous
 * region's settlement instead of pointing INTO the new region's
 * unvisited settlement.
 */
export function buildCards(
  worldGraph: WorldGraph | undefined,
  masterState: MasterState | null,
): Card[] {
  if (!worldGraph) return [];
  const current = worldGraph.nodes[worldGraph.current_node_id];
  if (!current) return [];

  const isAtRegionZone =
    current.type === "zone" &&
    current.is_expandable === true &&
    current.zone_id === current.id;

  const isAtSettlementHub =
    current.type === "zone" &&
    current.is_settlement_node === true;

  const isAtSubLocation = current.type === "sub_location";

  const isAtDungeon =
    current.type === "zone" &&
    current.is_settlement_node !== true &&
    current.is_expandable === false;

  // Resolve the settlement hub for this region.
  const settlementHub: WorldNode | null = (() => {
    if (isAtSubLocation) {
      return worldGraph.nodes[current.zone_id] ?? null;
    }
    if (isAtSettlementHub) return current;
    const regionId = isAtRegionZone ? current.id : current.zone_id;
    return (
      Object.values(worldGraph.nodes).find(
        (n) => n.zone_id === regionId && n.is_settlement_node === true
      ) ?? null
    );
  })();

  // Resolve the geographic region zone for this location.
  const regionZone: WorldNode | null = (() => {
    if (isAtRegionZone) return current;
    const direct = current.zone_id ? worldGraph.nodes[current.zone_id] : null;
    if (direct?.is_expandable && direct.zone_id === direct.id) return direct;
    if (direct?.zone_id) {
      const grandparent = worldGraph.nodes[direct.zone_id];
      if (grandparent?.is_expandable && grandparent.zone_id === grandparent.id) {
        return grandparent;
      }
    }
    return null;
  })();

  // ── TYPE A — back ────────────────────────────────────────────────────────
  const backCards: Card[] = [];
  if (isAtSubLocation) {
    const parent = worldGraph.nodes[current.zone_id];
    if (parent && parent.id !== current.id) {
      backCards.push({
        key:        `back-${parent.id}`,
        kind:       "back",
        targetId:   parent.id,
        name:       parent.name.toUpperCase(),
        sublabel:   typeLabel(parent),
        discovered: parent.discovered,
        tier:       tierOfNode(parent),
      });
    }
  } else if (isAtDungeon) {
    const parent = worldGraph.nodes[current.zone_id];
    if (parent && parent.id !== current.id) {
      backCards.push({
        key:        `back-${parent.id}`,
        kind:       "back",
        targetId:   parent.id,
        name:       parent.name.toUpperCase(),
        sublabel:   typeLabel(parent),
        discovered: parent.discovered,
        tier:       tierOfNode(parent),
      });
    }
  } else if (isAtRegionZone) {
    // Polish 4a TASK 3a — when the player just crossed regions, BACK
    // routes to the previous region (where they came from), not the
    // current region's unvisited settlement. We detect cross-region
    // arrival by comparing the geographic region of the previous node
    // (from navigation_trail) against the current region.
    const prevNodeId = previousNodeIdFromTrail(masterState);
    const prevNode   = prevNodeId ? worldGraph.nodes[prevNodeId] : undefined;
    const prevRegion = regionOfNode(prevNode, worldGraph);
    const crossRegion =
      !!prevNode && !!prevRegion && prevRegion.id !== current.id;
    if (crossRegion && prevNode && prevRegion) {
      // Prefer the previous region's settlement hub when one exists.
      // Falls back to the raw previous node when no settlement resolves.
      const prevSettlement =
        Object.values(worldGraph.nodes).find(
          (n) => n.zone_id === prevRegion.id && n.is_settlement_node === true
        ) ?? prevNode;
      backCards.push({
        key:        `back-${prevSettlement.id}`,
        kind:       "back",
        targetId:   prevSettlement.id,
        name:       prevSettlement.name.toUpperCase(),
        sublabel:   typeLabel(prevSettlement),
        discovered: prevSettlement.discovered,
        tier:       tierOfNode(prevSettlement),
      });
    } else if (settlementHub) {
      backCards.push({
        key:        `back-${settlementHub.id}`,
        kind:       "back",
        targetId:   settlementHub.id,
        name:       settlementHub.name.toUpperCase(),
        sublabel:   typeLabel(settlementHub),
        discovered: settlementHub.discovered,
        tier:       tierOfNode(settlementHub),
      });
    }
  }

  // ── TYPE B — deeper ──────────────────────────────────────────────────────
  const deeperCards: Card[] = [];
  if (isAtRegionZone) {
    // Day 20.4.4 — at a geographic region zone the settlement hub is the
    // gateway into the populated area. Show it as a DEEPER card so the
    // player always has a direct path in. Symmetric with settlement → EXIT
    // to region zone (TYPE C). Uses the already-resolved `settlementHub`
    // which scans for zone_id === current.id && is_settlement_node === true.
    if (settlementHub) {
      deeperCards.push({
        key:        `deeper-${settlementHub.id}`,
        kind:       "deeper",
        targetId:   settlementHub.id,
        name:       settlementHub.name.toUpperCase(),
        sublabel:   typeLabel(settlementHub),
        discovered: settlementHub.discovered,
        tier:       tierOfNode(settlementHub),
      });
    }
  } else if (isAtSettlementHub) {
    for (const id of current.connections) {
      const node = worldGraph.nodes[id];
      if (!node) continue;
      if (node.type !== "sub_location") continue;
      if (node.zone_id !== current.id) continue;
      deeperCards.push({
        key:        `deeper-${node.id}`,
        kind:       "deeper",
        targetId:   node.id,
        name:       node.name.toUpperCase(),
        sublabel:   typeLabel(node),
        discovered: node.discovered,
        tier:       tierOfNode(node),
      });
    }
  } else if (isAtDungeon) {
    for (const id of current.connections) {
      const node = worldGraph.nodes[id];
      if (!node) continue;
      if (node.type !== "sub_location") continue;
      if (node.zone_id !== current.id) continue;
      deeperCards.push({
        key:        `deeper-${node.id}`,
        kind:       "deeper",
        targetId:   node.id,
        name:       node.name.toUpperCase(),
        sublabel:   typeLabel(node),
        discovered: node.discovered,
        tier:       tierOfNode(node),
      });
    }
  }

  // ── TYPE C — exit ────────────────────────────────────────────────────────
  const exitCards: Card[] = [];
  if (isAtSettlementHub && regionZone) {
    exitCards.push({
      key:        `exit-${regionZone.id}`,
      kind:       "exit",
      targetId:   regionZone.id,
      name:       regionZone.name.toUpperCase(),
      sublabel:   "EXIT TO REGION",
      discovered: regionZone.discovered,
      tier:       tierOfNode(regionZone),
    });
  }

  // ── TYPE D — peer (region_locations + adjacent regions) ─────────────────
  const peerCards: Card[] = [];
  if (isAtRegionZone) {
    // D1 — known region_locations under this region (dungeons,
    // wilderness, shrines).
    for (const node of Object.values(worldGraph.nodes)) {
      if (node.id === current.id) continue;
      if (node.zone_id !== current.id) continue;
      if (node.is_settlement_node === true) continue;
      if (node.type !== "zone") continue;
      if (node.is_expandable === true) continue;
      peerCards.push({
        key:        `peer-known-${node.id}`,
        kind:       "peer-known",
        targetId:   node.id,
        name:       node.name.toUpperCase(),
        sublabel:   typeLabel(node),
        discovered: node.discovered,
        tier:       tierOfNode(node),
      });
    }

    // D2 — adjacent regions.
    // For the STARTING REGION: use WorldBible.adjacent_regions.
    // For EXPANDED REGIONS: scan graph connections for is_expandable
    // self-zoned nodes (apply-regional-bible writes the origin region
    // zone id into the new region zone's connections).
    const wb           = masterState?.metadata.world_bible;
    const knownPeerIds = new Set(peerCards.map((c) => c.targetId));
    const seen         = new Set<string>();
    const isStartingRegion = !!wb && wb.starting_region.id === current.id;

    if (isStartingRegion) {
      for (const r of wb?.adjacent_regions ?? []) {
        if (r.id === current.id) continue;
        if (knownPeerIds.has(r.id)) continue;
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        const graphNode  = worldGraph.nodes[r.id];
        const isExpanded = !!graphNode && graphNode.discovered === true;
        peerCards.push({
          key:        isExpanded ? `peer-known-${r.id}` : `peer-unknown-${r.id}`,
          kind:       isExpanded ? "peer-known" : "peer-unknown",
          targetId:   r.id,
          name:       r.name.toUpperCase(),
          sublabel:   isExpanded ? "REGION" : "UNDISCOVERED REGION",
          discovered: isExpanded,
          tier:       graphNode ? tierOfNode(graphNode) : "region",
        });
      }
    } else {
      for (const connId of current.connections) {
        const connNode = worldGraph.nodes[connId];
        if (!connNode) continue;
        if (connNode.is_expandable !== true) continue;
        if (connNode.zone_id !== connNode.id) continue;
        if (connNode.id === current.id) continue;
        if (knownPeerIds.has(connNode.id)) continue;
        if (seen.has(connNode.id)) continue;
        seen.add(connNode.id);
        const isExpanded = connNode.discovered === true;
        peerCards.push({
          key:        isExpanded ? `peer-known-${connNode.id}` : `peer-unknown-${connNode.id}`,
          kind:       isExpanded ? "peer-known" : "peer-unknown",
          targetId:   connNode.id,
          name:       connNode.name.toUpperCase(),
          sublabel:   isExpanded ? "REGION" : "UNDISCOVERED REGION",
          discovered: isExpanded,
          tier:       tierOfNode(connNode),
        });
      }
    }
  }

  return [...backCards, ...deeperCards, ...exitCards, ...peerCards];
}

/**
 * Polish 4a TASK 3b — pure predicate for the map's cross-region
 * arrival auto-switch. Returns true when the player's CURRENT root
 * region differs from the most-recently-selected region in the map
 * panel. Caller forces map tier to 2 (Region) when true.
 */
export function isCrossRegionArrival(
  previousSelectedRegionId: string | null,
  currentRootRegionId:      string | null,
): boolean {
  if (!currentRootRegionId) return false;
  if (!previousSelectedRegionId) return false;
  return previousSelectedRegionId !== currentRootRegionId;
}
