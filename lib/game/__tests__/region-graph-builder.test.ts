/**
 * Day 20.4.4 — Integration tests for buildRegionGraphNodes.
 *
 * Per V8.40 rule 71: routing helpers and lookup keys require integration
 * tests against real data. This suite exercises the full graph-building
 * pipeline (steps 3-6 of apply-regional-bible) for:
 *
 *   1. A fresh (correctly structured) RegionBible with distinct region
 *      zone and settlement ids (result of Day 20.4.3 prompt fix).
 *   2. A collapsed RegionBible (settlement.id === bible.id, pre-20.4.3
 *      shape) that has been repaired by splitConflatedRegionSettlement
 *      before reaching buildRegionGraphNodes.
 *
 * Task 5 assertions (all cases):
 *   ✓ Region zone and settlement are DISTINCT nodes with DISTINCT display names
 *   ✓ Region zone connections include settlement id
 *   ✓ Settlement connections include region zone id AND sub-location ids
 *   ✓ Sub-location nodes have correct display names (not id-based slugs)
 *   ✓ settlement.is_settlement_node === true
 *   ✓ region zone.is_settlement_node !== true
 *   ✓ DEEPER nav card for settlement present when player is at region zone
 *   ✓ BACK nav card targets previous region's settlement on cross-region arrival
 */

import { buildRegionGraphNodes }         from "../region-graph-builder";
import { splitConflatedRegionSettlement } from "../region-expansion-guard";
import { buildCards }                     from "../nav-cards";
import { LocationStatus }                 from "@/types/game";
import type {
  MasterState,
  RegionBible,
  WorldGraph,
  WorldNode,
} from "@/types/game";

// ── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Minimal RegionBible matching the Day 20.4.3 prompt template output
 * (distinct region id + settlement id, sub-location with parent_location_id).
 *
 * Models "Pale Edge Territory" from Tim's V8.42 playtest.
 */
function makeValidBible(): RegionBible {
  const regionId     = "pale_edge_territory";
  const settlementId = "pale_edge_territory_settlement";
  const innId        = "pale_edge_territory_settlement_inn";
  const armoryId     = "pale_edge_territory_settlement_armory";
  const ruinsId      = "pale_edge_territory_beacon_ruins";
  return {
    id:              regionId,
    name:            "Pale Edge Territory",
    type:            "wilderness",
    settlement_id:   settlementId,
    settlement_name: "Warden's Gate",
    atmosphere:      "Cracked plains under a bruised sky.",
    grid_centre:     { x: 40, y: 30 },
    grid_radius:     3,
    controlling_faction: null,
    locations: [
      {
        id:                 settlementId,
        name:               "Warden's Gate",
        type:               "settlement",
        is_settlement_node: true,
        is_interior:        false,
        atmosphere:         "A walled waystation at the edge of the waste.",
        grid_position:      { x: 40, y: 30 },
        connections:        [innId],
        npc_ids:            ["character_mott"],
        objects:            [],
        ambient_type:       "town_square",
      },
      {
        id:                 innId,
        name:               "The Rusted Flagon",
        type:               "tavern",
        is_settlement_node: false,
        is_interior:        true,
        parent_location_id: settlementId,
        atmosphere:         "Low beams, low voices.",
        grid_position:      { x: 39, y: 30 },
        connections:        [settlementId],
        npc_ids:            ["character_mott"],
        objects:            [],
        ambient_type:       "tavern_common_room",
      },
      {
        id:                 armoryId,
        name:               "Warden's Armory and Hall",
        type:               "storage",
        is_settlement_node: false,
        is_interior:        true,
        parent_location_id: settlementId,
        atmosphere:         "Racks of confiscated weapons.",
        grid_position:      { x: 41, y: 30 },
        connections:        [settlementId],
        npc_ids:            [],
        objects:            [],
        ambient_type:       "storage_room",
      },
    ],
    region_locations: [
      {
        id:                 ruinsId,
        name:               "Beacon Ruins",
        type:               "dungeon",
        is_settlement_node: false,
        is_interior:        false,
        atmosphere:         "Crumbling signal tower.",
        grid_position:      { x: 43, y: 30 },
        connections:        [settlementId],
        npc_ids:            ["character_watcher"],
        objects:            [],
        ambient_type:       "dungeon_entrance",
      },
    ],
    npcs: [
      {
        id:               "character_mott",
        name:             "Mott Carrowin",
        home_location_id: innId,
        role:             "innkeeper",
        archetype:        "innkeeper",
        appearance:       "",
        personality:      "",
        speech_style:     "",
        knowledge:        [],
        default_trust:    50,
      },
      {
        id:               "character_watcher",
        name:             "Hesta Vellor",
        home_location_id: ruinsId,
        role:             "explorer",
        archetype:        "explorer",
        appearance:       "",
        personality:      "",
        speech_style:     "",
        knowledge:        [],
        default_trust:    50,
      },
    ],
    enemies:    [],
    exits:      [],
    main_quests: [],
  } as unknown as RegionBible;
}

