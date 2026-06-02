/**
 * Day 23A — dungeon navigation helpers.
 *
 * The pure functions in lib/game/dungeon-navigation.ts power three
 * runtime concerns: room-by-room navigation (useGameLoop), nav-bar
 * card rendering (NavigationBar), and the locked-room USE-key flow.
 * These tests pin the contracts so the runtime can rely on them and
 * UI doesn't have to reinvent room lookups.
 */

import { ItemRarity, ItemType } from "@/types/game";
import type { DungeonRoom, Item, MasterState, WorldGraph, WorldNode } from "@/types/game";
import {
  advanceDungeonState,
  buildRoomCards,
  canEnterRoom,
  findEntranceRoom,
  findKeyForRoom,
  findRoom,
  getCurrentRoom,
  initialDungeonState,
  isAdjacentRoom,
  isAtDungeonEntrance,
  isDungeonNode,
  markRoomDiscovered,
  markRoomUnlocked,
  playerHasKeyFor,
  resolveDungeonExitTarget,
  roomTypeLabel,
} from "@/lib/game/dungeon-navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures — a canonical 3-room dungeon (entrance → middle → boss).
// ─────────────────────────────────────────────────────────────────────────────

function makeRoom(overrides: Partial<DungeonRoom> & Pick<DungeonRoom, "id" | "room_type">): DungeonRoom {
  return {
    name:             `Room ${overrides.id}`,
    description:      "",
    connections:      [],
    objects:          [],
    encounter_chance: 0.5,
    discovered:       false,
    ...overrides,
  } as DungeonRoom;
}

function makeDungeon(): WorldNode {
  const rooms: DungeonRoom[] = [
    makeRoom({
      id:           "d_entrance",
      room_type:    "entrance",
      connections:  ["d_middle"],
      encounter_chance: 0.5,
    }),
    makeRoom({
      id:           "d_middle",
      room_type:    "middle",
      connections:  ["d_entrance", "d_boss"],
      encounter_chance: 0.7,
    }),
    makeRoom({
      id:           "d_boss",
      room_type:    "boss",
      connections:  ["d_middle"],
      encounter_chance: 1.0,
      lock: {
        type:          "key",
        hint:          "The door bears a single seal.",
        key_item_id:   "the_warden_seal",
        key_item_name: "The Warden's Seal",
        unlocked:      false,
      },
    }),
  ];
  return {
    id:            "the_hollowed_barrow",
    name:          "The Hollowed Barrow",
    type:          "zone",
    zone_id:       "the_ashfall_lowlands",
    is_expandable: false,
    connections:   ["the_ashfall_lowlands"],
    npc_ids:       [],
    item_ids:      [],
    asset_id:      "location_the_hollowed_barrow",
    discovered:    true,
    map_position:  { x: 10, y: -5 },
    is_settlement_node: false,
    node_type:     "dungeon",
    dungeon_rooms: rooms,
  };
}

