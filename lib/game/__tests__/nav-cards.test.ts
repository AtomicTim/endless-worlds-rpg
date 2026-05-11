import {
  buildCards,
  groupCardsByDirection,
  directionOfCard,
  tierOfNode,
  isCrossRegionArrival,
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
    expect(back!.name).toBe("CHAIN'S REST");
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
    expect(back!.name).toBe("CHAIN'S REST");
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
    expect(back!.name).toBe("CHAIN'S REST");
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
    expect(back!.name).toBe("CHAIN'S REST");
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