/**
 * Collapsed bible where settlement.id === bible.id (pre-Day-20.4.3 shape).
 * Mirrors what generate-regional-bible returned before the prompt fix.
 */
function makeCollapsedBible(): RegionBible {
  const id    = "pale_edge_territory";
  const innId = `${id}_inn`;
  return {
    id,
    name:            "Pale Edge Territory",
    type:            "wilderness",
    settlement_id:   id,            // ← collapsed: same as region id
    settlement_name: "Warden's Gate",
    atmosphere:      "Cracked plains under a bruised sky.",
    grid_centre:     { x: 40, y: 30 },
    grid_radius:     3,
    controlling_faction: null,
    locations: [
      {
        id,                          // ← same as bible.id
        name:               "Warden's Gate",
        type:               "settlement",
        is_settlement_node: true,
        is_interior:        false,
        atmosphere:         "A walled waystation at the edge of the waste.",
        grid_position:      { x: 40, y: 30 },
        connections:        [innId],
        npc_ids:            ["character_mott"],
        objects:            [],
        ambient_type:       "town_square",
      },
      {
        id:                 innId,
        name:               "The Rusted Flagon",
        type:               "tavern",
        is_settlement_node: false,
        is_interior:        true,
        parent_location_id: id,      // ← same as bible.id
        atmosphere:         "Low beams, low voices.",
        grid_position:      { x: 39, y: 30 },
        connections:        [id],    // ← same as bible.id
        npc_ids:            ["character_mott"],
        objects:            [],
        ambient_type:       "tavern_common_room",
      },
    ],
    region_locations: [],
    npcs: [
      {
        id:               "character_mott",
        name:             "Mott Carrowin",
        home_location_id: id,        // ← collapsed reference
        role:             "innkeeper",
        archetype:        "innkeeper",
        appearance:       "",
        personality:      "",
        speech_style:     "",
        knowledge:        [],
        default_trust:    50,
      },
    ],
    enemies:    [],
    exits:      [],
    main_quests: [],
  } as unknown as RegionBible;
}

