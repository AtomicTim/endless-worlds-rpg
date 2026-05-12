import { LogEntryType } from "@/types/game";
import type { FloorLootEntry, Genre, Item, MasterState } from "@/types/game";
import { addLogEntry } from "./state-utils";
import { resolveLoot } from "./loot-resolver";
import { currencyKeyFor, currencyLabelFor } from "./currency";
import { INVENTORY_CAP } from "./constants";
import { getSearchNarrative } from "./container-templates";

/**
 * Day 21 — pure state transitions for FloorLootEntry actions.
 *
 * `useFloorLoot` is a thin React wrapper that calls these, fires the
 * story-feed message, and persists. Keeping the logic out of the
 * hook means jest can pin every TAKE / SEARCH REMAINS path without
 * a React renderer (per rule 71 — integration tests for routing
 * helpers + lookup keys must live below the React layer).
 *
 * Every helper returns either a new MasterState or null when the
 * operation would be a no-op (inventory cap, entry missing, etc.).
 * Null lets the hook layer skip the persist + story-feed dispatch.
 */

export interface SearchRemainsRng {
  /** Injected rng — defaults to Math.random in production. */
  rng?: () => number;
  /** Resolved by the caller from the player's current world state.
   *  Pulled in here so the floor-loot module never has to walk
   *  the world bible itself. */
  world_loot_items?:  Item[];
  region_loot_items?: Item[];
  boss_drop_item?:    Item;
}

export interface ApplySearchRemainsResult {
  state:       MasterState;
  beat:        string;       // story-feed line to dispatch
  itemsFound:  Item[];
  goldFound:   number;
}

/**
 * Resolve a pending FloorLootEntry. Walks enemy_loot_refs through
 * resolveLoot, accumulates items + gold, clears the `pending` flag.
 * Returns the new state + the templated narrative beat for the feed.
 * Returns null when the entry doesn't exist or isn't pending.
 */
export function applySearchRemains(
  state:    MasterState,
  entry_id: string,
  ctx:      SearchRemainsRng = {}
): ApplySearchRemainsResult | null {
  const entries = state.floor_loot ?? [];
  const idx = entries.findIndex((e) => e.id === entry_id);
  if (idx < 0) return null;
  const entry = entries[idx];
  if (!entry.pending) return null;

  const items: Item[] = [];
  let gold = 0;
  for (const ref of entry.pending.enemy_loot_refs) {
    const res = resolveLoot({
      loot_table_id:     ref.loot_table_id,
      is_boss:           ref.is_boss,
      genre:             state.metadata.genre,
      world_loot_items:  ctx.world_loot_items,
      region_loot_items: ctx.region_loot_items,
      boss_drop_item:    ctx.boss_drop_item,
      rng:               ctx.rng,
    });
    items.push(...res.items);
    gold += res.gold;
  }

  const resolved: FloorLootEntry = {
    ...entry,
    items,
    gold,
    pending: undefined,
  };
  const nextEntries = entries.slice();
  nextEntries[idx] = resolved;
  const beat = items.length === 0 && gold === 0
    ? "You search the remains, but they have nothing left to give."
    : getSearchNarrative("the remains", items, gold, state.metadata.genre);

  let next: MasterState = { ...state, floor_loot: nextEntries };
  next = addLogEntry(
    next, LogEntryType.DISCOVERY,
    `Searched the remains: ${items.length} items, ${gold} gold.`
  );
  return { state: next, beat, itemsFound: items, goldFound: gold };
}

/**
 * Move ONE item from a resolved FloorLootEntry into player.inventory.
 * Returns null when:
 *   - inventory is at INVENTORY_CAP (the strip's UI guards against
 *     this, but we double-check for state safety)
 *   - the entry or the item id doesn't exist
 */
export function applyTake(
  state:    MasterState,
  entry_id: string,
  item_id:  string
): MasterState | null {
  if (state.player_state.inventory.length >= INVENTORY_CAP) return null;
  const entries = state.floor_loot ?? [];
  const idx = entries.findIndex((e) => e.id === entry_id);
  if (idx < 0) return null;
  const entry = entries[idx];
  const itemIdx = entry.items.findIndex((i) => i.id === item_id);
  if (itemIdx < 0) return null;

  const item = entry.items[itemIdx];
  const nextItems = entry.items.slice();
  nextItems.splice(itemIdx, 1);

  let next: MasterState = {
    ...state,
    player_state: {
      ...state.player_state,
      inventory: [...state.player_state.inventory, item],
    },
    floor_loot: replaceOrPrune(entries, idx, { ...entry, items: nextItems }),
  };
  next = addLogEntry(next, LogEntryType.DISCOVERY, `Picked up ${item.name}.`);
  return next;
}

/** Deposit a pile's gold into the player's currency resource. */
export function applyTakeGold(
  state:    MasterState,
  entry_id: string
): MasterState | null {
  const entries = state.floor_loot ?? [];
  const idx = entries.findIndex((e) => e.id === entry_id);
  if (idx < 0) return null;
  const entry = entries[idx];
  if (entry.gold <= 0) return null;

  const key = currencyKeyFor(state.metadata.genre);
  const current = state.player_state.resources[key] ?? 0;
  let next: MasterState = {
    ...state,
    player_state: {
      ...state.player_state,
      resources: { ...state.player_state.resources, [key]: current + entry.gold },
    },
    floor_loot: replaceOrPrune(entries, idx, { ...entry, gold: 0 }),
  };
  next = addLogEntry(
    next, LogEntryType.DISCOVERY,
    `Picked up ${entry.gold} ${currencyLabelFor(state.metadata.genre)}.`
  );
  return next;
}

