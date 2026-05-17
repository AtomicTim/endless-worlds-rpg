import {
  buildCards,
  groupCardsByDirection,
  directionOfCard,
  tierOfNode,
  isCrossRegionArrival,
  nodeTypeLabel,
  previousNodeIdFromTrail,
  type Card,
} from "../nav-cards";
import { LocationStatus } from "@/types/game";
import type { MasterState, WorldGraph, WorldNode } from "@/types/game";

/**
 * Polish 4a TASK 6 — tests for the pure nav-card helpers.
 *
 * Covers:
 *   1. groupCardsByDirection — EXIT folds into BACK, empty groups
 *      remain as empty arrays for caller-side filtering,
 *      within-group order preserved.
 *   2. buildCards — region-zone BACK card prefers the previous
 *      region's settlement when the player just crossed regions
 *      (TASK 3a). Same-region moves keep the current-region
 *      settlement as the BACK target.
 *   3. tierOfNode + isCrossRegionArrival predicate behavior.
 *   4. previousNodeIdFromTrail returns trail[-2] when trail has
 *      length ≥ 2, null otherwise.
 */

// ── Fixtures ────────────────────────────────────────────────────────────────

function mkNode(overrides: Partial<WorldNode> & { id: string; name: string }): WorldNode {
  return {
    id:                 overrides.id,
    name:               overrides.name,
    type:               overrides.type ?? "zone",
    category:           overrides.category,
    zone_id:            overrides.zone_id ?? overrides.id,
    is_expandable:      overrides.is_expandable ?? false,
    connections:        overrides.connections ?? [],
    npc_ids:            overrides.npc_ids ?? [],
    item_ids:           overrides.item_ids ?? [],
    asset_id:           overrides.asset_id ?? `location_${overrides.id}`,
    discovered:         overrides.discovered ?? false,
    map_position:       overrides.map_position ?? { x: 0, y: 0 },
    is_settlement_node: overrides.is_settlement_node ?? false,
    // Day 23A — propagate node_type / region_type / dungeon_rooms when
    // the test specifies them so nav-card scenarios can assert on
    // typed-node behaviour.
    ...(overrides.node_type     !== undefined ? { node_type: overrides.node_type } : {}),
    ...(overrides.region_type   !== undefined ? { region_type: overrides.region_type } : {}),
    ...(overrides.dungeon_rooms !== undefined ? { dungeon_rooms: overrides.dungeon_rooms } : {}),
  };
}

/**
 * Build a worldGraph fixture with two regions:
 *   - Region A ("region_a") — starting region. Contains settle_a.
 *   - Region B ("region_b") — adjacent region expanded after travel.
 *     Contains settle_b.
 *
 * `currentNodeId` controls where the player is standing.
 */
function makeWorldGraph(currentNodeId: string): WorldGraph {
  const settleA = mkNode({
    id: "settle_a",
    name: "Chain's Rest",
    zone_id: "region_a",
    is_settlement_node: true,
    discovered: true,
  });
  const regionA = mkNode({
    id: "region_a",
    name: "The Rust Shallows",
    is_expandable: true,
    discovered: true,
    connections: ["settle_a"],
  });
  const settleB = mkNode({
    id: "settle_b",
    name: "Scavenger's Rest",
    zone_id: "region_b",
    is_settlement_node: true,
    discovered: false,
  });
  const regionB = mkNode({
    id: "region_b",
    name: "The Drift Barrens",
    is_expandable: true,
    discovered: true,
    connections: ["settle_b"],
  });
  return {
    nodes: {
      [regionA.id]:  regionA,
      [settleA.id]:  settleA,
      [regionB.id]:  regionB,
      [settleB.id]:  settleB,
    },
    current_node_id:  currentNodeId,
    starting_node_id: "settle_a",
  };
}

/** Minimal MasterState. Only `metadata.world_bible` and
 *  `navigation_trail` are read by buildCards. */
