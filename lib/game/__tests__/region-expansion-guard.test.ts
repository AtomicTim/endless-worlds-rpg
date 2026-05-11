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
  splitConflatedRegionSettlement,
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

// ─────────────────────────────────────────────────────────────────────────────
// Day 20.4.3 Region Expansion Hotfix — splitConflatedRegionSettlement
// ─────────────────────────────────────────────────────────────────────────────
//
// Integration coverage per V8.40 rule 71: this helper IS the structural
// repair that apply-regional-bible runs to recover legacy bibles whose
// region.id and settlement.id collapsed (the V8.41 playtest "Ringstone
// Market" scenario). Tests exercise:
//   - distinct region/settlement ids in the OUTPUT bible
//   - region name preserved on the region zone, settlement name on the
//     settlement location
//   - sub-locations re-pointed to settlement (parent_location_id +
//     connections)
//   - region_locations re-pointed to settlement (connections)
//   - NPC home_location_id re-pointed
//   - exit from_location_id re-pointed
//   - no-op on already-correct bibles

describe("splitConflatedRegionSettlement", () => {
  /**
   * Build the V8.41-playtest-shape bible: region.id === settlement.id.
   * The settlement location carries the SETTLEMENT's name (e.g.
   * "Ringstone Market"). One sub-location, one region_location, two
   * NPCs (one homed at settlement, one homed at sub), one exit.
   */
  function makeCollapsedBible(): RegionBible {
    const id = "the_ceramic_spine_foothills";
    return {
      id,
      name: "The Ceramic Spine Foothills",
      type: "wilderness",
      grid_centre: { x: 22, y: 8 },
      grid_radius: 3,
      atmosphere: "Pale clay slopes rise toward a pottery-shard horizon.",
      locations: [
        {
          id:                 id, // ← COLLAPSED: settlement uses region id
          name:               "Ringstone Market",
          type:               "settlement",
          grid_position:      { x: 22, y: 8 },
          region_id:          id,
          is_settlement_node: true,
          is_interior:        false,
          atmosphere:         "Open plaza ringed by chipped kilns.",
          connections:        [`${id}_inn`],
          npc_ids:            ["character_kiln_warden"],
          objects:            [],
          ambient_type:       "town_square",
        },
        {
          id:                 `${id}_inn`,
          name:               "The Cracked Kiln",
          type:               "tavern",
          grid_position:      { x: 21, y: 8 },
          region_id:          id,
          is_settlement_node: false,
          is_interior:        true,
          parent_location_id: id, // ← points at collapsed settlement
          atmosphere:         "Smoke-stained common room.",
          connections:        [id], // ← points at collapsed settlement
          npc_ids:            ["character_innkeep"],
          objects:            [],
          ambient_type:       "tavern_common_room",
        },
      ],
      region_locations: [
        {
          id:                 `${id}_point`,
          name:               "Ringstone Vault",
          type:               "dungeon",
          grid_position:      { x: 23, y: 8 },
          region_id:          id,
          is_settlement_node: false,
          is_interior:        false,
          atmosphere:         "Cracked vault yawning open below the ridge.",
          connections:        [id], // ← points at collapsed settlement
          npc_ids:            [],
          objects:            [],
          ambient_type:       "dungeon_corridor",
        },
      ],
      npcs: [
        {
          id:               "character_kiln_warden",
          name:             "Hesta Vellor",
          home_location_id: id, // ← collapsed reference
          role:             "warden",
          archetype:        "warden",
          appearance:       "",
          personality:      "",
          speech_style:     "",
          knowledge:        [],
          default_trust:    50,
        },
        {
          id:               "character_innkeep",
          name:             "Mott Carrowin",
          home_location_id: `${id}_inn`, // already correct
          role:             "innkeeper",
          archetype:        "innkeeper",
          appearance:       "",
          personality:      "",
          speech_style:     "",
          knowledge:        [],
          default_trust:    50,
        },
      ],
      exits: [
        {
          direction:        "south",
          target_region_id: "iron_march_lowlands",
          from_location_id: id, // ← collapsed reference
          description:      "Road south.",
        },
      ],
    };
  }

  it("does nothing when the bible is already correctly split", () => {
    const bible = makeCollapsedBible();
    // Pre-correct the bible: settlement gets a distinct id.
    const settlementId = `${bible.id}_settlement`;
    bible.locations[0].id            = settlementId;
    bible.locations[1].parent_location_id = settlementId;
    bible.locations[1].connections   = [settlementId];
    (bible.region_locations ?? []).forEach((rl) => {
      rl.connections = [settlementId];
    });
    bible.npcs[0].home_location_id   = settlementId;
    bible.exits[0].from_location_id  = settlementId;

    const result = splitConflatedRegionSettlement(bible);
    expect(result.collapsed).toBe(false);
    // No mutations applied to the already-correct bible.
    expect(bible.locations[0].id).toBe(settlementId);
    expect(bible.id).toBe("the_ceramic_spine_foothills"); // region id unchanged
  });

  it("produces distinct region and settlement ids when collapsed", () => {
    const bible = makeCollapsedBible();
    const regionId = bible.id;
    const result   = splitConflatedRegionSettlement(bible);

    expect(result.collapsed).toBe(true);
    if (!result.collapsed) return; // type guard
    expect(result.oldSettlementId).toBe(regionId);
    expect(result.newSettlementId).toBe(`${regionId}_settlement`);
    expect(result.newSettlementId).not.toBe(regionId);

    // Region id on the bible payload is UNCHANGED (still the region).
    expect(bible.id).toBe(regionId);
    // Settlement location now carries the new id.
    expect(bible.locations[0].id).toBe(`${regionId}_settlement`);
    // bible.settlement_id is stamped.
    expect(bible.settlement_id).toBe(`${regionId}_settlement`);
  });

  it("preserves the region's display name on the bible and the settlement's display name on the location", () => {
    const bible = makeCollapsedBible();
    splitConflatedRegionSettlement(bible);

    expect(bible.name).toBe("The Ceramic Spine Foothills");
    expect(bible.locations[0].name).toBe("Ringstone Market");
    // settlement_name defaulted from the settlement location's name.
    expect(bible.settlement_name).toBe("Ringstone Market");
  });

  it("re-points sub-locations parent_location_id and connections to the new settlement id", () => {
    const bible = makeCollapsedBible();
    const regionId = bible.id;
    const result   = splitConflatedRegionSettlement(bible);
    if (!result.collapsed) throw new Error("expected collapse");
    const newId    = result.newSettlementId;

    const sub = bible.locations.find((l) => l.id === `${regionId}_inn`);
    expect(sub).toBeDefined();
    expect(sub!.parent_location_id).toBe(newId);
    expect(sub!.connections).toEqual([newId]);
    expect(sub!.connections).not.toContain(regionId);
  });

  it("re-points region_locations connections to the new settlement id", () => {
    const bible = makeCollapsedBible();
    const regionId = bible.id;
    const result   = splitConflatedRegionSettlement(bible);
    if (!result.collapsed) throw new Error("expected collapse");
    const newId    = result.newSettlementId;

    const dungeon = (bible.region_locations ?? [])[0];
    expect(dungeon).toBeDefined();
    expect(dungeon.connections).toEqual([newId]);
    expect(dungeon.connections).not.toContain(regionId);
  });

  it("re-points NPC home_location_id when it pointed at the collapsed settlement", () => {
    const bible = makeCollapsedBible();
    const regionId = bible.id;
    const result   = splitConflatedRegionSettlement(bible);
    if (!result.collapsed) throw new Error("expected collapse");
    const newId    = result.newSettlementId;

    const warden  = bible.npcs.find((n) => n.id === "character_kiln_warden");
    const innkeep = bible.npcs.find((n) => n.id === "character_innkeep");
    expect(warden!.home_location_id).toBe(newId);
    // Unrelated home_location_id stays untouched.
    expect(innkeep!.home_location_id).toBe(`${regionId}_inn`);
  });

  it("re-points exits.from_location_id when it pointed at the collapsed settlement", () => {
    const bible  = makeCollapsedBible();
    const result = splitConflatedRegionSettlement(bible);
    if (!result.collapsed) throw new Error("expected collapse");

    expect(bible.exits[0].from_location_id).toBe(result.newSettlementId);
  });

  it("honors an existing bible.settlement_id when it differs from region.id", () => {
    const bible = makeCollapsedBible();
    bible.settlement_id = "ringstone_market_hub"; // explicit override
    const result = splitConflatedRegionSettlement(bible);
    expect(result.collapsed).toBe(true);
    if (!result.collapsed) return;
    expect(result.newSettlementId).toBe("ringstone_market_hub");
    expect(bible.locations[0].id).toBe("ringstone_market_hub");
  });

  it("falls back to synthesized id when bible.settlement_id equals region.id", () => {
    const bible = makeCollapsedBible();
    bible.settlement_id = bible.id; // explicitly collapsed via settlement_id too
    const result = splitConflatedRegionSettlement(bible);
    expect(result.collapsed).toBe(true);
    if (!result.collapsed) return;
    expect(result.newSettlementId).toBe(`${bible.id}_settlement`);
  });
});
