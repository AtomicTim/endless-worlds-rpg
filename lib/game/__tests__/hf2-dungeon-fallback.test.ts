// HF2 — Dungeon enemy spawn safety net.
//
// Covers three tiers of behaviour:
//   1. RegionBible-seeded enemy ids continue to resolve through the
//      4-layer lookup after the prefix shortcut was added (no
//      regression for the happy path).
//   2. A dungeon encounter whose entire roster fails to resolve spawns
//      a generic tier-appropriate fallback (CHANGE 2 — dungeons must
//      always have a chance to bite).
//   3. A non-dungeon encounter whose roster fails to resolve still
//      cancels silently (existing intentional behaviour preserved).
//
// Plus a unit pass on the prefix shortcut and the tier helper.

import { Genre } from "@/types/game";
import type { Enemy, RegionBible, WorldBible, WorldNode } from "@/types/game";
import {
  buildDungeonFallbackEnemy,
  dungeonTierForNode,
  resolveEnemyLookup,
  rollEncounter,
} from "../combat-engine";

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const REGION_ID  = "the_seam_foothills";
const DUNGEON_ID = "the_seam_foothills_rockfall";
const ENEMY_ID   = "the_seam_foothills_rockfall_sentinel";

const regionEnemy: Enemy = {
  id:              ENEMY_ID,
  name:            "Rockfall Sentinel",
  description:     "A husked construct of cracked granite.",
  hp_range:        [10, 14],
  agi_mod:         1,
  str_mod:         2,
  damage_die:      "1d8",
  armor_bonus:     1,
  xp_value:        50,
  loot_table_id:   `${ENEMY_ID}_loot`,
  is_boss:         false,
  behavior_flavor: "implacable melee",
};

const regionBible: RegionBible = {
  id:                  REGION_ID,
  name:                "The Seam Foothills",
  atmosphere:          "Loose scree, sentinel stones, wind.",
  enemies:             [regionEnemy],
  locations:           [],
  region_locations:    [],
  npcs:                [],
  // Other fields aren't read by resolveEnemyLookup.
} as unknown as RegionBible;

function makeDungeonNode(overrides: Partial<WorldNode> = {}): WorldNode {
  return {
    id:                DUNGEON_ID,
    name:              "The Rockfall",
    type:              "zone",
    zone_id:           REGION_ID,
    is_expandable:     false,
    connections:       [],
    npc_ids:           [],
    item_ids:          [],
    asset_id:          `location_${DUNGEON_ID}`,
    discovered:        true,
    map_position:      { x: 0, y: 0 },
    encounter_chance:  1.0,
    encounter_roster:  [ENEMY_ID],
    is_boss_room:      false,
    node_type:         "dungeon",
    // isDungeonNode requires a non-empty dungeon_rooms array. Real
    // dungeon nodes always carry the canonical 3-room schema; the
    // minimum here lets the predicate succeed without forcing the test
    // to model the full room flow.
    dungeon_rooms: [
      {
        id:               `${DUNGEON_ID}_entrance`,
        name:             "Entrance",
        description:      "Test entrance.",
        room_type:        "entrance",
        connections:      [`${DUNGEON_ID}_boss`],
        objects:          [],
        encounter_chance: 1.0,
        discovered:       false,
      },
      {
        id:               `${DUNGEON_ID}_boss`,
        name:             "Boss",
        description:      "Test boss.",
        room_type:        "boss",
        connections:      [`${DUNGEON_ID}_entrance`],
        objects:          [],
        encounter_chance: 1.0,
        discovered:       false,
      },
    ],
    ...overrides,
  };
}

function makeNonDungeonNode(overrides: Partial<WorldNode> = {}): WorldNode {
  return {
    id:                "wilderness_node",
    name:              "Open Foothills",
    type:              "zone",
    zone_id:           REGION_ID,
    is_expandable:     false,
    connections:       [],
    npc_ids:           [],
    item_ids:          [],
    asset_id:          "location_wilderness_node",
    discovered:        true,
    map_position:      { x: 0, y: 0 },
    encounter_chance:  1.0,
    encounter_roster:  [ENEMY_ID],
    is_boss_room:      false,
    node_type:         "wilderness",
    ...overrides,
  };
}