/** Starting region graph (origin node the player is crossing from). */
function makeOriginGraph(originNodeId = "thornbridge_settlement"): WorldGraph {
  const settlement: WorldNode = {
    id:                 originNodeId,
    name:               "Thornbridge Market",
    type:               "zone",
    category:           "settlement",
    zone_id:            "thornbridge_crossing",
    is_expandable:      false,
    connections:        ["thornbridge_crossing"],
    npc_ids:            [],
    item_ids:           [],
    asset_id:           `location_${originNodeId}`,
    discovered:         true,
    map_position:       { x: 0, y: 0 },
    is_settlement_node: true,
  };
  const regionZone: WorldNode = {
    id:                 "thornbridge_crossing",
    name:               "Thornbridge Crossing",
    type:               "zone",
    category:           "wilderness",
    zone_id:            "thornbridge_crossing",
    is_expandable:      true,
    connections:        [originNodeId, "pale_edge_territory"],
    npc_ids:            [],
    item_ids:           [],
    asset_id:           "location_thornbridge_crossing",
    discovered:         true,
    map_position:       { x: 0, y: 0 },
    is_settlement_node: false,
  };
  // Placeholder outline node for pale_edge_territory (pre-apply).
  const outlinePlaceholder: WorldNode = {
    id:                 "pale_edge_territory",
    name:               "pale_edge_territory",
    type:               "zone",
    category:           "wilderness",
    zone_id:            "pale_edge_territory",
    is_expandable:      true,
    connections:        ["thornbridge_crossing"],
    npc_ids:            [],
    item_ids:           [],
    asset_id:           "location_pale_edge_territory",
    discovered:         false,
    map_position:       { x: 40, y: 30 },
    is_settlement_node: false,
  };
  return {
    nodes: {
      [settlement.id]:         settlement,
      [regionZone.id]:         regionZone,
      [outlinePlaceholder.id]: outlinePlaceholder,
    },
    current_node_id:  originNodeId,
    starting_node_id: originNodeId,
  };
}

function makeMasterState(trail?: string[]): MasterState {
  return {
    metadata: {
      session_id:  "test",
      world_bible: {
        starting_region: { id: "thornbridge_crossing", name: "Thornbridge Crossing" },
        adjacent_regions: [{ id: "pale_edge_territory", name: "Pale Edge Territory" }],
      },
    } as unknown as MasterState["metadata"],
    world_state: {
      current_location_id: "thornbridge_settlement",
      visited_locations:   [],
      flags:               {},
      location_status:     LocationStatus.PRESENT,
    },
    player_state:     {} as MasterState["player_state"],
    npc_registry:     {} as MasterState["npc_registry"],
    log_book:         {} as MasterState["log_book"],
    world_graph:      undefined,
    navigation_trail: trail,
  } as MasterState;
}

// ── buildRegionGraphNodes — valid bible ───────────────────────────────────────

