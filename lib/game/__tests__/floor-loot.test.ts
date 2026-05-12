/**
 * Day 21 TASK 12 — floor-loot pure state transitions.
 *
 * Covers the routing helpers that back FloorLootStrip + useFloorLoot:
 *   - applySearchRemains (PENDING → resolved + items/gold)
 *   - applyTake (one item → inventory, INVENTORY_CAP guard)
 *   - applyTakeGold (gold → resources by genre key)
 *   - applyTakeAll (take gold + cap-bounded items in one pass)
 *   - buildFloorLootView (filter by node + inventory-full flag)
 *
 * Rule 71 — these handlers are the "routing helpers" the FloorLootStrip
 * relies on; integration tests at this layer fail fast if anyone
 * renames a node_id key or the FloorLootEntry shape drifts.
 */

import { Difficulty, Genre, ItemRarity, ItemType, LocationStatus } from "@/types/game";
import type { FloorLootEntry, Item, MasterState } from "@/types/game";
import { INVENTORY_CAP } from "@/lib/game/constants";
import {
  applySearchRemains,
  applyTake,
  applyTakeAll,
  applyTakeGold,
  buildFloorLootView,
  pickBossDropItemForNode,
  pickRegionLootItemsForNode,
} from "@/lib/game/floor-loot";

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeItem(name: string, opts: Partial<Item> = {}): Item {
  return {
    id:          opts.id ?? `id_${name.toLowerCase().replace(/\W+/g, "_")}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    type:        opts.type ?? ItemType.VALUABLE,
    rarity:      opts.rarity ?? ItemRarity.COMMON,
    description: opts.description ?? "",
    quantity:    1,
    stackable:   false,
    effect:      {},
    value:       opts.value ?? 10,
    ...opts,
  };
}

function makeState(overrides: Partial<MasterState> = {}): MasterState {
  return {
    metadata: {
      genre:       Genre.FANTASY,
      tone:        "heroic",
      difficulty:  Difficulty.NORMAL,
      session_id:  "test-session",
      created_at:  new Date(0).toISOString(),
      last_played: new Date(0).toISOString(),
    },
    player_state: {
      name:       "TestHero",
      background: "knight",
      health:     30,
      max_health: 30,
      resources:  { gold: 0 },
      attributes: {
        strength: 3, agility: 3, charisma: 3, intelligence: 3, perception: 3,
      },
      inventory: [],
      level:     1,
      xp:        0,
    },
    world_state: {
      current_location_id: "node_a",
      visited_locations:   ["node_a"],
      flags:               {},
      location_status:     LocationStatus.PRESENT,
    },
    log_book: { entries: [], session_summary: null },
    npc_registry: {},
    ...overrides,
  };
}

const PENDING_ENTRY: FloorLootEntry = {
  id:      "entry_pending",
  node_id: "node_a",
  items:   [],
  gold:    0,
  owner:   null,
  source:  "enemy",
  pending: {
    enemy_instance_ids: ["fantasy_goblin_1"],
    enemy_loot_refs:    [{ loot_table_id: "fantasy_goblin_loot", is_boss: false }],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// applySearchRemains
// ─────────────────────────────────────────────────────────────────────────────

describe("applySearchRemains", () => {
  it("resolves the pending entry into items + gold and clears `pending`", () => {
    const state = makeState({ floor_loot: [PENDING_ENTRY] });
    // rng=0 means every drop gate trips; this loot ref will produce
    // 3+ items and gold.
    const result = applySearchRemains(state, PENDING_ENTRY.id, { rng: () => 0 });
    expect(result).not.toBeNull();
    const entry = result!.state.floor_loot![0];
    expect(entry.pending).toBeUndefined();
    expect(entry.items.length).toBeGreaterThanOrEqual(1);
    expect(entry.gold).toBeGreaterThan(0);
    expect(result!.beat).toMatch(/uncover|find/);
  });

  it("returns null when the entry id doesn't exist", () => {
    const state = makeState({ floor_loot: [PENDING_ENTRY] });
    expect(applySearchRemains(state, "nonexistent_id", { rng: () => 0 })).toBeNull();
  });

  it("returns null when the entry is already resolved (no pending field)", () => {
    const resolvedEntry: FloorLootEntry = {
      id:      "entry_resolved",
      node_id: "node_a",
      items:   [makeItem("Already Here")],
      gold:    5,
      owner:   null,
      source:  "enemy",
    };
    const state = makeState({ floor_loot: [resolvedEntry] });
    expect(applySearchRemains(state, resolvedEntry.id, { rng: () => 0 })).toBeNull();
  });

  it("empty result still resolves and emits the 'nothing left to give' beat", () => {
    const state = makeState({ floor_loot: [PENDING_ENTRY] });
    // rng=0.99 means every drop gate misses.
    const result = applySearchRemains(state, PENDING_ENTRY.id, { rng: () => 0.99 });
    expect(result).not.toBeNull();
    expect(result!.itemsFound.length).toBe(0);
    expect(result!.goldFound).toBe(0);
    expect(result!.beat).toContain("nothing left to give");
    // pending is still cleared.
    expect(result!.state.floor_loot![0].pending).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyTake
// ─────────────────────────────────────────────────────────────────────────────

describe("applyTake", () => {
  it("moves an item from the entry into player.inventory", () => {
    const itemA = makeItem("Cut Gemstone", { id: "item_a" });
    const itemB = makeItem("Silver Brooch", { id: "item_b" });
    const entry: FloorLootEntry = {
      id: "e1", node_id: "node_a", items: [itemA, itemB], gold: 0, owner: null, source: "container",
    };
    const state = makeState({ floor_loot: [entry] });

    const next = applyTake(state, entry.id, "item_a");
    expect(next).not.toBeNull();
    expect(next!.player_state.inventory.map((i) => i.id)).toContain("item_a");
    expect(next!.floor_loot![0].items.map((i) => i.id)).toEqual(["item_b"]);
  });

  it("removes the entry entirely when the last item is taken AND gold is 0", () => {
    const item = makeItem("Lone Gem", { id: "item_lone" });
    const entry: FloorLootEntry = {
      id: "e1", node_id: "node_a", items: [item], gold: 0, owner: null, source: "container",
    };
    const state = makeState({ floor_loot: [entry] });
    const next = applyTake(state, entry.id, "item_lone");
    expect(next!.floor_loot).toEqual([]);
  });

  it("returns null when inventory is at INVENTORY_CAP", () => {
    const filler = Array.from({ length: INVENTORY_CAP }).map((_, i) =>
      makeItem(`Filler ${i}`, { id: `fill_${i}` })
    );
    const itemA = makeItem("Cut Gemstone", { id: "item_a" });
    const entry: FloorLootEntry = {
      id: "e1", node_id: "node_a", items: [itemA], gold: 0, owner: null, source: "container",
    };
    const state = makeState({
      floor_loot:   [entry],
      player_state: {
        ...makeState().player_state,
        inventory: filler,
      },
    });
    expect(applyTake(state, entry.id, "item_a")).toBeNull();
  });

  it("returns null when the item id doesn't exist on that entry", () => {
    const entry: FloorLootEntry = {
      id: "e1", node_id: "node_a",
      items: [makeItem("Real Item", { id: "real" })],
      gold: 0, owner: null, source: "container",
    };
    const state = makeState({ floor_loot: [entry] });
    expect(applyTake(state, entry.id, "ghost_id")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyTakeGold
// ─────────────────────────────────────────────────────────────────────────────

describe("applyTakeGold", () => {
  it("deposits gold into the correct currency key for fantasy", () => {
    const entry: FloorLootEntry = {
      id: "e1", node_id: "node_a", items: [], gold: 42, owner: null, source: "enemy",
    };
    const state = makeState({ floor_loot: [entry] });
    const next = applyTakeGold(state, entry.id);
    expect(next!.player_state.resources.gold).toBe(42);
    // Entry pruned since items + gold both empty.
    expect(next!.floor_loot).toEqual([]);
  });

  it("uses 'marks' for horror", () => {
    const entry: FloorLootEntry = {
      id: "e1", node_id: "node_a", items: [], gold: 10, owner: null, source: "enemy",
    };
    const state = makeState({
      metadata: { ...makeState().metadata, genre: Genre.HORROR_LOVECRAFTIAN },
      player_state: { ...makeState().player_state, resources: {} },
      floor_loot: [entry],
    });
    const next = applyTakeGold(state, entry.id);
    expect(next!.player_state.resources.marks).toBe(10);
  });

  it("uses 'caps' for post-apoc", () => {
    const entry: FloorLootEntry = {
      id: "e1", node_id: "node_a", items: [], gold: 7, owner: null, source: "container",
    };
    const state = makeState({
      metadata: { ...makeState().metadata, genre: Genre.POST_APOCALYPTIC },
      floor_loot: [entry],
    });
    const next = applyTakeGold(state, entry.id);
    expect(next!.player_state.resources.caps).toBe(7);
  });

  it("returns null when gold is 0", () => {
    const entry: FloorLootEntry = {
      id: "e1", node_id: "node_a",
      items: [makeItem("Just Items")],
      gold: 0, owner: null, source: "container",
    };
    const state = makeState({ floor_loot: [entry] });
    expect(applyTakeGold(state, entry.id)).toBeNull();
  });

  it("accumulates gold on top of an existing balance", () => {
    const entry: FloorLootEntry = {
      id: "e1", node_id: "node_a", items: [], gold: 25, owner: null, source: "enemy",
    };
    const state = makeState({
      player_state: {
        ...makeState().player_state,
        resources: { gold: 100 },
      },
      floor_loot: [entry],
    });
    const next = applyTakeGold(state, entry.id);
    expect(next!.player_state.resources.gold).toBe(125);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyTakeAll
// ─────────────────────────────────────────────────────────────────────────────

describe("applyTakeAll", () => {
  it("takes gold + all items when inventory has capacity", () => {
    const itemA = makeItem("Gem A", { id: "a" });
    const itemB = makeItem("Gem B", { id: "b" });
    const entry: FloorLootEntry = {
      id: "e1", node_id: "node_a", items: [itemA, itemB], gold: 15, owner: null, source: "container",
    };
    const state = makeState({ floor_loot: [entry] });
    const next = applyTakeAll(state, entry.id);
    expect(next!.player_state.inventory.map((i) => i.id).sort()).toEqual(["a", "b"]);
    expect(next!.player_state.resources.gold).toBe(15);
    // Entry pruned.
    expect(next!.floor_loot).toEqual([]);
  });

  it("respects INVENTORY_CAP — leaves overflow items in the entry", () => {
    const filler = Array.from({ length: INVENTORY_CAP - 1 }).map((_, i) =>
      makeItem(`F${i}`, { id: `f_${i}` })
    );
    const itemA = makeItem("Take Me", { id: "take_me" });
    const itemB = makeItem("Leave Me", { id: "leave_me" });
    const entry: FloorLootEntry = {
      id: "e1", node_id: "node_a", items: [itemA, itemB], gold: 5, owner: null, source: "container",
    };
    const state = makeState({
      player_state: { ...makeState().player_state, inventory: filler },
      floor_loot:   [entry],
    });
    const next = applyTakeAll(state, entry.id);
    // Player picked up one item (inventory was 19 → 20). The second
    // item stays on the floor.
    expect(next!.player_state.inventory.length).toBe(INVENTORY_CAP);
    expect(next!.player_state.inventory.map((i) => i.id)).toContain("take_me");
    expect(next!.floor_loot![0].items.map((i) => i.id)).toEqual(["leave_me"]);
    // Gold was taken regardless of inventory cap.
    expect(next!.player_state.resources.gold).toBe(5);
    expect(next!.floor_loot![0].gold).toBe(0);
  });

  it("returns null when both items and gold are empty (no-op)", () => {
    const entry: FloorLootEntry = {
      id: "e1", node_id: "node_a", items: [], gold: 0, owner: null, source: "container",
    };
    const state = makeState({ floor_loot: [entry] });
    expect(applyTakeAll(state, entry.id)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildFloorLootView
// ─────────────────────────────────────────────────────────────────────────────

describe("buildFloorLootView", () => {
  it("filters entries to the current node only", () => {
    const here: FloorLootEntry = {
      id: "here", node_id: "node_a", items: [], gold: 5, owner: null, source: "enemy",
    };
    const there: FloorLootEntry = {
      id: "there", node_id: "node_b", items: [], gold: 5, owner: null, source: "enemy",
    };
    const view = buildFloorLootView([here, there], "node_a", Genre.FANTASY, 0);
    expect(view.entries.map((e) => e.id)).toEqual(["here"]);
  });

  it("flags inventoryFull at INVENTORY_CAP", () => {
    const view = buildFloorLootView([], "node_a", Genre.FANTASY, INVENTORY_CAP);
    expect(view.inventoryFull).toBe(true);
  });

  it("does NOT flag inventoryFull just below the cap", () => {
    const view = buildFloorLootView([], "node_a", Genre.FANTASY, INVENTORY_CAP - 1);
    expect(view.inventoryFull).toBe(false);
  });

  it("returns the genre-appropriate currency label", () => {
    expect(buildFloorLootView([], "n", Genre.FANTASY, 0).currencyLabel).toBe("Gold");
    expect(buildFloorLootView([], "n", Genre.CYBERPUNK, 0).currencyLabel).toBe("Credits");
    expect(buildFloorLootView([], "n", Genre.HORROR_LOVECRAFTIAN, 0).currencyLabel).toBe("Marks");
    expect(buildFloorLootView([], "n", Genre.SPACE_OPERA, 0).currencyLabel).toBe("Stellar Units");
    expect(buildFloorLootView([], "n", Genre.POST_APOCALYPTIC, 0).currencyLabel).toBe("Caps");
  });

  it("handles undefined floor_loot input cleanly", () => {
    const view = buildFloorLootView(undefined, "node_a", Genre.FANTASY, 0);
    expect(view.entries).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// pick*ForNode — region / boss-drop lookup
// ─────────────────────────────────────────────────────────────────────────────

describe("pickRegionLootItemsForNode + pickBossDropItemForNode", () => {
  it("returns undefined when no region claims the node", () => {
    const state = makeState();
    expect(pickRegionLootItemsForNode(state, "node_unknown")).toBeUndefined();
    expect(pickBossDropItemForNode(state, "node_unknown")).toBeUndefined();
  });

  it("finds region_loot_items via world_bible.starting_region.locations", () => {
    const item = makeItem("Salt Vial");
    const state = makeState({
      metadata: {
        ...makeState().metadata,
        world_bible: {
          starting_region: {
            id: "salt_plains",
            name: "Salt Plains",
            type: "settlement_hub",
            grid_centre: { x: 0, y: 0 },
            grid_radius: 3,
            atmosphere: "",
            locations: [{
              id: "settlement_node",
              name: "Town",
              type: "settlement",
              grid_position: { x: 0, y: 0 },
              region_id: "salt_plains",
              is_settlement_node: true,
              is_interior: false,
              atmosphere: "",
              connections: [],
              npc_ids: [],
              objects: [],
              ambient_type: "town_square",
            }],
            npcs: [],
            exits: [],
            region_loot_items: [item],
          },
          adjacent_regions: [],
          generated_at: "0",
        },
      },
    });
    expect(pickRegionLootItemsForNode(state, "settlement_node")).toEqual([item]);
  });
});