function makeMasterState(opts?: {
  adjacentRegions?: Array<{ id: string; name: string }>;
  trail?:           string[];
}): MasterState {
  return {
    metadata: {
      session_id: "test-session",
      world_bible: {
        starting_region: {
          id: "region_a",
          name: "The Rust Shallows",
        },
        adjacent_regions: opts?.adjacentRegions ?? [],
      },
    } as unknown as MasterState["metadata"],
    world_state: {
      current_location_id: "settle_a",
      visited_locations:   [],
      flags:               {},
      location_status:     LocationStatus.PRESENT,
    },
    player_state:     {} as MasterState["player_state"],
    npc_registry:     {} as MasterState["npc_registry"],
    log_book:         {} as MasterState["log_book"],
    world_graph:      undefined,
    navigation_trail: opts?.trail,
  } as MasterState;
}

// ── groupCardsByDirection ───────────────────────────────────────────────────

describe("groupCardsByDirection", () => {
  it("folds EXIT entries into the BACK group", () => {
    const cards: Card[] = [
      { key: "exit-1",   kind: "exit",   targetId: "r1",  name: "REGION",     sublabel: "EXIT TO REGION", discovered: true, tier: "region" },
      { key: "back-1",   kind: "back",   targetId: "h1",  name: "HUB",        sublabel: "SETTLEMENT",     discovered: true, tier: "settlement" },
      { key: "deeper-1", kind: "deeper", targetId: "s1",  name: "SHOP",       sublabel: "MARKET",         discovered: true, tier: "sub-location" },
    ];
    const out = groupCardsByDirection(cards);
    expect(out.back.map((c) => c.key)).toEqual(["exit-1", "back-1"]);
    expect(out.deeper.map((c) => c.key)).toEqual(["deeper-1"]);
    expect(out.peer).toEqual([]);
    expect(out.undiscovered).toEqual([]);
  });

  it("preserves within-group order", () => {
    const cards: Card[] = [
      { key: "deeper-1", kind: "deeper",        targetId: "s1", name: "A", sublabel: "X", discovered: true, tier: "sub-location" },
      { key: "deeper-2", kind: "deeper",        targetId: "s2", name: "B", sublabel: "X", discovered: true, tier: "sub-location" },
      { key: "peer-1",   kind: "peer-known",    targetId: "r1", name: "C", sublabel: "X", discovered: true, tier: "region" },
      { key: "peer-2",   kind: "peer-known",    targetId: "r2", name: "D", sublabel: "X", discovered: true, tier: "region" },
      { key: "unk-1",    kind: "peer-unknown",  targetId: "r3", name: "E", sublabel: "X", discovered: false, tier: "region" },
    ];
    const out = groupCardsByDirection(cards);
    expect(out.deeper.map((c) => c.key)).toEqual(["deeper-1", "deeper-2"]);
    expect(out.peer.map((c) => c.key)).toEqual(["peer-1", "peer-2"]);
    expect(out.undiscovered.map((c) => c.key)).toEqual(["unk-1"]);
  });

  it("returns all four buckets even when some are empty", () => {
    const out = groupCardsByDirection([]);
    expect(Object.keys(out).sort()).toEqual(["back", "deeper", "peer", "undiscovered"].sort());
    expect(out.back).toEqual([]);
    expect(out.deeper).toEqual([]);
    expect(out.peer).toEqual([]);
    expect(out.undiscovered).toEqual([]);
  });
});

// ── directionOfCard ─────────────────────────────────────────────────────────

describe("directionOfCard", () => {
  it("maps each kind to the correct direction", () => {
    expect(directionOfCard({ kind: "back" } as Card)).toBe("back");
    expect(directionOfCard({ kind: "exit" } as Card)).toBe("back");
    expect(directionOfCard({ kind: "deeper" } as Card)).toBe("deeper");
    expect(directionOfCard({ kind: "peer-known" } as Card)).toBe("peer");
    expect(directionOfCard({ kind: "peer-unknown" } as Card)).toBe("undiscovered");
  });
});

// ── tierOfNode ──────────────────────────────────────────────────────────────

