/**
 * Polish Round 4c — rule 81 tests.
 *
 * chooseTierForNode maps a player's current WorldNode to the most
 * contextually useful map tier. These tests cover the three navigation
 * trigger cases:
 *
 *   1. Geographic region zone → Region (2)
 *   2. Settlement hub           → Local  (3)
 *   3. Sub-location             → Local  (3)
 *   4. Non-settlement zone (dungeon / wilderness) → Local (3)
 *   5. Undefined node           → Region (2) fallback
 */

import { chooseTierForNode } from "../map-tier";
import type { WorldNode } from "@/types/game";

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

describe("chooseTierForNode — map tier auto-switch (rule 81)", () => {
  it("returns Region (2) for a geographic region zone (self-zoned + expandable)", () => {
    const node = mkNode({
      id:           "region_a",
      name:         "The Rust Shallows",
      is_expandable: true,
      zone_id:      "region_a",  // self-zoned
    });
    expect(chooseTierForNode(node)).toBe(2);
  });

  it("returns Local (3) for a settlement hub", () => {
    const node = mkNode({
      id:                 "settle_a",
      name:               "Chain's Rest",
      zone_id:            "region_a",
      is_settlement_node: true,
    });
    expect(chooseTierForNode(node)).toBe(3);
  });

  it("returns Local (3) for a sub-location (interior building)", () => {
    const node = mkNode({
      id:      "shop_a",
      name:    "The Iron Forge",
      type:    "sub_location",
      zone_id: "settle_a",
    });
    expect(chooseTierForNode(node)).toBe(3);
  });

  it("returns Local (3) for a non-settlement standalone zone (dungeon / wilderness)", () => {
    const node = mkNode({
      id:            "dungeon_a",
      name:          "Ruined Keep",
      zone_id:       "region_a",
      is_expandable: false,
    });
    expect(chooseTierForNode(node)).toBe(3);
  });

  it("returns Region (2) for an undefined node (safe fallback)", () => {
    expect(chooseTierForNode(undefined)).toBe(2);
  });
});
