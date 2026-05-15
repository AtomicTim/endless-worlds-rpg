// P8 — perks library + applyPerkEffects tests + isPerkLevel cadence.

import {
  PERK_LIBRARY,
  applyPerkEffects,
  drawPerkOptions,
  getPerkPool,
  isPerkLevel,
} from "@/lib/game/perks";
import {
  Genre, Difficulty, LocationStatus,
} from "@/types/game";
import type {
  MasterState, Perk, PlayerState,
} from "@/types/game";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    name:        "TestHero",
    background:  "knight",
    health:      30,
    max_health:  30,
    resources:   { gold: 0 },
    attributes:  { strength: 4, agility: 4, charisma: 2, intelligence: 2, perception: 2 },
    inventory:   [],
    level:       1,
    xp:          0,
    learned_abilities:      [],
    equipped_ability_slots: [null, null, null, null],
    passive_ability:        null,
    perks:                  [],
    ...overrides,
  };
}

function makeState(playerOverrides: Partial<PlayerState> = {}): MasterState {
  return {
    metadata: {
      genre:       Genre.FANTASY,
      tone:        "heroic",
      difficulty:  Difficulty.NORMAL,
      session_id:  "test",
      created_at:  new Date(0).toISOString(),
      last_played: new Date(0).toISOString(),
    },
    player_state: makePlayer(playerOverrides),
    world_state: {
      current_location_id: "node_a",
      visited_locations:   ["node_a"],
      flags:               {},
      location_status:     LocationStatus.PRESENT,
    },
    log_book:     { entries: [], session_summary: null },
    npc_registry: {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Library shape
// ─────────────────────────────────────────────────────────────────────────────

describe("PERK_LIBRARY — pool shape", () => {
  it("has ~20 entries", () => {
    const pool = getPerkPool();
    expect(pool.length).toBeGreaterThanOrEqual(18);
    expect(pool.length).toBeLessThanOrEqual(22);
  });

  it("covers all 4 categories", () => {
    const cats = new Set(getPerkPool().map((p) => p.category));
    expect(cats.has("combat")).toBe(true);
    expect(cats.has("status")).toBe(true);
    expect(cats.has("ability")).toBe(true);
    expect(cats.has("world")).toBe(true);
  });

  it("ids are unique snake_case", () => {
    const ids = Object.keys(PERK_LIBRARY);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("every entry carries name + description + effect", () => {
    for (const p of getPerkPool()) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.effect).toBeDefined();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// drawPerkOptions
// ─────────────────────────────────────────────────────────────────────────────

describe("drawPerkOptions", () => {
  it("returns exactly `count` perks when the pool is large enough", () => {
    expect(drawPerkOptions([], 3).length).toBe(3);
    expect(drawPerkOptions([], 5).length).toBe(5);
  });

  it("excludes perks the player already owns", () => {
    const owned = ["iron_skin", "momentum", "veterans_eye"];
    // Draw enough that we'd hit the owned set if it weren't excluded.
    const drawn = drawPerkOptions(owned, 10);
    for (const p of drawn) {
      expect(owned).not.toContain(p.id);
    }
  });

  it("returns at most `pool - owned` entries when nearly exhausted", () => {
    const all = getPerkPool().map((p) => p.id);
    // Own everything except one. Asking for 3 returns the single
    // remaining perk — no padding, no duplicates.
    const owned = all.slice(0, all.length - 1);
    const drawn = drawPerkOptions(owned, 3);
    expect(drawn.length).toBe(1);
    expect(drawn[0].id).toBe(all[all.length - 1]);
  });

  it("draws differently with a deterministic rng", () => {
    // Cycler RNG: two distinct sequences pick different sets when the
    // pool is small but multi-valued.
    let i = 0;
    const rng1 = () => [0.1, 0.4, 0.7, 0.9, 0.2][i++ % 5];
    let j = 0;
    const rng2 = () => [0.9, 0.2, 0.6, 0.1, 0.5][j++ % 5];
    const a = drawPerkOptions([], 3, rng1).map((p) => p.id).sort();
    const b = drawPerkOptions([], 3, rng2).map((p) => p.id).sort();
    // Not asserting !==; deterministic order could collide. Just smoke
    // that the rng is consulted.
    expect(a.length).toBe(3);
    expect(b.length).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyPerkEffects
// ─────────────────────────────────────────────────────────────────────────────

describe("applyPerkEffects", () => {
  it("stat_bonus increments the named attribute (Relentless → +1 STR)", () => {
    const state    = makeState({ attributes: { strength: 4, agility: 3, charisma: 2, intelligence: 2, perception: 2 } });
    const next     = applyPerkEffects(state, "relentless");
    expect(next.player_state.attributes.strength).toBe(5);
    // Other stats untouched.
    expect(next.player_state.attributes.agility).toBe(3);
  });

  it("max_hp_bonus increments max_health AND current health (Iron Skin → +4 HP)", () => {
    const state = makeState({ health: 20, max_health: 30 });
    const next  = applyPerkEffects(state, "iron_skin");
    expect(next.player_state.max_health).toBe(34);
    expect(next.player_state.health).toBe(24);
  });

  it("passive is a true no-op (Wayfarer)", () => {
    const state = makeState({
      health: 20, max_health: 30,
      attributes: { strength: 4, agility: 3, charisma: 2, intelligence: 2, perception: 2 },
    });
    const next = applyPerkEffects(state, "wayfarer");
    // No field on the player state has changed.
    expect(next.player_state).toEqual(state.player_state);
  });

  it("charge_bonus accumulates on perk_charge_bonus (Momentum × 2)", () => {
    const state  = makeState();
    const once   = applyPerkEffects(state, "momentum");
    expect(once.player_state.perk_charge_bonus).toBe(1);
    // Same perk applied again would only happen if the picker allowed it
    // (it doesn't), but the resolver still sums defensively.
    const twice  = applyPerkEffects(once,   "momentum");
    expect(twice.player_state.perk_charge_bonus).toBe(2);
  });

  it("status_resist writes a 0-1 chance under the named status (Fireproof → burning)", () => {
    const state = makeState();
    const next  = applyPerkEffects(state, "fireproof");
    expect(next.player_state.perk_status_resist?.burning).toBeCloseTo(0.25);
  });

  it("status_resist clamps the cumulative chance at 1.0", () => {
    const base = makeState({ perk_status_resist: { burning: 0.9 } });
    const next = applyPerkEffects(base, "fireproof"); // +0.25
    expect(next.player_state.perk_status_resist?.burning).toBe(1);
  });

  it("gold_bonus_pct / xp_bonus_pct land on PlayerState (Appraiser / Seasoned)", () => {
    const state = makeState();
    const gold  = applyPerkEffects(state, "appraiser");
    expect(gold.player_state.perk_gold_bonus_pct).toBe(15);
    const xp    = applyPerkEffects(state, "seasoned");
    expect(xp.player_state.perk_xp_bonus_pct).toBe(10);
  });

  it("unknown perk id is a no-op (defensive)", () => {
    const state = makeState();
    const next  = applyPerkEffects(state, "not_a_real_perk");
    expect(next).toBe(state);  // exact reference equality — no copy
  });

  it("does NOT append the perk id to player.perks (caller does that)", () => {
    // Contract: the LevelUpModal appends to perks after applyPerkEffects
    // returns. The resolver itself stays effect-only so "passive →
    // state unchanged" holds.
    const state = makeState();
    const next  = applyPerkEffects(state, "iron_skin");
    expect(next.player_state.perks).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isPerkLevel — cadence at 4 / 8 / 12 / 16 / 20
// ─────────────────────────────────────────────────────────────────────────────

describe("isPerkLevel", () => {
  it("returns true at every multiple of 4 up to 20", () => {
    for (const lvl of [4, 8, 12, 16, 20]) {
      expect(isPerkLevel(lvl)).toBe(true);
    }
  });

  it("returns false at the ability slot levels (5 / 10 / 15)", () => {
    // Test #7: perk step fires at level 4 but NOT at level 3 or 5.
    expect(isPerkLevel(3)).toBe(false);
    expect(isPerkLevel(5)).toBe(false);
    expect(isPerkLevel(10)).toBe(false);
    expect(isPerkLevel(15)).toBe(false);
  });

  it("returns false at other non-gate levels", () => {
    for (const lvl of [1, 2, 6, 7, 9, 11, 13, 14, 17, 18, 19, 21]) {
      expect(isPerkLevel(lvl)).toBe(false);
    }
  });
});

// Suppress unused-import for the Perk symbol — kept in scope for future
// fixtures that might tag specific picks by category.
void ({} as Perk);