/**
 * Take gold + as many items as inventory cap allows. Single-pass
 * mutation so the UI doesn't flicker through three intermediate
 * states.
 */
export function applyTakeAll(
  state:    MasterState,
  entry_id: string
): MasterState | null {
  const entries = state.floor_loot ?? [];
  const idx = entries.findIndex((e) => e.id === entry_id);
  if (idx < 0) return null;
  const entry = entries[idx];

  const key = currencyKeyFor(state.metadata.genre);
  const currentBal = state.player_state.resources[key] ?? 0;
  const remainingCap = Math.max(0, INVENTORY_CAP - state.player_state.inventory.length);

  const takenItems = entry.items.slice(0, remainingCap);
  const leftItems  = entry.items.slice(remainingCap);
  const goldTaken  = entry.gold;
  if (takenItems.length === 0 && goldTaken <= 0) return null;

  let next: MasterState = {
    ...state,
    player_state: {
      ...state.player_state,
      inventory: [...state.player_state.inventory, ...takenItems],
      resources: {
        ...state.player_state.resources,
        [key]: currentBal + goldTaken,
      },
    },
    floor_loot: replaceOrPrune(entries, idx, {
      ...entry,
      items: leftItems,
      gold:  0,
    }),
  };
  const parts: string[] = [];
  if (takenItems.length > 0) parts.push(`${takenItems.length} item(s)`);
  if (goldTaken > 0) parts.push(`${goldTaken} ${currencyLabelFor(state.metadata.genre)}`);
  next = addLogEntry(
    next, LogEntryType.DISCOVERY,
    `Picked up ${parts.length > 0 ? parts.join(" + ") : "nothing"}.`
  );
  return next;
}

/**
 * Locate the region_loot_items array that claims this node id.
 *
 * Exported here as the single canonical implementation so both
 * useGameLoop (container path) and useFloorLoot (SEARCH REMAINS
 * path) share the lookup. Pure / no React.
 */
export function pickRegionLootItemsForNode(
  state:  MasterState,
  nodeId: string
): Item[] | undefined {
  const sr = state.metadata.world_bible?.starting_region;
  if (sr) {
    const inSr =
      (Array.isArray(sr.locations) && sr.locations.some((l) => l.id === nodeId))
      || (Array.isArray(sr.region_locations) && sr.region_locations.some((l) => l.id === nodeId));
    if (inSr) return sr.region_loot_items;
  }
  const region_bibles = state.metadata.region_bibles ?? {};
  for (const rb of Object.values(region_bibles)) {
    const inRb =
      (Array.isArray(rb.locations) && rb.locations.some((l) => l.id === nodeId))
      || (Array.isArray(rb.region_locations) && rb.region_locations.some((l) => l.id === nodeId));
    if (inRb) return rb.region_loot_items;
  }
  return undefined;
}

/**
 * Locate the boss_drop_item for this node's region. Returns undefined
 * when the node isn't tied to any region with a boss drop.
 */
export function pickBossDropItemForNode(
  state:  MasterState,
  nodeId: string
): Item | undefined {
  const sr = state.metadata.world_bible?.starting_region;
  if (sr) {
    const inSr =
      (Array.isArray(sr.locations) && sr.locations.some((l) => l.id === nodeId))
      || (Array.isArray(sr.region_locations) && sr.region_locations.some((l) => l.id === nodeId));
    if (inSr) return sr.boss_drop_item;
  }
  const region_bibles = state.metadata.region_bibles ?? {};
  for (const rb of Object.values(region_bibles)) {
    const inRb =
      (Array.isArray(rb.locations) && rb.locations.some((l) => l.id === nodeId))
      || (Array.isArray(rb.region_locations) && rb.region_locations.some((l) => l.id === nodeId));
    if (inRb) return rb.boss_drop_item;
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// View helper — pure model for FloorLootStrip rendering decisions.
// ─────────────────────────────────────────────────────────────────────────────

export interface FloorLootView {
  entries:        FloorLootEntry[];
  inventoryFull:  boolean;
  currencyLabel:  string;
}

/**
 * Build the view model FloorLootStrip renders. Pure: same inputs ⇒
 * same model. Tests cover the inventory-full + filter-by-node logic
 * without needing a React renderer.
 */
export function buildFloorLootView(
  floor_loot:             FloorLootEntry[] | undefined,
  current_node_id:        string,
  genre:                  Genre | string,
  player_inventory_count: number
): FloorLootView {
  const entries = (floor_loot ?? []).filter((e) => e.node_id === current_node_id);
  return {
    entries,
    inventoryFull: player_inventory_count >= INVENTORY_CAP,
    currencyLabel: currencyLabelFor(genre),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Replace entries[idx] with the updated entry; prune when items + gold
 *  reach zero AND no pending refs remain so the strip auto-unmounts. */
function replaceOrPrune(
  entries: FloorLootEntry[],
  idx:     number,
  updated: FloorLootEntry
): FloorLootEntry[] {
  const isEmpty = updated.items.length === 0 && updated.gold === 0 && !updated.pending;
  const next = entries.slice();
  if (isEmpty) next.splice(idx, 1);
  else         next[idx] = updated;
  return next;
}