beforeAll(() => {
  // Quiet the diagnostic warnings the engine emits on unresolved ids /
  // dungeon fallback paths — the tests assert on outcomes, not console
  // output.
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => {
  (console.warn as jest.Mock).mockRestore?.();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. resolveEnemyLookup — happy path + prefix shortcut
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveEnemyLookup — happy path", () => {
  it("resolves a RegionBible-seeded enemy when node.zone_id matches the bible", () => {
    const node   = makeDungeonNode();
    const bibles = { [REGION_ID]: regionBible };
    const found  = resolveEnemyLookup(ENEMY_ID, node, undefined, bibles, Genre.FANTASY);
    expect(found?.id).toBe(ENEMY_ID);
    expect(found?.name).toBe("Rockfall Sentinel");
  });

  it("genre bestiary still wins over region bibles", () => {
    const node   = makeDungeonNode();
    const bibles = { [REGION_ID]: regionBible };
    const found  = resolveEnemyLookup("fantasy_goblin", node, undefined, bibles, Genre.FANTASY);
    expect(found?.id).toBe("fantasy_goblin");
  });
});

describe("resolveEnemyLookup — prefix shortcut (HF2 zone_id corruption defence)", () => {
  it("finds the enemy in its prefix-matching bible even when zone_id is corrupted", () => {
    // Simulate session-84 Bug 2: the node's zone_id was stamped against a
    // different region during a cache-leakage write. The enemy id still
    // encodes its source bible's id as a prefix, and HF2's prefix
    // shortcut catches that even before the slower full sweep.
    const corruptedNode: WorldNode = makeDungeonNode({
      zone_id: "the_mirror_road",   // points at the wrong bible
    });
    const bibles = {
      [REGION_ID]:          regionBible,
      "the_mirror_road":    { ...regionBible, id: "the_mirror_road", enemies: [] } as unknown as RegionBible,
    };
    const found = resolveEnemyLookup(ENEMY_ID, corruptedNode, undefined, bibles, Genre.FANTASY);
    expect(found?.id).toBe(ENEMY_ID);
  });

  it("returns null when no bible carries the enemy at all", () => {
    const node = makeDungeonNode();
    const found = resolveEnemyLookup("not_anywhere", node, undefined, {}, Genre.FANTASY);
    expect(found).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. dungeonTierForNode + buildDungeonFallbackEnemy
// ─────────────────────────────────────────────────────────────────────────────

describe("dungeonTierForNode", () => {
  it("returns tier 1 when zone_id matches world_bible.starting_region.id", () => {
    const node = makeDungeonNode({ zone_id: "starting_region_id" });
    const wb   = { starting_region: { id: "starting_region_id" } } as unknown as WorldBible;
    expect(dungeonTierForNode(node, wb)).toBe(1);
  });
  it("returns tier 2 for any other zone_id", () => {
    const node = makeDungeonNode({ zone_id: "the_seam_foothills" });
    const wb   = { starting_region: { id: "grayveil_crossing_region" } } as unknown as WorldBible;
    expect(dungeonTierForNode(node, wb)).toBe(2);
  });
  it("returns tier 2 when world_bible is undefined", () => {
    expect(dungeonTierForNode(makeDungeonNode(), undefined)).toBe(2);
  });
});

describe("buildDungeonFallbackEnemy", () => {
  it("hp = 15 + tier * 8 (tier 1 → 23, tier 2 → 31)", () => {
    const t1 = buildDungeonFallbackEnemy(1, Genre.FANTASY);
    const t2 = buildDungeonFallbackEnemy(2, Genre.FANTASY);
    expect(t1.hp_range).toEqual([23, 23]);
    expect(t2.hp_range).toEqual([31, 31]);
  });

  it("damage die scales by tier (tier 1 → 1d6, tier 2 → 1d8)", () => {
    expect(buildDungeonFallbackEnemy(1, Genre.FANTASY).damage_die).toBe("1d6");
    expect(buildDungeonFallbackEnemy(2, Genre.FANTASY).damage_die).toBe("1d8");
  });

  it("name follows the genre fallback table", () => {
    expect(buildDungeonFallbackEnemy(1, Genre.FANTASY).name).toBe("Dungeon Creature");
    expect(buildDungeonFallbackEnemy(1, Genre.CYBERPUNK).name).toBe("Rogue Drone");
    expect(buildDungeonFallbackEnemy(1, Genre.POST_APOCALYPTIC).name).toBe("Mutated Husk");
  });

  it("armor is 0; is_boss is false; behavior_flavor is aggressive", () => {
    const e = buildDungeonFallbackEnemy(2, Genre.FANTASY);
    expect(e.armor_bonus).toBe(0);
    expect(e.is_boss).toBe(false);
    expect(e.behavior_flavor).toBe("aggressive");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. rollEncounter — dungeon fallback vs non-dungeon cancel
// ─────────────────────────────────────────────────────────────────────────────

describe("rollEncounter — HF2 dungeon fallback", () => {
  it("spawns the fallback enemy when ALL roster ids fail on a dungeon node", () => {
    const node = makeDungeonNode({
      encounter_roster: ["not_a_real_enemy", "also_unknown"],
    });
    // No region bibles, no starting region — every lookup fails.
    const result = rollEncounter({
      node,
      world_bible:    undefined,
      region_bibles:  {},
      genre:          Genre.FANTASY,
      current_xp:     0,
      rng:            seqRng([0.5]),
    });
    expect(result.combatStarted).toBe(true);
    expect(result.combat?.enemies.length).toBe(1);
    expect(result.combat?.enemies[0].name).toBe("Dungeon Creature");
    expect(result.combat?.enemies[0].alive).toBe(true);
  });

  it("does NOT spawn the fallback on a non-dungeon node — silent cancel preserved", () => {
    const node = makeNonDungeonNode({
      encounter_roster: ["not_a_real_enemy"],
    });
    const result = rollEncounter({
      node,
      world_bible:    undefined,
      region_bibles:  {},
      genre:          Genre.FANTASY,
      current_xp:     0,
      rng:            seqRng([0.5]),
    });
    expect(result.combatStarted).toBe(false);
    expect(result.combat).toBeUndefined();
  });

  it("still resolves the regular roster id when the bible IS available (no regression)", () => {
    const node = makeDungeonNode();
    const result = rollEncounter({
      node,
      world_bible:    undefined,
      region_bibles:  { [REGION_ID]: regionBible },
      genre:          Genre.FANTASY,
      current_xp:     0,
      rng:            seqRng([0.5]),
    });
    expect(result.combatStarted).toBe(true);
    expect(result.combat?.enemies[0].enemy_id).toBe(ENEMY_ID);
    expect(result.combat?.enemies[0].name).toBe("Rockfall Sentinel");
  });

  it("fallback also fires when the dungeon roster mixes a known + unknown id and ALL unknown ids on a second pass", () => {
    // Edge case: roster has one resolvable + one unresolvable id. The
    // resolvable spawn lands; the fallback should NOT fire because the
    // encounter already has at least one enemy.
    const node = makeDungeonNode({
      encounter_roster: [ENEMY_ID, "not_a_real_enemy"],
    });
    const result = rollEncounter({
      node,
      world_bible:    undefined,
      region_bibles:  { [REGION_ID]: regionBible },
      genre:          Genre.FANTASY,
      current_xp:     0,
      rng:            seqRng([0.5]),
      forceEnemyIds:  [ENEMY_ID, "not_a_real_enemy"],
    });
    expect(result.combatStarted).toBe(true);
    // Only the resolvable id spawns; no fallback padding.
    expect(result.combat?.enemies.length).toBe(1);
    expect(result.combat?.enemies[0].name).toBe("Rockfall Sentinel");
  });
});