describe("tierOfNode", () => {
  it("classifies region zones (self-zoned + expandable)", () => {
    expect(tierOfNode(mkNode({
      id: "r", name: "R", is_expandable: true, zone_id: "r",
    }))).toBe("region");
  });

  it("classifies settlements (is_settlement_node)", () => {
    expect(tierOfNode(mkNode({
      id: "s", name: "S", zone_id: "r", is_settlement_node: true,
    }))).toBe("settlement");
  });

  it("classifies sub-locations", () => {
    expect(tierOfNode(mkNode({
      id: "x", name: "X", type: "sub_location", zone_id: "s",
    }))).toBe("sub-location");
  });

  it("classifies everything else as dungeon", () => {
    expect(tierOfNode(mkNode({
      id: "d", name: "D", zone_id: "r",
      // not expandable, not settlement, not sub_location → dungeon
    }))).toBe("dungeon");
  });
});

// ── previousNodeIdFromTrail ─────────────────────────────────────────────────

describe("previousNodeIdFromTrail", () => {
  it("returns trail[-2] for a normal trail", () => {
    const state = makeMasterState({ trail: ["a", "b", "c"] });
    expect(previousNodeIdFromTrail(state)).toBe("b");
  });

  it("returns trail[-2] for a length-2 trail", () => {
    const state = makeMasterState({ trail: ["a", "b"] });
    expect(previousNodeIdFromTrail(state)).toBe("a");
  });

  it("returns null when the trail is too short", () => {
    expect(previousNodeIdFromTrail(makeMasterState({ trail: ["only"] }))).toBeNull();
    expect(previousNodeIdFromTrail(makeMasterState({ trail: [] }))).toBeNull();
  });

  it("returns null when navigation_trail is undefined or masterState is null", () => {
    expect(previousNodeIdFromTrail(makeMasterState())).toBeNull();
    expect(previousNodeIdFromTrail(null)).toBeNull();
  });
});

// ── buildCards — settlement-card label on cross-region arrival ──────────────

describe("buildCards — region-zone BACK card", () => {
  it("falls back to current region's settlement when no trail", () => {
    const graph = makeWorldGraph("region_a");
    const state = makeMasterState();
    const cards = buildCards(graph, state);
    const back = cards.find((c) => c.kind === "back");
    expect(back).toBeDefined();
    expect(back!.targetId).toBe("settle_a");
    // PR-3v: mixed-case name (was "CHAIN'S REST"); sublabel is the
    // standard TYPE · DIRECTION composite.
    expect(back!.name).toBe("Chain's Rest");
    expect(back!.sublabel).toBe("SETTLEMENT · BACK");
    expect(back!.tier).toBe("settlement");
  });

  it("falls back to current region's settlement when previous node is in SAME region", () => {
    // Player at region_a, previous was settle_a (same region).
    const graph = makeWorldGraph("region_a");
    const state = makeMasterState({ trail: ["settle_a", "region_a"] });
    const cards = buildCards(graph, state);
    const back = cards.find((c) => c.kind === "back");
    expect(back).toBeDefined();
    expect(back!.targetId).toBe("settle_a");
    expect(back!.name).toBe("Chain's Rest");
  });

  it("targets the PREVIOUS region's settlement on cross-region arrival", () => {
    // Player just arrived at region_b after coming from region_a (region zone).
    const graph = makeWorldGraph("region_b");
    const state = makeMasterState({ trail: ["region_a", "region_b"] });
    const cards = buildCards(graph, state);
    const back = cards.find((c) => c.kind === "back");
    expect(back).toBeDefined();
    // The previous region was region_a, whose settlement is settle_a.
    expect(back!.targetId).toBe("settle_a");
    expect(back!.name).toBe("Chain's Rest");
    expect(back!.tier).toBe("settlement");
  });

  it("targets the PREVIOUS settlement directly when trail's previous node IS a settlement in another region", () => {
    // Player at region_b, previous was settle_a (in region_a).
    const graph = makeWorldGraph("region_b");
    const state = makeMasterState({ trail: ["settle_a", "region_b"] });
    const cards = buildCards(graph, state);
    const back = cards.find((c) => c.kind === "back");
    expect(back).toBeDefined();
    expect(back!.targetId).toBe("settle_a");
    expect(back!.name).toBe("Chain's Rest");
  });
});