function makeKey(roomId = "d_boss"): Item {
  return {
    id:           "item_warden_seal",
    name:         "The Warden's Seal",
    type:         ItemType.KEY,
    rarity:       ItemRarity.UNCOMMON,
    description:  "A bone-and-iron seal.",
    quantity:     1,
    stackable:    false,
    is_key_item:  true,
    unlocks_node: roomId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Predicates
// ─────────────────────────────────────────────────────────────────────────────

describe("isDungeonNode", () => {
  it("true when node_type=dungeon and dungeon_rooms is non-empty", () => {
    expect(isDungeonNode(makeDungeon())).toBe(true);
  });
  it("false when node_type is undefined", () => {
    const n = makeDungeon();
    delete (n as { node_type?: unknown }).node_type;
    expect(isDungeonNode(n)).toBe(false);
  });
  it("false when dungeon_rooms is empty or undefined", () => {
    const n = makeDungeon();
    n.dungeon_rooms = [];
    expect(isDungeonNode(n)).toBe(false);
    delete (n as { dungeon_rooms?: unknown }).dungeon_rooms;
    expect(isDungeonNode(n)).toBe(false);
  });
  it("false for undefined input", () => {
    expect(isDungeonNode(undefined)).toBe(false);
  });
});

describe("findRoom / findEntranceRoom / getCurrentRoom", () => {
  const dungeon = makeDungeon();

  it("findRoom returns the matching room or null", () => {
    expect(findRoom(dungeon, "d_middle")?.room_type).toBe("middle");
    expect(findRoom(dungeon, "nope")).toBeNull();
  });

  it("findEntranceRoom returns the entrance regardless of array order", () => {
    expect(findEntranceRoom(dungeon)?.id).toBe("d_entrance");
  });

  it("getCurrentRoom resolves via dungeon_state slice", () => {
    const ds: MasterState["dungeon_state"] = {
      node_id:         dungeon.id,
      current_room_id: "d_middle",
      rooms_visited:   ["d_entrance", "d_middle"],
    };
    expect(getCurrentRoom(dungeon, ds)?.id).toBe("d_middle");
  });

  it("getCurrentRoom returns null when dungeon_state node_id mismatches", () => {
    const ds: MasterState["dungeon_state"] = {
      node_id:         "different_dungeon",
      current_room_id: "d_middle",
      rooms_visited:   ["d_middle"],
    };
    expect(getCurrentRoom(dungeon, ds)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Adjacency + locking
// ─────────────────────────────────────────────────────────────────────────────

describe("isAdjacentRoom", () => {
  const dungeon = makeDungeon();
  it("true when target is in current.connections", () => {
    expect(isAdjacentRoom(dungeon, "d_entrance", "d_middle")).toBe(true);
    expect(isAdjacentRoom(dungeon, "d_middle", "d_boss")).toBe(true);
  });
  it("false when target is not in connections (entrance → boss directly)", () => {
    expect(isAdjacentRoom(dungeon, "d_entrance", "d_boss")).toBe(false);
  });
});

describe("canEnterRoom + key checks", () => {
  const dungeon = makeDungeon();
  const boss    = findRoom(dungeon, "d_boss")!;
  const middle  = findRoom(dungeon, "d_middle")!;

  it("unlocked room is always enterable", () => {
    expect(canEnterRoom(middle, [])).toBe(true);
  });
  it("locked boss room blocks entry without the key", () => {
    expect(canEnterRoom(boss, [])).toBe(false);
  });
  it("locked boss room allows entry when player has matching key", () => {
    expect(canEnterRoom(boss, [makeKey("d_boss")])).toBe(true);
  });
  it("key for a different room does NOT unlock", () => {
    expect(canEnterRoom(boss, [makeKey("some_other_room")])).toBe(false);
  });
  it("playerHasKeyFor + findKeyForRoom agree", () => {
    const inv = [makeKey("d_boss")];
    expect(playerHasKeyFor(inv, "d_boss")).toBe(true);
    expect(findKeyForRoom(inv, "d_boss")?.name).toBe("The Warden's Seal");
    expect(findKeyForRoom(inv, "d_middle")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// State transitions
// ─────────────────────────────────────────────────────────────────────────────

describe("initialDungeonState", () => {
  it("lands the player in the entrance with rooms_visited=[entrance]", () => {
    const ds = initialDungeonState(makeDungeon());
    expect(ds).not.toBeNull();
    expect(ds!.node_id).toBe("the_hollowed_barrow");
    expect(ds!.current_room_id).toBe("d_entrance");
    expect(ds!.rooms_visited).toEqual(["d_entrance"]);
  });

  it("returns null when the dungeon has no entrance room", () => {
    const d = makeDungeon();
    d.dungeon_rooms = d.dungeon_rooms!.filter((r) => r.room_type !== "entrance");
    expect(initialDungeonState(d)).toBeNull();
  });
});

describe("advanceDungeonState", () => {
  const start: MasterState["dungeon_state"] = {
    node_id:         "d",
    current_room_id: "d_entrance",
    rooms_visited:   ["d_entrance"],
  };

  it("first visit to a new room appends to rooms_visited", () => {
    const next = advanceDungeonState(start!, "d_middle");
    expect(next.current_room_id).toBe("d_middle");
    expect(next.rooms_visited).toEqual(["d_entrance", "d_middle"]);
  });

  it("revisit does NOT duplicate the room in rooms_visited", () => {
    const went = advanceDungeonState(start!, "d_middle");
    const back = advanceDungeonState(went, "d_entrance");
    expect(back.current_room_id).toBe("d_entrance");
    expect(back.rooms_visited).toEqual(["d_entrance", "d_middle"]); // unchanged
  });
});

describe("markRoomDiscovered / markRoomUnlocked", () => {
  it("markRoomDiscovered sets discovered:true exactly once", () => {
    const d = makeDungeon();
    const a = markRoomDiscovered(d, "d_middle");
    expect(a.dungeon_rooms!.find((r) => r.id === "d_middle")!.discovered).toBe(true);
    // Idempotent
    const b = markRoomDiscovered(a, "d_middle");
    expect(b).toBe(a); // no new object when already discovered
  });

  it("markRoomDiscovered no-ops on unknown room id", () => {
    const d = makeDungeon();
    expect(markRoomDiscovered(d, "nope")).toBe(d);
  });

  it("markRoomUnlocked flips lock.unlocked to true", () => {
    const d = makeDungeon();
    const a = markRoomUnlocked(d, "d_boss");
    expect(a.dungeon_rooms!.find((r) => r.id === "d_boss")!.lock!.unlocked).toBe(true);
    // Idempotent
    const b = markRoomUnlocked(a, "d_boss");
    expect(b).toBe(a);
  });

  it("markRoomUnlocked no-ops on rooms without a lock", () => {
    const d = makeDungeon();
    expect(markRoomUnlocked(d, "d_entrance")).toBe(d);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Nav-card construction
// ─────────────────────────────────────────────────────────────────────────────

describe("roomTypeLabel", () => {
  it("maps each room_type to its display label", () => {
    expect(roomTypeLabel("entrance")).toBe("ENTRANCE");
    expect(roomTypeLabel("middle")).toBe("CHAMBER");
    expect(roomTypeLabel("side")).toBe("SIDE ROOM");
    expect(roomTypeLabel("boss")).toBe("BOSS");
  });
});

describe("buildRoomCards", () => {
  const dungeon = makeDungeon();

  it("from the entrance: one card for the middle chamber, NOT visited yet", () => {
    const ds: MasterState["dungeon_state"] = {
      node_id:         dungeon.id,
      current_room_id: "d_entrance",
      rooms_visited:   ["d_entrance"],
    };
    const cards = buildRoomCards(dungeon, ds, []);
    expect(cards).toHaveLength(1);
    expect(cards[0].room_id).toBe("d_middle");
    expect(cards[0].type_label).toBe("CHAMBER");
    expect(cards[0].locked).toBe(false);
    expect(cards[0].visited).toBe(false);
  });

  it("from the middle: two cards (entrance + boss); boss is LOCKED without key", () => {
    const ds: MasterState["dungeon_state"] = {
      node_id:         dungeon.id,
      current_room_id: "d_middle",
      rooms_visited:   ["d_entrance", "d_middle"],
    };
    const cards = buildRoomCards(dungeon, ds, []);
    expect(cards.map((c) => c.room_id).sort()).toEqual(["d_boss", "d_entrance"]);
    const boss = cards.find((c) => c.room_id === "d_boss")!;
    expect(boss.locked).toBe(true);
    expect(boss.lock_hint).toBe("The door bears a single seal.");
    expect(boss.key_item_name).toBeUndefined();
    const entrance = cards.find((c) => c.room_id === "d_entrance")!;
    expect(entrance.visited).toBe(true);
  });

  it("from the middle with the key in inventory: boss card UNLOCKED, key_item_name surfaced", () => {
    const ds: MasterState["dungeon_state"] = {
      node_id:         dungeon.id,
      current_room_id: "d_middle",
      rooms_visited:   ["d_entrance", "d_middle"],
    };
    const cards = buildRoomCards(dungeon, ds, [makeKey("d_boss")]);
    const boss = cards.find((c) => c.room_id === "d_boss")!;
    // Locked remains true in the data (the door is still locked), but
    // the card surfaces key_item_name so the UI can render USE-key.
    expect(boss.locked).toBe(false);
    expect(boss.key_item_name).toBe("The Warden's Seal");
  });

  it("returns [] when the player isn't in the dungeon (mismatched state)", () => {
    expect(
      buildRoomCards(dungeon, {
        node_id: "elsewhere",
        current_room_id: "d_middle",
        rooms_visited: [],
      }, [])
    ).toEqual([]);
  });
});

describe("isAtDungeonEntrance", () => {
  const dungeon = makeDungeon();
  it("true when current_room_id is the entrance", () => {
    expect(isAtDungeonEntrance(dungeon, {
      node_id: dungeon.id,
      current_room_id: "d_entrance",
      rooms_visited: ["d_entrance"],
    })).toBe(true);
  });
  it("false from any other room", () => {
    expect(isAtDungeonEntrance(dungeon, {
      node_id: dungeon.id,
      current_room_id: "d_middle",
      rooms_visited: ["d_entrance", "d_middle"],
    })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HF1 FIX 3 — resolveDungeonExitTarget
//
// Walking BACK from a dungeon entrance must ALWAYS land on the
// geographic region zone, never the settlement hub (rule 100).
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveDungeonExitTarget (HF1 FIX 3)", () => {
  const regionZone: WorldNode = {
    id:            "pale_crossing_vale",
    name:          "Pale Crossing Vale",
    type:          "zone",
    zone_id:       "pale_crossing_vale",   // self-zoned region zone
    is_expandable: true,
    connections:   ["threnhold", "the_murmuring_crypt"],
    npc_ids:       [],
    item_ids:      [],
    asset_id:      "location_pale_crossing_vale",
    discovered:    true,
    map_position:  { x: 0, y: 0 },
    is_settlement_node: false,
  };
  const settlement: WorldNode = {
    id:            "threnhold",
    name:          "Threnhold",
    type:          "zone",
    zone_id:       "pale_crossing_vale",
    is_expandable: false,
    connections:   ["pale_crossing_vale"],
    npc_ids:       [],
    item_ids:      [],
    asset_id:      "location_threnhold",
    discovered:    true,
    map_position:  { x: 1, y: 0 },
    is_settlement_node: true,
  };

  function makeGraph(dungeonZoneId: string): WorldGraph {
    const dungeon: WorldNode = {
      ...makeDungeon(),
      id:      "the_murmuring_crypt",
      name:    "The Murmuring Crypt",
      zone_id: dungeonZoneId,
    };
    return {
      nodes: {
        [regionZone.id]:  regionZone,
        [settlement.id]:  settlement,
        [dungeon.id]:     dungeon,
      },
      current_node_id:  dungeon.id,
      starting_node_id: settlement.id,
    } as WorldGraph;
  }

  it("dungeon zone_id points straight at the region zone → returns region zone", () => {
    const graph = makeGraph("pale_crossing_vale");
    expect(resolveDungeonExitTarget(graph.nodes["the_murmuring_crypt"], graph))
      .toBe("pale_crossing_vale");
  });

  it("dungeon zone_id points at the SETTLEMENT → walks up, returns region zone (NOT settlement)", () => {
    // The bug case: AI authored the dungeon as an interior of the town.
    const graph = makeGraph("threnhold");
    const target = resolveDungeonExitTarget(graph.nodes["the_murmuring_crypt"], graph);
    expect(target).toBe("pale_crossing_vale");
    expect(target).not.toBe("threnhold");
  });

  it("returns null when the dungeon node or graph is missing", () => {
    const graph = makeGraph("pale_crossing_vale");
    expect(resolveDungeonExitTarget(undefined, graph)).toBeNull();
    expect(resolveDungeonExitTarget(graph.nodes["the_murmuring_crypt"], undefined)).toBeNull();
  });

  it("zone_id chain broken → graph topology scan finds the region zone (HF-dungeon-exit-destination)", () => {
    // Settlement's zone_id points at a node that doesn't exist, so the
    // zone_id walk can't reach a self-zoned expandable zone. The new
    // topology fallback scans for a region zone that lists this
    // dungeon in its connections — regionZone does, so the player
    // still lands on the region zone instead of the settlement.
    const graph = makeGraph("threnhold");
    graph.nodes["threnhold"] = { ...settlement, zone_id: "nonexistent_region" };
    expect(resolveDungeonExitTarget(graph.nodes["the_murmuring_crypt"], graph))
      .toBe("pale_crossing_vale");
  });

  it("dungeon zone_id missing entirely → topology scan still finds the region zone (HF-dungeon-exit-destination)", () => {
    // Outline-era race: dungeon was authored before its parent region
    // was expanded, so zone_id is the dungeon's own id (self-zoned)
    // and the regular walk can't even start. The topology scan
    // recovers via the regionZone.connections list.
    const graph = makeGraph("the_murmuring_crypt");
    expect(resolveDungeonExitTarget(graph.nodes["the_murmuring_crypt"], graph))
      .toBe("pale_crossing_vale");
  });

  it("no region in chain AND no region lists the dungeon in connections → falls back to immediate parent", () => {
    // Truly malformed graph: zone_id chain breaks AND no region zone
    // knows about this dungeon. Return the immediate parent so the
    // player isn't stranded with no BACK card.
    const graph = makeGraph("threnhold");
    graph.nodes["threnhold"] = { ...settlement, zone_id: "nonexistent_region" };
    // Strip the dungeon from the region zone's connections so the
    // topology scan also fails.
    graph.nodes["pale_crossing_vale"] = {
      ...regionZone,
      connections: regionZone.connections.filter((c) => c !== "the_murmuring_crypt"),
    };
    expect(resolveDungeonExitTarget(graph.nodes["the_murmuring_crypt"], graph))
      .toBe("threnhold");
  });
});
