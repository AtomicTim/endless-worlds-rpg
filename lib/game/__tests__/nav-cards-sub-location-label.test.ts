import { buildCards } from "@/lib/game/nav-cards";
import type { MasterState, WorldGraph, WorldNode } from "@/types/game";

/**
 * V8.63 (Day 23C) — sub-location label regression.
 *
 * Symptom we're guarding against: pre-fix the WB prompt instructed the
 * LLM to set node_type: "settlement_hub" on EVERY sub-location ("they
 * live inside it"). That made every tavern / shop / smithy / shrine nav
 * card render "SETTLEMENT" — uniform and unhelpful.
 *
 * The prompt is now corrected (sub-locations omit node_type), but
 * typeLabel() also carries a guard so any AI that still over-applies
 * settlement_hub on a non-settlement_node falls through to the category
 * label. These tests pin BOTH the clean case (no node_type set →
 * category) AND the buggy case (mistagged settlement_hub on a
 * sub_location → category).
 */

function makeSettlement(
  connections: string[] = ["tavern", "shop", "smithy", "shrine"]
): WorldNode {
  return {
    id:                 "thornwick",
    name:               "Thornwick Crossing",
    type:               "zone",
    category:           "settlement",
    zone_id:            "ashwood_forest",
    is_expandable:      false,
    connections,
    npc_ids:            [],
    item_ids:           [],
    asset_id:           "location_thornwick",
    discovered:         true,
    map_position:       { x: 0, y: 0 },
    is_settlement_node: true,
    node_type:          "settlement_hub",
  };
}

function makeSubLocation(
  id: string,
  name: string,
  category: string,
  overrides: Partial<WorldNode> = {}
): WorldNode {
  return {
    id,
    name,
    type:               "sub_location",
    category,
    zone_id:            "thornwick",
    is_expandable:      false,
    connections:        ["thornwick"],
    npc_ids:            [],
    item_ids:           [],
    asset_id:           `location_${id}`,
    discovered:         false,
    map_position:       { x: 1, y: 1 },
    is_settlement_node: false,
    ...overrides,
  };
}

function makeGraph(nodes: WorldNode[], currentId: string): WorldGraph {
  return {
    nodes:            Object.fromEntries(nodes.map((n) => [n.id, n])),
    current_node_id:  currentId,
    starting_node_id: nodes[0]?.id ?? "thornwick",
  };
}

function makeState(graph: WorldGraph): MasterState {
  // metadata is included as an empty object so buildCards' world_bible
  // access (`masterState?.metadata.world_bible`) doesn't throw on the
  // intermediate `metadata.` lookup.
  return {
    world_graph: graph,
    navigation_trail: [],
    metadata: {},
  } as unknown as MasterState;
}

describe("nav cards — sub-location labels (Day 23C bug fix)", () => {
  it("clean case: sub-location with no node_type renders its category as the label", () => {
    const settlement = makeSettlement();
    const tavern  = makeSubLocation("tavern",  "The Cooled Hearth",   "tavern");
    const shop    = makeSubLocation("shop",    "Glass Emporium",      "market");
    const smithy  = makeSubLocation("smithy",  "Ashwood Forge",       "smithy");
    const shrine  = makeSubLocation("shrine",  "The Bell-Sanctum",    "shrine");

    const graph = makeGraph([settlement, tavern, shop, smithy, shrine], "thornwick");
    const cards = buildCards(graph, makeState(graph));

    // Settlement hub at thornwick — DEEPER cards for each sub-location.
    const tavernCard = cards.find((c) => c.targetId === "tavern");
    const shopCard   = cards.find((c) => c.targetId === "shop");
    const smithyCard = cards.find((c) => c.targetId === "smithy");
    const shrineCard = cards.find((c) => c.targetId === "shrine");

    // PR-3v: TYPE · DIRECTION sublabel — sub-locations from the
    // settlement hub are DEEPER cards, so each ends "· DEEPER".
    expect(tavernCard?.sublabel).toBe("TAVERN · DEEPER");
    expect(shopCard?.sublabel  ).toBe("MARKET · DEEPER");
    expect(smithyCard?.sublabel).toBe("SMITHY · DEEPER");
    expect(shrineCard?.sublabel).toBe("SHRINE · DEEPER");
    // Specifically does NOT start with "SETTLEMENT" — that's the bug
    // we're guarding (mis-tagged sub-locations rendering as settlement).
    expect(tavernCard?.sublabel.startsWith("SETTLEMENT")).toBe(false);
    expect(shopCard?.sublabel.startsWith("SETTLEMENT"  )).toBe(false);
  });

  it("guard case: sub-location mistagged with node_type 'settlement_hub' falls through to category", () => {
    // Simulates a legacy save / buggy LLM response where every
    // sub-location got node_type: "settlement_hub". The typeLabel()
    // guard detects this combination (settlement_hub + is_settlement_node
    // !== true) and falls through to the category.
    const settlement = makeSettlement();
    const tavern = makeSubLocation("tavern", "The Cooled Hearth", "tavern", {
      node_type: "settlement_hub",
    });
    const shop = makeSubLocation("shop", "Glass Emporium", "market", {
      node_type: "settlement_hub",
    });

    const graph = makeGraph([settlement, tavern, shop], "thornwick");
    const cards = buildCards(graph, makeState(graph));

    // PR-3v: TYPE · DEEPER (the cards are DEEPER from the settlement hub).
    expect(cards.find((c) => c.targetId === "tavern")?.sublabel).toBe("TAVERN · DEEPER");
    expect(cards.find((c) => c.targetId === "shop"  )?.sublabel).toBe("MARKET · DEEPER");
    // The settlement hub itself (visited from a sub-location BACK card)
    // STILL renders with SETTLEMENT as the TYPE — its node_type is
    // intentional and is_settlement_node === true makes the guard
    // inactive. PR-3v: paired with "· BACK" for the BACK card.
    const subLocGraph = makeGraph([settlement, tavern], "tavern");
    const subLocCards = buildCards(subLocGraph, makeState(subLocGraph));
    const backCard    = subLocCards.find((c) => c.kind === "back");
    expect(backCard?.targetId).toBe("thornwick");
    expect(backCard?.sublabel).toBe("SETTLEMENT · BACK");
  });

  it("dungeon nodes still render DUNGEON via nodeTypeLabel (guard is sub-location-specific)", () => {
    const settlement = makeSettlement();
    const region: WorldNode = {
      id: "ashwood_forest", name: "The Ashwood Forest", type: "zone",
      category: "wilderness", zone_id: "ashwood_forest", is_expandable: true,
      connections: ["thornwick", "old_barrow"], npc_ids: [], item_ids: [],
      asset_id: "location_ashwood_forest", discovered: true,
      map_position: { x: 0, y: 0 }, is_settlement_node: false,
    };
    const dungeon: WorldNode = {
      id: "old_barrow", name: "The Old Barrow", type: "zone",
      category: "dungeon", zone_id: "ashwood_forest", is_expandable: false,
      connections: ["thornwick"], npc_ids: [], item_ids: [],
      asset_id: "location_old_barrow", discovered: false,
      map_position: { x: 10, y: -5 }, is_settlement_node: false,
      node_type: "dungeon",
    };
    const graph = makeGraph([region, settlement, dungeon], "ashwood_forest");
    const cards = buildCards(graph, makeState(graph));

    const dungeonCard = cards.find((c) => c.targetId === "old_barrow");
    // PR-3v: peer-known card → "DUNGEON · NEARBY".
    expect(dungeonCard?.sublabel).toBe("DUNGEON · NEARBY");
  });
});