// ── buildCards — DEEPER dedup at region zone (rule 80) ─────────────────────

describe("buildCards — DEEPER dedup at region zone (rule 80)", () => {
  it("suppresses DEEPER when BACK already targets the same settlement (same-region inbound)", () => {
    // Player at region_a, came from settle_a (trail[-2] = settle_a).
    // BACK = settle_a. DEEPER would also be settle_a → suppress.
    const graph = makeWorldGraph("region_a");
    const state = makeMasterState({ trail: ["settle_a", "region_a"] });
    const cards = buildCards(graph, state);
    const back   = cards.find((c) => c.kind === "back");
    const deeper = cards.find((c) => c.kind === "deeper");
    expect(back?.targetId).toBe("settle_a");
    expect(deeper).toBeUndefined(); // suppressed — BACK already covers settlement
  });

  it("suppresses DEEPER when no trail forces BACK to the region's own settlement", () => {
    // No trail → BACK defaults to settlementHub (settle_a).
    // DEEPER would also be settle_a → suppress per rule 80.
    const graph = makeWorldGraph("region_a");
    const state = makeMasterState();
    const cards = buildCards(graph, state);
    const back   = cards.find((c) => c.kind === "back");
    const deeper = cards.find((c) => c.kind === "deeper");
    expect(back?.targetId).toBe("settle_a");
    expect(deeper).toBeUndefined();
  });

  it("shows DEEPER when BACK targets a different settlement (cross-region arrival)", () => {
    // Player at region_b, came from region_a (cross-region).
    // BACK = settle_a (previous region). DEEPER = settle_b (current region).
    // Different destinations → no dedup, both cards show.
    const graph = makeWorldGraph("region_b");
    const state = makeMasterState({ trail: ["region_a", "region_b"] });
    const cards = buildCards(graph, state);
    const back   = cards.find((c) => c.kind === "back");
    const deeper = cards.find((c) => c.kind === "deeper");
    expect(back?.targetId).toBe("settle_a");
    expect(deeper?.targetId).toBe("settle_b");
  });
});

// ── V8.55 — region_zone retains peer cards after BACK from dungeon ─────────
//
// SYMPTOM (Tim's playtest): after region_zone → dungeon → BACK → region_zone,
// the nav bar shows only the settlement BACK card. All peer region_location
// cards (dungeon, landmark, wilderness) disappear. Navigating away to the
// settlement and back restores them.
//
// HYPOTHESIS in the prompt: trail[-2] being a dungeon node is affecting
// BACK/PEER/DEEPER logic in buildCards. These tests pin the contract that
// the peer cards remain regardless of which type of region_location the
// player just came from.

