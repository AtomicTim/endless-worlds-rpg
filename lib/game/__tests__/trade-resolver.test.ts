/**
 * P3 — Merchant Trading + Inn Rest resolver tests.
 *
 * Pins the mechanical commerce contract:
 *   - trust-banded buy pricing (0–40 +25% · 41–60 base · 61–80 −10% ·
 *     81–100 −20%)
 *   - insufficient-funds + out-of-stock guards
 *   - speciality-filtered selling (VALUABLE is universal)
 *   - starting equipment is worthless on sale
 *   - inn rest: 10 gold → HP to max, with an insufficient-funds guard
 */

import { Genre, ItemRarity, ItemType } from "@/types/game";
import type { Item, MasterState, NPCDefinition } from "@/types/game";
import {
  buyItem,
  sellItem,
  openTrade,
  resolveInnRest,
  trustAdjustedPrice,
} from "@/lib/game/trade-resolver";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(p: Partial<Item> & { id: string }): Item {
  return {
    id:          p.id,
    name:        p.name ?? p.id,
    type:        p.type ?? ItemType.CONSUMABLE,
    rarity:      p.rarity ?? ItemRarity.COMMON,
    description: p.description ?? "",
    quantity:    p.quantity ?? 1,
    stackable:   p.stackable ?? false,
    value:       p.value,
    equipped:    p.equipped,
    starting_item: p.starting_item,
  } as Item;
}

interface StateOpts {
  trust?:              number;
  gold?:               number;
  health?:             number;
  maxHealth?:          number;
  inventory?:          Item[];
  merchantInventory?:  Item[];
  merchantSpeciality?: ItemType[];
}

const MERCHANT_ID   = "character_bram";
const MERCHANT_NAME = "Bram the Trader";

function makeState(opts: StateOpts = {}): MasterState {
  const merchant: NPCDefinition = {
    id:                  MERCHANT_ID,
    name:                MERCHANT_NAME,
    home_location_id:    "loc_market",
    role:                "merchant",
    archetype:           "merchant",
    appearance:          "",
    personality:         "",
    speech_style:        "",
    knowledge:           [],
    default_trust:       opts.trust ?? 55,
    merchant_inventory:  opts.merchantInventory ?? [],
    merchant_speciality: opts.merchantSpeciality,
  };
  return {
    metadata: {
      genre:        Genre.FANTASY,
      world_bible:  { starting_region: { npcs: [merchant] } },
      region_bibles: {},
    },
    player_state: {
      health:     opts.health ?? 30,
      max_health: opts.maxHealth ?? 30,
      resources:  { gold: opts.gold ?? 200 },
      inventory:  opts.inventory ?? [],
    },
    npc_registry: {},
  } as unknown as MasterState;
}

// ── trustAdjustedPrice (pure formula) ────────────────────────────────────────

describe("trustAdjustedPrice — CLAUDE.md MERCHANT TRADING bands", () => {
  it("trust ≤ 40 → +25% (ceil)", () => {
    expect(trustAdjustedPrice(100, 30)).toBe(Math.ceil(100 * 1.25)); // 125
    expect(trustAdjustedPrice(13, 0)).toBe(Math.ceil(13 * 1.25));    // 17 (ceil)
  });
  it("41–60 → base", () => {
    expect(trustAdjustedPrice(100, 55)).toBe(100);
  });
  it("61–80 → −10% (floor)", () => {
    expect(trustAdjustedPrice(100, 70)).toBe(Math.floor(100 * 0.9)); // 90
  });
  it("81–100 → −20% (floor)", () => {
    expect(trustAdjustedPrice(100, 90)).toBe(Math.floor(100 * 0.8)); // 80
  });
});

// ── buyItem — trust-banded pricing ───────────────────────────────────────────

describe("buyItem — trust-adjusted pricing", () => {
  const stock = () => [makeItem({ id: "potion", name: "Health Potion", value: 100 })];

  it("trust = 30 → price = ceil(base × 1.25)", () => {
    const result = buyItem(makeState({ trust: 30, merchantInventory: stock() }), MERCHANT_ID, "potion");
    expect("ok" in result && result.ok).toBe(true);
    if ("ok" in result) expect(result.price_paid).toBe(Math.ceil(100 * 1.25)); // 125
  });

  it("trust = 55 → price = base", () => {
    const result = buyItem(makeState({ trust: 55, merchantInventory: stock() }), MERCHANT_ID, "potion");
    if ("error" in result) throw new Error(result.error);
    expect(result.price_paid).toBe(100);
  });

  it("trust = 70 → price = floor(base × 0.90)", () => {
    const result = buyItem(makeState({ trust: 70, merchantInventory: stock() }), MERCHANT_ID, "potion");
    if ("error" in result) throw new Error(result.error);
    expect(result.price_paid).toBe(Math.floor(100 * 0.9)); // 90
  });

  it("trust = 90 → price = floor(base × 0.80)", () => {
    const result = buyItem(makeState({ trust: 90, merchantInventory: stock() }), MERCHANT_ID, "potion");
    if ("error" in result) throw new Error(result.error);
    expect(result.price_paid).toBe(Math.floor(100 * 0.8)); // 80
  });

  it("deducts the price, hands the item to the player, and depletes merchant stock", () => {
    const result = buyItem(
      makeState({ trust: 55, gold: 200, merchantInventory: stock() }),
      MERCHANT_ID,
      "potion",
    );
    if ("error" in result) throw new Error(result.error);
    expect(result.new_balance).toBe(100);                                  // 200 − 100
    expect(result.state.player_state.resources.gold).toBe(100);
    expect(result.state.player_state.inventory.find((i) => i.id === "potion")?.quantity).toBe(1);
    // Merchant stack depletes to 0 but the row remains (UI shows "Sold Out").
    const merchantStock = result.state.metadata.world_bible!.starting_region.npcs[0].merchant_inventory!;
    expect(merchantStock[0].quantity).toBe(0);
  });

  it("insufficient funds → error 'insufficient_funds'", () => {
    const result = buyItem(
      makeState({ trust: 55, gold: 10, merchantInventory: stock() }),
      MERCHANT_ID,
      "potion",
    );
    expect(result).toEqual({ error: "insufficient_funds" });
  });

  it("item not in merchant inventory → error 'item_not_available'", () => {
    const result = buyItem(
      makeState({ trust: 55, merchantInventory: stock() }),
      MERCHANT_ID,
      "nonexistent_item",
    );
    expect(result).toEqual({ error: "item_not_available" });
  });

  it("a depleted (quantity 0) stack → error 'item_not_available'", () => {
    const result = buyItem(
      makeState({ merchantInventory: [makeItem({ id: "potion", value: 50, quantity: 0 })] }),
      MERCHANT_ID,
      "potion",
    );
    expect(result).toEqual({ error: "item_not_available" });
  });
});

