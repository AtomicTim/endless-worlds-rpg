/**
 * P3 — Merchant Trading + Inn Rest (pure resolver layer).
 *
 * Mirrors the combat-resolver / loot-resolver pattern: all the mechanical
 * commerce logic lives here as pure, synchronous, side-effect-free
 * functions so it can be unit-tested without React or the game store.
 * `hooks/useGameLoop.ts` wires these into the buyItem / sellItem /
 * openTrade / restAtInn callbacks.
 *
 * MERCHANT TRADING (CLAUDE.md, locked):
 *   - Inventory is world-asset-backed: it lives on NPCDefinition
 *     .merchant_inventory inside metadata.world_bible / region_bibles,
 *     seeded at generation time, never narrator-generated.
 *   - Trust pricing: 0–40 = +25% · 41–60 = base · 61–80 = −10% ·
 *     81–100 = −20%.
 *   - Selling is speciality-filtered; VALUABLE sells to any merchant.
 *   - Starting equipment sells for 0.
 *
 * INN REST (CLAUDE.md DEATH PENALTY): innkeeper → 10 gold → HP to
 * max_health.
 */

import { ItemType, type Item, type MasterState, type NPCDefinition } from "@/types/game";
import { currencyKeyFor } from "./currency";
import { INVENTORY_CAP } from "./constants";
import { addToInventory, removeFromInventory } from "./state-utils";

/** Inn-rest cost, in genre currency (CLAUDE.md DEATH PENALTY). */
export const INN_REST_COST = 10;

// ─────────────────────────────────────────────────────────────────────────────
// NPC lookup
// ─────────────────────────────────────────────────────────────────────────────

/** Where a merchant NPC lives in the bible tree — needed so depletion /
 *  buyback can be written back immutably to the right place. */
export type MerchantSource =
  | { kind: "world" }
  | { kind: "region"; regionId: string };

export interface MerchantLookup {
  npc:    NPCDefinition;
  source: MerchantSource;
}

/** Normalize a name/id for tolerant matching. */
function norm(s: string): string {
  return s.toLowerCase().trim();
}

/**
 * Find an NPC by id or (case-insensitive) name across the WorldBible
 * starting region and every applied RegionBible. Returns the NPC plus
 * its source location so callers can write back a depleted inventory.
 */
export function findMerchantNpc(
  state:  MasterState,
  npcRef: string | null | undefined
): MerchantLookup | null {
  if (!npcRef) return null;
  const target = norm(npcRef);
  const matches = (n: NPCDefinition): boolean =>
    norm(n.id) === target || norm(n.name) === target;

  const worldNpcs = state.metadata.world_bible?.starting_region?.npcs ?? [];
  const inWorld = worldNpcs.find(matches);
  if (inWorld) return { npc: inWorld, source: { kind: "world" } };

  const regionBibles = state.metadata.region_bibles ?? {};
  for (const [regionId, bible] of Object.entries(regionBibles)) {
    const inRegion = (bible?.npcs ?? []).find(matches);
    if (inRegion) return { npc: inRegion, source: { kind: "region", regionId } };
  }
  return null;
}

/**
 * Immutably replace a merchant NPC's `merchant_inventory` in the bible
 * tree, returning a new MasterState. Used by buyItem (deplete) and
 * sellItem (buyback). The mutated bible rides along with the next
 * master_state auto-save — no separate world_asset persist needed since
 * merchant_inventory is bible-scoped, not constitution-scoped.
 */