describe("buildRegionGraphNodes — valid (distinct ids) bible", () => {
  const ORIGIN = "thornbridge_settlement";
  let result: ReturnType<typeof buildRegionGraphNodes>;

  beforeEach(() => {
    result = buildRegionGraphNodes(makeValidBible(), makeOriginGraph(ORIGIN), ORIGIN);
  });

  it("returns distinct startingNodeId and regionZoneId", () => {
    expect(result.regionZoneId).toBe("pale_edge_territory");
    expect(result.startingNodeId).toBe("pale_edge_territory_settlement");
    expect(result.regionZoneId).not.toBe(result.startingNodeId);
  });

  it("region zone node exists with display name (not slug)", () => {
    const rz = result.mergedNodes["pale_edge_territory"];
    expect(rz).toBeDefined();
    expect(rz.name).toBe("Pale Edge Territory");       // display name
    expect(rz.name).not.toBe("pale_edge_territory");   // not the slug
  });

  it("settlement node exists with display name (not slug)", () => {
    const s = result.mergedNodes["pale_edge_territory_settlement"];
    expect(s).toBeDefined();
    expect(s.name).toBe("Warden's Gate");
    expect(s.name).not.toBe("pale_edge_territory_settlement");
  });

  it("sub-location nodes have display names (not id slugs)", () => {
    const inn    = result.mergedNodes["pale_edge_territory_settlement_inn"];
    const armory = result.mergedNodes["pale_edge_territory_settlement_armory"];
    expect(inn).toBeDefined();
    expect(inn.name).toBe("The Rusted Flagon");
    expect(inn.name).not.toBe("pale_edge_territory_settlement_inn");
    expect(armory).toBeDefined();
    expect(armory.name).toBe("Warden's Armory and Hall");
    expect(armory.name).not.toBe("pale_edge_territory_settlement_armory");
  });

  it("settlement.is_settlement_node === true", () => {
    expect(result.mergedNodes["pale_edge_territory_settlement"].is_settlement_node).toBe(true);
  });

  it("region zone.is_settlement_node is false or absent", () => {
    const rz = result.mergedNodes["pale_edge_territory"];
    expect(rz.is_settlement_node).toBeFalsy();
  });

  it("region zone connections include settlement id", () => {
    const rz = result.mergedNodes["pale_edge_territory"];
    expect(rz.connections).toContain("pale_edge_territory_settlement");
  });

  it("settlement connections include region zone id", () => {
    const s = result.mergedNodes["pale_edge_territory_settlement"];
    expect(s.connections).toContain("pale_edge_territory");
  });

  it("settlement connections include sub-location ids", () => {
    const s = result.mergedNodes["pale_edge_territory_settlement"];
    // Inn and armory are sub-locations; settlement should connect to inn
    // (from bible.connections) and beacon_ruins gets stitched in via 4b-2.
    expect(s.connections).toContain("pale_edge_territory_settlement_inn");
    expect(s.connections).toContain("pale_edge_territory_beacon_ruins");
  });

  it("region_location is bidirectionally stitched to settlement", () => {
    const ruins = result.mergedNodes["pale_edge_territory_beacon_ruins"];
    const s     = result.mergedNodes["pale_edge_territory_settlement"];
    expect(ruins.connections).toContain("pale_edge_territory_settlement");
    expect(s.connections).toContain("pale_edge_territory_beacon_ruins");
  });

  it("region zone is self-zoned and expandable", () => {
    const rz = result.mergedNodes["pale_edge_territory"];
    expect(rz.zone_id).toBe(rz.id);
    expect(rz.is_expandable).toBe(true);
  });

  it("settlement has zone_id === region zone id", () => {
    const s = result.mergedNodes["pale_edge_territory_settlement"];
    expect(s.zone_id).toBe("pale_edge_territory");
  });

  it("sub-locations have zone_id === settlement id", () => {
    const inn    = result.mergedNodes["pale_edge_territory_settlement_inn"];
    const armory = result.mergedNodes["pale_edge_territory_settlement_armory"];
    expect(inn.zone_id).toBe("pale_edge_territory_settlement");
    expect(armory.zone_id).toBe("pale_edge_territory_settlement");
  });

  it("region_location has zone_id === region id", () => {
    const ruins = result.mergedNodes["pale_edge_territory_beacon_ruins"];
    expect(ruins.zone_id).toBe("pale_edge_territory");
  });
});

// ── buildRegionGraphNodes — collapsed bible (pre-20.4.3 shape) ───────────────

describe("buildRegionGraphNodes — collapsed bible repaired by splitConflatedRegionSettlement", () => {
  let result: ReturnType<typeof buildRegionGraphNodes>;

  beforeEach(() => {
    const bible = makeCollapsedBible();
    // Caller must run split first (mirrors apply-regional-bible step 0d).
    const splitResult = splitConflatedRegionSettlement(bible);
    expect(splitResult.collapsed).toBe(true);   // confirms fixture is collapsed
    result = buildRegionGraphNodes(bible, makeOriginGraph(), "thornbridge_settlement");
  });

  it("produces distinct region zone and settlement after split+build", () => {
    // After split: settlement.id = "pale_edge_territory_settlement"
    expect(result.regionZoneId).toBe("pale_edge_territory");
    expect(result.startingNodeId).toBe("pale_edge_territory_settlement");
    expect(result.regionZoneId).not.toBe(result.startingNodeId);
  });

  it("settlement still has is_settlement_node after split+build", () => {
    const s = result.mergedNodes["pale_edge_territory_settlement"];
    expect(s).toBeDefined();
    expect(s.is_settlement_node).toBe(true);
  });

  it("region zone connections include settlement after split+build", () => {
    const rz = result.mergedNodes["pale_edge_territory"];
    expect(rz.connections).toContain("pale_edge_territory_settlement");
  });

  it("settlement connections include region zone after split+build", () => {
    const s = result.mergedNodes["pale_edge_territory_settlement"];
    expect(s.connections).toContain("pale_edge_territory");
  });

  it("inn zone_id updated to new settlement id after split+build", () => {
    const inn = result.mergedNodes["pale_edge_territory_inn"];
    // The split updates parent_location_id (which becomes zone_id for interiors).
    expect(inn).toBeDefined();
    expect(inn.zone_id).toBe("pale_edge_territory_settlement");
  });
});