describe("buildCards — region_zone peer cards after returning from a region_location", () => {
  function makeGraphWithLandmarksAndDungeon(currentNodeId: string): WorldGraph {
    const settle = mkNode({
      id: "settle_a",
      name: "Chain's Rest",
      zone_id: "region_a",
      is_settlement_node: true,
      discovered: true,
    });
    const dungeon = mkNode({
      id: "dungeon_a",
      name: "The Broken Vigil",
      zone_id: "region_a",
      is_expandable: false,
      discovered: true,
      node_type: "dungeon",
      category: "dungeon",
    });
    const landmark = mkNode({
      id: "landmark_a",
      name: "The Obsidian Spire",
      zone_id: "region_a",
      is_expandable: false,
      discovered: false,
      node_type: "landmark",
      category: "wilderness",
    });
    const wilderness = mkNode({
      id: "wild_a",
      name: "Sulfur Vent Field",
      zone_id: "region_a",
      is_expandable: false,
      discovered: false,
      node_type: "wilderness",
      category: "wilderness",
    });
    const region = mkNode({
      id: "region_a",
      name: "The Ashfall Lowlands",
      is_expandable: true,
      discovered: true,
      connections: ["settle_a", "dungeon_a", "landmark_a", "wild_a"],
    });
    return {
      nodes: {
        [region.id]:     region,
        [settle.id]:     settle,
        [dungeon.id]:    dungeon,
        [landmark.id]:   landmark,
        [wilderness.id]: wilderness,
      },
      current_node_id:  currentNodeId,
      starting_node_id: "settle_a",
    };
  }

  it("shows the full peer card set when player returns to the region zone from a DUNGEON (trail[-2] = dungeon)", () => {
    // Sequence: settle_a → region_a → dungeon_a → BACK → region_a.
    // After BACK lands, trail[-2] is dungeon_a (the node just left).
    const graph = makeGraphWithLandmarksAndDungeon("region_a");
    const state = makeMasterState({
      trail: ["settle_a", "region_a", "dungeon_a", "region_a"],
    });
    const cards = buildCards(graph, state);

    // All three peer region_locations must be visible.
    const peerIds = cards
      .filter((c) => c.kind === "peer-known" || c.kind === "peer-unknown")
      .map((c) => c.targetId)
      .sort();
    expect(peerIds).toEqual(["dungeon_a", "landmark_a", "wild_a"]);

    // BACK still points at the settlement hub (rule 80 dedup only
    // suppresses DEEPER, not peer cards).
    const back = cards.find((c) => c.kind === "back");
    expect(back?.targetId).toBe("settle_a");
  });

  it("shows the full peer card set when player returns from a LANDMARK", () => {
    const graph = makeGraphWithLandmarksAndDungeon("region_a");
    const state = makeMasterState({
      trail: ["settle_a", "region_a", "landmark_a", "region_a"],
    });
    const cards = buildCards(graph, state);
    const peerIds = cards
      .filter((c) => c.kind === "peer-known" || c.kind === "peer-unknown")
      .map((c) => c.targetId)
      .sort();
    expect(peerIds).toEqual(["dungeon_a", "landmark_a", "wild_a"]);
  });

  it("shows the full peer card set on first arrival (no return)", () => {
    // Sanity baseline: with no trail or a simple inbound trail, all
    // region_locations show. If this test were ever to fail it would
    // mean the peer-card iteration itself is broken — independent of
    // the trail-driven cross-region BACK heuristic.
    const graph = makeGraphWithLandmarksAndDungeon("region_a");
    const state = makeMasterState({ trail: ["settle_a", "region_a"] });
    const cards = buildCards(graph, state);
    const peerIds = cards
      .filter((c) => c.kind === "peer-known" || c.kind === "peer-unknown")
      .map((c) => c.targetId)
      .sort();
    expect(peerIds).toEqual(["dungeon_a", "landmark_a", "wild_a"]);
  });
});

// ── isCrossRegionArrival ────────────────────────────────────────────────────

describe("isCrossRegionArrival", () => {
  it("returns true when current root region differs from previous", () => {
    expect(isCrossRegionArrival("region_a", "region_b")).toBe(true);
  });

  it("returns false on same-region moves", () => {
    expect(isCrossRegionArrival("region_a", "region_a")).toBe(false);
  });

  it("returns false when either side is null (initial mount, no prior tier)", () => {
    expect(isCrossRegionArrival(null, "region_a")).toBe(false);
    expect(isCrossRegionArrival("region_a", null)).toBe(false);
    expect(isCrossRegionArrival(null, null)).toBe(false);
  });
});

// ── V8.55 — nodeTypeLabel + peer-card sublabel correctness ─────────────────
//
// SYMPTOM (Tim's playtest): every region_location nav card rendered
// "DUNGEON" regardless of its actual type. Fix: render the label from
// node_type rather than the legacy category slug.

describe("nodeTypeLabel", () => {
  it("maps every LocationNodeType to a stable badge string", () => {
    expect(nodeTypeLabel("settlement_hub")).toBe("SETTLEMENT");
    expect(nodeTypeLabel("outpost")).toBe("OUTPOST");
    expect(nodeTypeLabel("wilderness")).toBe("WILDERNESS");
    expect(nodeTypeLabel("dungeon")).toBe("DUNGEON");
    expect(nodeTypeLabel("landmark")).toBe("LANDMARK");
    expect(nodeTypeLabel("abandoned_settlement")).toBe("RUINS");
  });
  it("falls back to LOCATION for undefined / null", () => {
    expect(nodeTypeLabel(undefined)).toBe("LOCATION");
    expect(nodeTypeLabel(null)).toBe("LOCATION");
  });
});