// ── sellItem — speciality filtering ──────────────────────────────────────────

describe("sellItem — speciality filtering + value rules", () => {
  it("VALUABLE is accepted by a merchant with no speciality", () => {
    const gem = makeItem({ id: "gem", name: "Ruby", type: ItemType.VALUABLE, value: 80 });
    const result = sellItem(
      makeState({ inventory: [gem] }), // merchantSpeciality undefined
      MERCHANT_ID,
      "gem",
    );
    if ("error" in result) throw new Error(result.error);
    expect(result.sell_price).toBe(40);            // floor(80 × 0.5)
    expect(result.new_balance).toBe(240);          // 200 + 40
  });

  it("a WEAPON sold to a non-blacksmith → error 'merchant_not_interested'", () => {
    const sword = makeItem({ id: "sword", name: "Iron Sword", type: ItemType.WEAPON, value: 120 });
    const result = sellItem(
      makeState({ inventory: [sword], merchantSpeciality: [ItemType.CONSUMABLE] }),
      MERCHANT_ID,
      "sword",
    );
    expect(result).toEqual({ error: "merchant_not_interested" });
  });

  it("a WEAPON sold to a merchant whose speciality includes WEAPON → accepted", () => {
    const sword = makeItem({ id: "sword", name: "Iron Sword", type: ItemType.WEAPON, value: 120 });
    const result = sellItem(
      makeState({ inventory: [sword], merchantSpeciality: [ItemType.WEAPON, ItemType.ARMOR] }),
      MERCHANT_ID,
      "sword",
    );
    if ("error" in result) throw new Error(result.error);
    expect(result.sell_price).toBe(60); // floor(120 × 0.5)
  });

  it("starting equipment (value 0) → error 'no_value', no state change", () => {
    const startingSword = makeItem({
      id: "starter_blade", name: "Worn Blade", type: ItemType.WEAPON,
      value: 0, starting_item: true,
    });
    const state = makeState({ inventory: [startingSword], merchantSpeciality: [ItemType.WEAPON] });
    const result = sellItem(state, MERCHANT_ID, "starter_blade");
    expect(result).toEqual({ error: "no_value" });
    // No mutation — the player still holds the blade and the same gold.
    expect(state.player_state.inventory).toHaveLength(1);
    expect(state.player_state.resources.gold).toBe(200);
  });
});

// ── openTrade — world-asset-backed inventory, no narrator ─────────────────────

describe("openTrade — reads inventory from the world asset", () => {
  it("returns the merchant's merchant_inventory verbatim (no narrator fallback)", () => {
    const wares = [makeItem({ id: "potion", value: 12 }), makeItem({ id: "rope", value: 5 })];
    const result = openTrade(makeState({ trust: 72, merchantInventory: wares }), MERCHANT_NAME);
    if ("error" in result) throw new Error(result.error);
    expect(result.inventory).toHaveLength(2);
    expect(result.npc_name).toBe(MERCHANT_NAME);
    expect(result.npc_trust).toBe(72);
  });

  it("an empty merchant_inventory returns an empty array (no narrator fill-in)", () => {
    const result = openTrade(makeState({ merchantInventory: [] }), MERCHANT_ID);
    if ("error" in result) throw new Error(result.error);
    expect(result.inventory).toEqual([]);
  });

  it("unknown NPC → error 'npc_not_found'", () => {
    expect(openTrade(makeState(), "Nobody At All")).toEqual({ error: "npc_not_found" });
  });
});

// ── resolveInnRest ───────────────────────────────────────────────────────────

describe("resolveInnRest — innkeeper rest action", () => {
  it("deducts 10 gold and restores HP to max_health", () => {
    const state  = makeState({ gold: 50, health: 8, maxHealth: 30 });
    const result = resolveInnRest(state);
    if ("error" in result) throw new Error(result.error);
    expect(result.cost).toBe(10);
    expect(result.new_balance).toBe(40);
    expect(result.state.player_state.resources.gold).toBe(40);
    expect(result.state.player_state.health).toBe(30); // full
  });

  it("insufficient gold → error 'insufficient_funds', no state change", () => {
    const state  = makeState({ gold: 5, health: 8, maxHealth: 30 });
    const result = resolveInnRest(state);
    expect(result).toEqual({ error: "insufficient_funds" });
    // Original state untouched — still poor, still hurt.
    expect(state.player_state.resources.gold).toBe(5);
    expect(state.player_state.health).toBe(8);
  });
});