export function setMerchantInventory(
  state:        MasterState,
  lookup:       MerchantLookup,
  newInventory: Item[]
): MasterState {
  const mapNpc = (n: NPCDefinition): NPCDefinition =>
    n.id === lookup.npc.id ? { ...n, merchant_inventory: newInventory } : n;

  if (lookup.source.kind === "world") {
    const wb = state.metadata.world_bible;
    if (!wb?.starting_region) return state;
    return {
      ...state,
      metadata: {
        ...state.metadata,
        world_bible: {
          ...wb,
          starting_region: {
            ...wb.starting_region,
            npcs: (wb.starting_region.npcs ?? []).map(mapNpc),
          },
        },
      },
    };
  }

  const { regionId } = lookup.source;
  const rb = state.metadata.region_bibles?.[regionId];
  if (!rb) return state;
  return {
    ...state,
    metadata: {
      ...state.metadata,
      region_bibles: {
        ...state.metadata.region_bibles,
        [regionId]: { ...rb, npcs: (rb.npcs ?? []).map(mapNpc) },
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Trust + pricing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Current trust toward a merchant. Prefers the live npc_registry score
 * (updated by dialogue / actions over the playthrough); falls back to
 * the NPC's seeded `default_trust` when no registry entry exists yet.
 */
export function getMerchantTrust(state: MasterState, npc: NPCDefinition): number {
  const registry = state.npc_registry ?? {};
  // Tolerant key resolution — registries are keyed by id, slug, or
  // "character_<slug>" depending on vintage. Try id and name directly,
  // then a name-based scan.
  const direct = registry[npc.id];
  if (direct) return direct.trust_score;
  const target = norm(npc.name);
  for (const entry of Object.values(registry)) {
    if (norm(entry.name) === target) return entry.trust_score;
  }
  return npc.default_trust ?? 50;
}

/**
 * Trust-adjusted BUY price. Exclusive trust bands (CLAUDE.md MERCHANT
 * TRADING): 0–40 = +25% · 41–60 = base · 61–80 = −10% · 81–100 = −20%.
 */
export function trustAdjustedPrice(basePrice: number, trust: number): number {
  if (trust <= 40) return Math.ceil(basePrice * 1.25);
  if (trust <= 60) return basePrice;
  if (trust <= 80) return Math.floor(basePrice * 0.9);
  return Math.floor(basePrice * 0.8);
}

/** SELL price — flat 50% of base value, no trust adjustment. */
export function sellPriceFor(item: Item): number {
  return Math.floor((item.value ?? 0) * 0.5);
}

/** True when the merchant accepts this item on a sell:
 *  VALUABLE is universal; otherwise the type must be in the speciality. */
export function merchantAcceptsItem(npc: NPCDefinition, item: Item): boolean {
  if (item.type === ItemType.VALUABLE) return true;
  return (npc.merchant_speciality ?? []).includes(item.type);
}

// ─────────────────────────────────────────────────────────────────────────────
// openTrade
// ─────────────────────────────────────────────────────────────────────────────

export interface OpenTradeResult {
  npc_id:         string;
  npc_name:       string;
  npc_role:       string;
  npc_trust:      number;
  /** The merchant's inventory — source of truth, NOT narrator-generated.
   *  Empty when the NPC has no merchant_inventory seeded. */
  inventory:      Item[];
  npc_speciality: ItemType[];
}

/**
 * Open trade with a merchant. Reads the merchant_inventory directly off
 * the world-asset-backed NPCDefinition — there is NO narrator fallback.
 * Returns an error only when the NPC can't be resolved at all.
 */
export function openTrade(
  state:  MasterState,
  npcRef: string | null | undefined
): OpenTradeResult | { error: "npc_not_found" } {
  const lookup = findMerchantNpc(state, npcRef);
  if (!lookup) return { error: "npc_not_found" };
  const { npc } = lookup;
  return {
    npc_id:         npc.id,
    npc_name:       npc.name,
    npc_role:       npc.role,
    npc_trust:      getMerchantTrust(state, npc),
    inventory:      npc.merchant_inventory ?? [],
    npc_speciality: npc.merchant_speciality ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// buyItem
// ─────────────────────────────────────────────────────────────────────────────

export type BuyError =
  | "npc_not_found"
  | "no_currency"
  | "item_not_available"
  | "insufficient_funds"
  | "inventory_full";

export interface BuySuccess {
  ok:          true;
  item:        Item;
  price_paid:  number;
  new_balance: number;
  state:       MasterState;
}

/**
 * Buy one unit of an item from a merchant.
 *   - Price is trust-adjusted off item.value.
 *   - Stock depletes: the bought item's quantity drops by 1; a stack
 *     that hits 0 stays in merchant_inventory so the UI can show
 *     "Sold Out" (and a re-buy attempt returns item_not_available).
 *   - Currency is deducted; the item lands in the player inventory
 *     (respecting INVENTORY_CAP = 20).
 */
export function buyItem(
  state:  MasterState,
  npcRef: string | null | undefined,
  itemId: string
): BuySuccess | { error: BuyError } {
  const lookup = findMerchantNpc(state, npcRef);
  if (!lookup) return { error: "npc_not_found" };

  const currencyKey = currencyKeyFor(state.metadata.genre);
  if (!currencyKey) return { error: "no_currency" };

  const inventory = lookup.npc.merchant_inventory ?? [];
  const idx = inventory.findIndex((i) => i.id === itemId);
  if (idx < 0) return { error: "item_not_available" };
  const stockItem = inventory[idx];
  if ((stockItem.quantity ?? 0) <= 0) return { error: "item_not_available" };

  const trust = getMerchantTrust(state, lookup.npc);
  const price = trustAdjustedPrice(stockItem.value ?? 0, trust);

  const balance = state.player_state.resources[currencyKey] ?? 0;
  if (balance < price) return { error: "insufficient_funds" };

  // INVENTORY_CAP only blocks a brand-new row — topping up an existing
  // stack is always allowed.
  const alreadyHeld = state.player_state.inventory.some((i) => i.id === itemId);
  if (!alreadyHeld && state.player_state.inventory.length >= INVENTORY_CAP) {
    return { error: "inventory_full" };
  }

  // Deplete merchant stock (keep the row at quantity 0 for "Sold Out").
  const depletedInventory = inventory.map((i, k) =>
    k === idx ? { ...i, quantity: (i.quantity ?? 1) - 1 } : i
  );

  // The unit handed to the player — a clean quantity-1, unequipped copy.
  const purchased: Item = { ...stockItem, quantity: 1, equipped: false };

  let next = setMerchantInventory(state, lookup, depletedInventory);
  next = addToInventory(next, purchased);
  const newBalance = balance - price;
  next = {
    ...next,
    player_state: {
      ...next.player_state,
      resources: { ...next.player_state.resources, [currencyKey]: newBalance },
    },
  };

  return { ok: true, item: purchased, price_paid: price, new_balance: newBalance, state: next };
}

// ─────────────────────────────────────────────────────────────────────────────
// sellItem
// ─────────────────────────────────────────────────────────────────────────────

export type SellError =
  | "npc_not_found"
  | "no_currency"
  | "item_not_owned"
  | "merchant_not_interested"
  | "no_value";

export interface SellSuccess {
  ok:          true;
  item:        Item;
  sell_price:  number;
  new_balance: number;
  state:       MasterState;
}

/**
 * Sell one unit of a player-owned item to a merchant.
 *   - Speciality-filtered: VALUABLE sells to anyone; everything else
 *     must match npc.merchant_speciality.
 *   - Starting equipment (value 0 or starting_item) is worthless:
 *     returns `no_value`, no state change.
 *   - Sell price = 50% of value; item is removed from the player and
 *     bought back into merchant_inventory.
 */
export function sellItem(
  state:  MasterState,
  npcRef: string | null | undefined,
  itemId: string
): SellSuccess | { error: SellError } {
  const lookup = findMerchantNpc(state, npcRef);
  if (!lookup) return { error: "npc_not_found" };

  const currencyKey = currencyKeyFor(state.metadata.genre);
  if (!currencyKey) return { error: "no_currency" };

  const owned = state.player_state.inventory.find((i) => i.id === itemId);
  if (!owned) return { error: "item_not_owned" };

  if (!merchantAcceptsItem(lookup.npc, owned)) {
    return { error: "merchant_not_interested" };
  }

  // Starting equipment has no resale value (CLAUDE.md ECONOMY BASELINE).
  const sellPrice = sellPriceFor(owned);
  if (owned.starting_item === true || sellPrice <= 0) {
    return { error: "no_value" };
  }

  // Remove one unit from the player.
  let next = removeFromInventory(state, itemId, 1);
  const balance = next.player_state.resources[currencyKey] ?? 0;
  const newBalance = balance + sellPrice;
  next = {
    ...next,
    player_state: {
      ...next.player_state,
      resources: { ...next.player_state.resources, [currencyKey]: newBalance },
    },
  };

  // Buy-back into the merchant's inventory: bump an existing row or add
  // a fresh quantity-1, unequipped row.
  const inventory = lookup.npc.merchant_inventory ?? [];
  const existingIdx = inventory.findIndex((i) => i.id === itemId);
  const boughtBack: Item[] = existingIdx >= 0
    ? inventory.map((i, k) =>
        k === existingIdx ? { ...i, quantity: (i.quantity ?? 0) + 1 } : i
      )
    : [...inventory, { ...owned, quantity: 1, equipped: false }];
  next = setMerchantInventory(next, lookup, boughtBack);

  const soldUnit: Item = { ...owned, quantity: 1, equipped: false };
  return { ok: true, item: soldUnit, sell_price: sellPrice, new_balance: newBalance, state: next };
}

// ─────────────────────────────────────────────────────────────────────────────
// Inn Rest
// ─────────────────────────────────────────────────────────────────────────────

export type InnRestError = "no_currency" | "insufficient_funds";

export interface InnRestSuccess {
  ok:          true;
  cost:        number;
  new_balance: number;
  state:       MasterState;
}

/**
 * Resolve an innkeeper "rest" action: deduct INN_REST_COST and restore
 * HP to max_health. Pure — the caller emits the story-feed beat and the
 * rest_complete signal. Returns `insufficient_funds` (no state change)
 * when the player can't cover the room.
 */
export function resolveInnRest(
  state: MasterState,
  cost:  number = INN_REST_COST
): InnRestSuccess | { error: InnRestError } {
  const currencyKey = currencyKeyFor(state.metadata.genre);
  if (!currencyKey) return { error: "no_currency" };

  const balance = state.player_state.resources[currencyKey] ?? 0;
  if (balance < cost) return { error: "insufficient_funds" };

  const newBalance = balance - cost;
  const next: MasterState = {
    ...state,
    player_state: {
      ...state.player_state,
      health:    state.player_state.max_health,
      resources: { ...state.player_state.resources, [currencyKey]: newBalance },
    },
  };
  return { ok: true, cost, new_balance: newBalance, state: next };
}