describe("buildCards — peer card sublabels reflect node_type (not legacy category)", () => {
  function makeGraphWithTypedPeers(): WorldGraph {
    const settle = mkNode({
      id: "settle_a",
      name: "Chain's Rest",
      zone_id: "region_a",
      is_settlement_node: true,
      discovered: true,
    });
    // Three region_locations with the SAME legacy category to prove
    // node_type is what's driving the label. If typeLabel were still
    // reading from category these would all render the same string.
    const dungeon = mkNode({
      id: "dungeon_a",
      name: "Broken Vigil Ruins",
      zone_id: "region_a",
      category: "dungeon",
      node_type: "dungeon",
    });
    const landmark = mkNode({
      id: "landmark_a",
      name: "Obsidian Spire",
      zone_id: "region_a",
      category: "dungeon",  // legacy mis-tag — node_type is the truth
      node_type: "landmark",
    });
    const wilderness = mkNode({
      id: "wild_a",
      name: "Sulfur Vent Field",
      zone_id: "region_a",
      category: "dungeon",  // legacy mis-tag again
      node_type: "wilderness",
    });
    const region = mkNode({
      id: "region_a",
      name: "Ashfall Lowlands",
      is_expandable: true,
      discovered: true,
      connections: ["settle_a", "dungeon_a", "landmark_a", "wild_a"],
    });
    return {
      nodes: {
        [region.id]:     region,
        [settle.id]:     settle,
        [dungeon.id]:    dungeon,
        [landmark.id]:   landmark,
        [wilderness.id]: wilderness,
      },
      current_node_id:  "region_a",
      starting_node_id: "settle_a",
    };
  }

  it("renders peer-card sublabel from node_type — dungeon / landmark / wilderness all distinct", () => {
    const graph = makeGraphWithTypedPeers();
    const state = makeMasterState({ trail: ["settle_a", "region_a"] });
    const cards = buildCards(graph, state);
    const byId = new Map(cards.map((c) => [c.targetId, c]));
    // PR-3v: TYPE · DIRECTION sublabel format. peer-known cards get
    // the "· NEARBY" suffix; the TYPE half still derives from
    // node_type so dungeon/landmark/wilderness stay distinct.
    expect(byId.get("dungeon_a")?.sublabel).toBe("DUNGEON · NEARBY");
    expect(byId.get("landmark_a")?.sublabel).toBe("LANDMARK · NEARBY");
    expect(byId.get("wild_a")?.sublabel).toBe("WILDERNESS · NEARBY");
  });

  it("falls back to legacy category when node_type is absent (back-compat)", () => {
    // Legacy nodes generated before Day 23A have no node_type and the
    // nav card should still produce a readable badge from category.
    const settle = mkNode({
      id: "settle_a",
      name: "Chain's Rest",
      zone_id: "region_a",
      is_settlement_node: true,
      discovered: true,
    });
    const oldDungeon = mkNode({
      id: "old_dungeon",
      name: "Old Dungeon",
      zone_id: "region_a",
      category: "ruin",
      // no node_type — pre-Day 23A bible
    });
    const region = mkNode({
      id: "region_a",
      name: "Region A",
      is_expandable: true,
      discovered: true,
      connections: ["settle_a", "old_dungeon"],
    });
    const graph: WorldGraph = {
      nodes: { region_a: region, settle_a: settle, old_dungeon: oldDungeon },
      current_node_id:  "region_a",
      starting_node_id: "settle_a",
    };
    const state = makeMasterState({ trail: ["settle_a", "region_a"] });
    const cards = buildCards(graph, state);
    const oldCard = cards.find((c) => c.targetId === "old_dungeon");
    // PR-3v: TYPE · DIRECTION format. category.toUpperCase() fallback
    // fills the TYPE slot when node_type is absent; "· NEARBY" comes
    // from the peer-known direction.
    expect(oldCard?.sublabel).toBe("RUIN · NEARBY");
  });
});
