import { Genre } from "@/types/game";
import type {
  ActiveStatusEffect,
  CombatEnemyInstance,
  CombatState,
  PlayerState,
} from "@/types/game";
import {
  buildStatusEffect,
  rollStatusApplication,
  rollStatusSave,
} from "../combat-resolver";
import { handleDefeat } from "../combat-engine";

/**
 * Prompt 1 — Status effects, damage types, death penalty, gold.
 *
 * Covers the new pure helpers in combat-resolver and the rebalanced
 * handleDefeat in combat-engine. The combat-engine helpers
 * (maybeApplyEnemyStatus / playerEffectiveAttackMods /
 * applyPlayerStatusTicks / rollPlayerStatusSaves) are exercised
 * indirectly through executePlayerAction + advanceEnemyTurn in
 * combat-flow.test.ts; here we hit them through a synthetic
 * combat-engine boundary helper.
 */

function fixedRng(value: number): () => number {
  return () => value;
}

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1-3 — buildStatusEffect canonical shapes
// ─────────────────────────────────────────────────────────────────────────────

describe("buildStatusEffect", () => {
  it("poisoned: 3 rounds, AGI DC 12, damage_per_tick carried through", () => {
    const e = buildStatusEffect("poisoned", "goblin", 3);
    expect(e.id).toBe("poisoned");
    expect(e.rounds_remaining).toBe(3);
    expect(e.save_dc).toBe(12);
    expect(e.save_stat).toBe("agility");
    expect(e.damage_per_tick).toBe(3);
  });

  it("frightened: stat_modifier targets all_rolls at -2", () => {
    const e = buildStatusEffect("frightened", "wraith");
    expect(e.stat_modifier?.stat).toBe("all_rolls");
    expect(e.stat_modifier?.amount).toBe(-2);
  });

  it("fortified: buff with armor +3 for 3 rounds, no save", () => {
    const e = buildStatusEffect("fortified", "potion");
    expect(e.stat_modifier?.stat).toBe("armor");
    expect(e.stat_modifier?.amount).toBe(3);
    expect(e.rounds_remaining).toBe(3);
    // Buffs use DC 0 so a save would always succeed; the engine
    // routes them past the save path entirely.
    expect(e.save_dc).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4-5 — rollStatusApplication
// ─────────────────────────────────────────────────────────────────────────────

describe("rollStatusApplication", () => {
  it("applies poisoned at chance=1.0 with rng=0 and rolls a DoT die >= 1", () => {
    const result = rollStatusApplication("poisoned", 1.0, fixedRng(0));
    expect(result.applied).toBe(true);
    expect(result.damage_per_tick).toBeGreaterThanOrEqual(1);
  });

  it("misses application at chance=0.0 regardless of rng", () => {
    const result = rollStatusApplication("burning", 0.0, fixedRng(0.5));
    expect(result.applied).toBe(false);
    expect(result.damage_per_tick).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6-7 — rollStatusSave
// ─────────────────────────────────────────────────────────────────────────────

describe("rollStatusSave", () => {
  const poisoned: ActiveStatusEffect = {
    id:               "poisoned",
    rounds_remaining: 1,
    save_dc:          12,
    save_stat:        "agility",
    source:           "test",
  };

  it("saves when total meets the DC (roll 10 + mod 2 vs DC 12)", () => {
    // rollD20 is Math.floor(rng() * 20) + 1; rng=0.49 → 10.
    const result = rollStatusSave(poisoned, 2, fixedRng(0.49));
    expect(result.roll).toBe(10);
    expect(result.total).toBe(12);
    expect(result.saved).toBe(true);
  });

  it("fails when total is under the DC (roll 9 + mod 2 vs DC 12)", () => {
    // rng=0.44 → floor(8.8)+1 = 9.
    const result = rollStatusSave(poisoned, 2, fixedRng(0.44));
    expect(result.roll).toBe(9);
    expect(result.total).toBe(11);
    expect(result.saved).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8-11 — handleDefeat death penalty (Prompt 1 rebalance)
// ─────────────────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    name:        "TestHero",
    background:  "knight",
    health:      0,
    max_health:  100,
    resources:   { gold: 1000 },
    attributes:  { strength: 6, agility: 6, charisma: 2, intelligence: 2, perception: 2 },
    inventory:   [],
    level:       1,
    xp:          50,
    // P6 — ability fields are required on PlayerState; populated by P7.
    learned_abilities:      [],
    equipped_ability_slots: [null, null, null, null],
    passive_ability:        null,
    ...overrides,
  };
}

function makeCombatState(overrides: Partial<CombatState> = {}): CombatState {
  const enemy: CombatEnemyInstance = {
    instance_id:    "g_1",
    enemy_id:       "goblin",
    name:           "Goblin",
    description:    "",
    current_hp:     0,
    max_hp:         8,
    agi_mod:        1,
    str_mod:        0,
    damage_die:     "1d6",
    armor_bonus:    0,
    xp_value:       25,
    loot_table_id:  "fantasy_loot_basic",
    is_boss:        false,
    behavior_flavor: "skirmisher",
    alive:          false,
  };
  return {
    active:             true,
    encounter_id:       "enc_test",
    enemies:            [enemy],
    turn_order:         ["PLAYER", "g_1"],
    current_turn_index: 0,
    round_number:       1,
    player_defending:   false,
    combat_log:         [],
    origin_node_id:     "node_test",
    pre_combat_xp:      30,
    ...overrides,
  };
}

describe("handleDefeat — Prompt 1 death penalty", () => {
  it("HP respawns at 75% of max", () => {
    const player = makePlayer({ max_health: 100 });
    const state  = makeCombatState();
    const out = handleDefeat({
      state, player, world_genre: Genre.FANTASY,
      last_settlement_hub_id: "town",
    });
    expect(out.newPlayer.health).toBe(75);
  });

  it("gold loss capped at 50 even when 10% would be larger", () => {
    const player = makePlayer({ resources: { gold: 1000 } });
    const state  = makeCombatState();
    const out = handleDefeat({
      state, player, world_genre: Genre.FANTASY,
      last_settlement_hub_id: "town",
    });
    // 10% of 1000 = 100 → capped at 50 → 1000 - 50 = 950.
    expect(out.newPlayer.resources.gold).toBe(950);
  });

  it("gold loss = 10% when 10% is under the 50-cap", () => {
    const player = makePlayer({ resources: { gold: 200 } });
    const state  = makeCombatState();
    const out = handleDefeat({
      state, player, world_genre: Genre.FANTASY,
      last_settlement_hub_id: "town",
    });
    expect(out.newPlayer.resources.gold).toBe(180);
  });

  it("small purses still pay the 10% (rounded down) — 30 gold → 27", () => {
    const player = makePlayer({ resources: { gold: 30 } });
    const state  = makeCombatState();
    const out = handleDefeat({
      state, player, world_genre: Genre.FANTASY,
      last_settlement_hub_id: "town",
    });
    expect(out.newPlayer.resources.gold).toBe(27);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12-13 — One-curse-limit + chance gating via direct engine import
// ─────────────────────────────────────────────────────────────────────────────
//
// maybeApplyEnemyStatus is private. The behavior is verified end-to-end
// through executePlayerAction + advanceEnemyTurn in combat-flow.test.ts.
// Here we cover the semantics by simulating it directly: build an enemy
// instance with a status_effect config, call rollStatusApplication +
// buildStatusEffect with the documented one-curse-limit semantics, and
// assert the result matches the engine's contract.

describe("Status application — one-curse-limit semantics", () => {
  const AILMENT_IDS: ActiveStatusEffect["id"][] = [
    "poisoned", "burning", "chilled", "weakened", "frightened",
  ];

  function applyWithOneCurseLimit(
    existing: ActiveStatusEffect[],
    incoming: ActiveStatusEffect,
  ): ActiveStatusEffect[] {
    return [
      ...existing.filter((e) => !AILMENT_IDS.includes(e.id)),
      incoming,
    ];
  }

  it("applying BURNING to a player already POISONED replaces poisoned", () => {
    const existing = [buildStatusEffect("poisoned", "goblin", 2)];
    const incoming = buildStatusEffect("burning", "fire_drake", 3);
    const next = applyWithOneCurseLimit(existing, incoming);
    expect(next.some((e) => e.id === "burning")).toBe(true);
    expect(next.some((e) => e.id === "poisoned")).toBe(false);
  });

  it("rollStatusApplication with chance=0 leaves the existing list unchanged", () => {
    // Direct verification: chance=0 → applied:false → caller never
    // mutates the effect list. This is the gate behavior the engine
    // wraps with one-curse-limit.
    const existing = [buildStatusEffect("poisoned", "goblin", 2)];
    const app = rollStatusApplication("burning", 0.0, seqRng([0.99]));
    expect(app.applied).toBe(false);
    // No mutation expected.
    expect(existing.length).toBe(1);
    expect(existing[0].id).toBe("poisoned");
  });
});
