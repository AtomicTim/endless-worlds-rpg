import type {
  MasterState,
  RegionBible,
  WorldGraph,
  WorldNode,
} from "@/types/game";
import {
  isRegionAlreadyExpanded,
  isApplyRegionalBibleRedundant,
  mergeNodePreservingDiscovered,
} from "../region-expansion-guard";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const REGION_ID = "the_chain_keeps_borderland";

function makeRegionBible(overrides: Partial<RegionBible> = {}): RegionBible {
  return {
    id:          REGION_ID,
    name:        "The Chain-Keeps Borderland",
    type:        "wilderness",
    grid_centre: { x: 22, y: 8 },
    grid_radius: 3,
    atmosphere:  "test atmosphere",
    locations: [
      {
        id:                 REGION_ID,
        name:               "The Chain-Keeps Crossing",
        type:               "settlement",
        grid_position:      { x: 22, y: 8 },
        region_id:          REGION_ID,
        is_settlement_node: true,
        is_interior:        false,
        atmosphere:         "x",
        connections:        [`${REGION_ID}_inn`],
        npc_ids:            [],
        objects:            [],
        ambient_type:       "town_square",
      },
      {
        id:                 `${REGION_ID}_inn`,
        name:               "Sub Tavern",
        type:               "tavern",
        grid_position:      { x: 21, y: 8 },
        region_id:          REGION_ID,
        is_settlement_node: false,
        is_interior:        true,
        parent_location_id: REGION_ID,
        atmosphere:         "x",
        connections:        [REGION_ID],
        npc_ids:            [],
        objects:            [],
        ambient_type:       "tavern_common_room",
      },
    ],
    npcs: [],
    exits: [],
    ...overrides,
  };
}

function makeNode(overrides: Partial<WorldNode> = {}): WorldNode {
  return {
    id:            REGION_ID,
    name:          "The Chain-Keeps Borderland",
    type:          "zone",
    zone_id:       REGION_ID,
    is_expandable: true,
    connections:   [],
    npc_ids:       [],
    item_ids:      [],
    asset_id:      `location_${REGION_ID}`,
    discovered:    true,
    map_position:  { x: 22, y: 8 },
    ...overrides,
  };
}

function makeStateSlice(
  bible:    RegionBible | undefined,
  graphIn:  WorldGraph | undefined
): Pick<MasterState, "metadata" | "world_graph"> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metadata: any = {
    region_bibles: bible ? { [bible.id]: bible } : {},
  };
  return { metadata, world_graph: graphIn };
}

// ─────────────────────────────────────────────────────────────────────────────
// isRegionAlreadyExpanded — used by useGameLoop FIX 1
// ─────────────────────────────────────────────────────────────────────────────