// ── Nav card integration: DEEPER card for settlement at region zone ───────────

describe("buildCards — DEEPER card for settlement at region zone (Day 20.4.4 fix)", () => {
  /** Build a WorldGraph from buildRegionGraphNodes output + set current_node_id. */
  function makeGraphAtRegionZone(bible: RegionBible): WorldGraph {
    const origin = makeOriginGraph();
    const { mergedNodes, regionZoneId } = buildRegionGraphNodes(
      bible,
      origin,
      "thornbridge_settlement",
    );
    return {
      nodes:            mergedNodes,
      current_node_id:  regionZoneId,
      starting_node_id: "thornbridge_settlement",
    };
  }

  it("includes settlement as DEEPER card when at region zone (no trail)", () => {
    const graph = makeGraphAtRegionZone(makeValidBible());
    const state = makeMasterState();
    const cards = buildCards(graph, state);
    const deeper = cards.filter((c) => c.kind === "deeper");
    expect(deeper.length).toBeGreaterThanOrEqual(1);
    const settlementCard = deeper.find((c) => c.targetId === "pale_edge_territory_settlement");
    expect(settlementCard).toBeDefined();
    expect(settlementCard!.tier).toBe("settlement");
    expect(settlementCard!.name).toBe("WARDEN'S GATE");
  });

  it("includes settlement as DEEPER card on cross-region arrival", () => {
    const graph = makeGraphAtRegionZone(makeValidBible());
    // Cross-region: came from thornbridge_crossing (different region).
    const state = makeMasterState(["thornbridge_settlement", "pale_edge_territory"]);
    const cards = buildCards(graph, state);

    // BACK should target the previous region's settlement.
    const back = cards.find((c) => c.kind === "back");
    expect(back).toBeDefined();
    expect(back!.targetId).toBe("thornbridge_settlement");

    // DEEPER should still include the current region's settlement.
    const deeper = cards.filter((c) => c.kind === "deeper");
    const settlementCard = deeper.find((c) => c.targetId === "pale_edge_territory_settlement");
    expect(settlementCard).toBeDefined();
    expect(settlementCard!.tier).toBe("settlement");
  });

  it("includes settlement DEEPER card for collapsed-bible after split+build", () => {
    const bible = makeCollapsedBible();
    splitConflatedRegionSettlement(bible);  // repair in-place
    const graph = makeGraphAtRegionZone(bible);
    const state = makeMasterState();
    const cards = buildCards(graph, state);
    const deeper = cards.filter((c) => c.kind === "deeper");
    const settlementCard = deeper.find((c) => c.targetId === "pale_edge_territory_settlement");
    expect(settlementCard).toBeDefined();
  });

  it("DEEPER card tier is 'settlement' (sky-blue color per rule 73)", () => {
    const graph = makeGraphAtRegionZone(makeValidBible());
    const cards = buildCards(graph, makeMasterState());
    const settlementCard = cards.find(
      (c) => c.kind === "deeper" && c.targetId === "pale_edge_territory_settlement"
    );
    expect(settlementCard!.tier).toBe("settlement");
  });

  it("region_location dungeon appears as PEER card (not DEEPER) at region zone", () => {
    const graph = makeGraphAtRegionZone(makeValidBible());
    const cards = buildCards(graph, makeMasterState());
    const ruinsCard = cards.find((c) => c.targetId === "pale_edge_territory_beacon_ruins");
    expect(ruinsCard).toBeDefined();
    // region_locations (dungeons, wilderness) appear as peer cards at region zone.
    expect(["peer-known", "peer-unknown"]).toContain(ruinsCard!.kind);
  });
});