describe("isRegionAlreadyExpanded", () => {
  it("returns true when bible is in region_bibles AND node discovered=true (after expansion)", () => {
    const bible = makeRegionBible();
    const graph: WorldGraph = {
      nodes:            { [REGION_ID]: makeNode({ discovered: true }) },
      current_node_id:  REGION_ID,
      starting_node_id: "elsewhere",
    };
    expect(isRegionAlreadyExpanded(makeStateSlice(bible, graph), REGION_ID)).toBe(true);
  });

  it("returns false when region_bibles does not include this id (undiscovered region)", () => {
    const graph: WorldGraph = {
      nodes:            { [REGION_ID]: makeNode({ discovered: false }) },
      current_node_id:  REGION_ID,
      starting_node_id: "elsewhere",
    };
    // No bible registered.
    expect(isRegionAlreadyExpanded(makeStateSlice(undefined, graph), REGION_ID)).toBe(false);
  });

  it("returns false when bible is registered but graph node is missing", () => {
    const bible = makeRegionBible();
    const graph: WorldGraph = {
      nodes:            {},
      current_node_id:  "elsewhere",
      starting_node_id: "elsewhere",
    };
    expect(isRegionAlreadyExpanded(makeStateSlice(bible, graph), REGION_ID)).toBe(false);
  });

  it("returns false when bible is registered but the node is not yet discovered", () => {
    const bible = makeRegionBible();
    const graph: WorldGraph = {
      nodes:            { [REGION_ID]: makeNode({ discovered: false }) },
      current_node_id:  "elsewhere",
      starting_node_id: "elsewhere",
    };
    expect(isRegionAlreadyExpanded(makeStateSlice(bible, graph), REGION_ID)).toBe(false);
  });

  it("returns false defensively when world_graph is undefined", () => {
    const bible = makeRegionBible();
    expect(isRegionAlreadyExpanded(makeStateSlice(bible, undefined), REGION_ID)).toBe(false);
  });

  it("returning to a known region after first expansion no longer triggers WORLD_EXPLORE", () => {
    // Repro the user's reported flow:
    //   1. Player visits The Chain-Keeps Borderland for the first time.
    //   2. apply-regional-bible runs; bible lands in region_bibles, node discovered=true.
    //   3. Player navigates away (sub-location).
    //   4. Player returns: predicate must say "already expanded" so step 4d
    //      reclassifies as GRAPH_NAVIGATE and skips apply-regional-bible.
    const bible = makeRegionBible();
    const graph: WorldGraph = {
      nodes: {
        [REGION_ID]:           makeNode({ discovered: true }),
        [`${REGION_ID}_inn`]:  makeNode({ id: `${REGION_ID}_inn`, type: "sub_location", discovered: true }),
      },
      current_node_id:  `${REGION_ID}_inn`,
      starting_node_id: "elsewhere",
    };
    expect(isRegionAlreadyExpanded(makeStateSlice(bible, graph), REGION_ID)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isApplyRegionalBibleRedundant — used by apply-regional-bible FIX 2
// ─────────────────────────────────────────────────────────────────────────────

describe("isApplyRegionalBibleRedundant", () => {
  it("returns true when bible is in region_bibles AND every location is in world_graph", () => {
    const bible = makeRegionBible();
    const graph: WorldGraph = {
      nodes: {
        [REGION_ID]:           makeNode(),
        [`${REGION_ID}_inn`]:  makeNode({ id: `${REGION_ID}_inn`, type: "sub_location" }),
      },
      current_node_id:  REGION_ID,
      starting_node_id: "elsewhere",
    };
    expect(isApplyRegionalBibleRedundant(makeStateSlice(bible, graph), bible)).toBe(true);
  });

  it("returns false when bible is missing from region_bibles", () => {
    const bible = makeRegionBible();
    const graph: WorldGraph = {
      nodes: {
        [REGION_ID]:           makeNode(),
        [`${REGION_ID}_inn`]:  makeNode({ id: `${REGION_ID}_inn`, type: "sub_location" }),
      },
      current_node_id:  REGION_ID,
      starting_node_id: "elsewhere",
    };
    expect(isApplyRegionalBibleRedundant(makeStateSlice(undefined, graph), bible)).toBe(false);
  });

  it("returns false when bible is in region_bibles but a location is missing from the graph", () => {
    const bible = makeRegionBible();
    // Only the region zone exists; the sub-location is missing.
    const graph: WorldGraph = {
      nodes:            { [REGION_ID]: makeNode() },
      current_node_id:  REGION_ID,
      starting_node_id: "elsewhere",
    };
    expect(isApplyRegionalBibleRedundant(makeStateSlice(bible, graph), bible)).toBe(false);
  });

  it("checks region_locations too — returns false when a region_location is missing", () => {
    const bible = makeRegionBible({
      region_locations: [
        {
          id:                 `${REGION_ID}_dungeon`,
          name:               "The Dungeon",
          type:               "dungeon",
          grid_position:      { x: 30, y: 10 },
          region_id:          REGION_ID,
          is_settlement_node: false,
          is_interior:        false,
          atmosphere:         "x",
          connections:        [REGION_ID],
          npc_ids:            [],
          objects:            [],
          ambient_type:       "dungeon_corridor",
        },
      ],
    });
    const graph: WorldGraph = {
      nodes: {
        [REGION_ID]:           makeNode(),
        [`${REGION_ID}_inn`]:  makeNode({ id: `${REGION_ID}_inn`, type: "sub_location" }),
        // dungeon missing
      },
      current_node_id:  REGION_ID,
      starting_node_id: "elsewhere",
    };
    expect(isApplyRegionalBibleRedundant(makeStateSlice(bible, graph), bible)).toBe(false);
  });

  it("returns true even when nodes are undiscovered — discovered flag is NOT part of this predicate", () => {
    // Idempotence is about graph-level structural completeness; the
    // discovered flag is player state and isn't a reason to re-apply.
    const bible = makeRegionBible();
    const graph: WorldGraph = {
      nodes: {
        [REGION_ID]:           makeNode({ discovered: false }),
        [`${REGION_ID}_inn`]:  makeNode({ id: `${REGION_ID}_inn`, type: "sub_location", discovered: false }),
      },
      current_node_id:  "elsewhere",
      starting_node_id: "elsewhere",
    };
    expect(isApplyRegionalBibleRedundant(makeStateSlice(bible, graph), bible)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// mergeNodePreservingDiscovered — used by apply-regional-bible FIX 3
// ─────────────────────────────────────────────────────────────────────────────

describe("mergeNodePreservingDiscovered", () => {
  it("preserves existing discovered=true when fresh node has discovered=false", () => {
    const existing = makeNode({ discovered: true });
    const fresh    = makeNode({ discovered: false });
    const merged   = mergeNodePreservingDiscovered(existing, fresh);
    expect(merged.discovered).toBe(true);
  });

  it("returns fresh unchanged when existing is undefined (first apply)", () => {
    const fresh = makeNode({ discovered: false });
    const merged = mergeNodePreservingDiscovered(undefined, fresh);
    expect(merged).toBe(fresh);
  });

  it("returns fresh unchanged when existing was undiscovered (no carry-over)", () => {
    const existing = makeNode({ discovered: false });
    const fresh    = makeNode({ discovered: true });
    const merged   = mergeNodePreservingDiscovered(existing, fresh);
    expect(merged.discovered).toBe(true);
  });

  it("does not stomp other fresh fields when preserving discovered", () => {
    const existing = makeNode({
      discovered:  true,
      connections: ["old_link"],
    });
    const fresh = makeNode({
      discovered:  false,
      connections: ["new_link_a", "new_link_b"],
    });
    const merged = mergeNodePreservingDiscovered(existing, fresh);
    expect(merged.discovered).toBe(true);
    // Bible-level content fields ride from `fresh` — connections is content.
    expect(merged.connections).toEqual(["new_link_a", "new_link_b"]);
  });

  it("apply-with-discovered-false-on-existing-undiscovered keeps undiscovered", () => {
    const existing = makeNode({ discovered: false });
    const fresh    = makeNode({ discovered: false });
    const merged   = mergeNodePreservingDiscovered(existing, fresh);
    expect(merged.discovered).toBe(false);
  });
});
