import type { Enemy } from "@/types/game";
import {
  rollD20,
  rollDamageDie,
  maxDamageDie,
  rollEnemyHP,
  rollInitiative,
  resolveAttack,
  resolveDefend,
  resolveFlee,
  resolveUseItem,
  applyDefendDamageReduction,
  BASIC_HEALTH_POTION_ID,
  type Rng,
} from "../combat-resolver";

/** Build a deterministic RNG that returns each value once, then loops. */
function seqRng(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

const goblin: Enemy = {
  id:              "fantasy_goblin",
  name:            "Goblin",
  description:     "Test goblin.",
  hp_range:        [6, 10],
  agi_mod:         1,
  str_mod:         0,
  damage_die:      "1d6",
  armor_bonus:     1,
  xp_value:        25,
  loot_table_id:   "fantasy_goblin_loot",
  is_boss:         false,
  behavior_flavor: "aggressive melee",
};

// ─────────────────────────────────────────────────────────────────────────────
// Dice
// ─────────────────────────────────────────────────────────────────────────────

describe("rollD20", () => {
  it("returns integers in [1, 20]", () => {
    for (let i = 0; i < 5000; i += 1) {
      const v = rollD20();
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(20);
    }
  });

  it("forces a specific roll with seqRng", () => {
    expect(rollD20(seqRng([0.0]))).toBe(1);
    expect(rollD20(seqRng([0.95]))).toBe(20);
    expect(rollD20(seqRng([0.5]))).toBe(11);
  });
});

describe("rollDamageDie", () => {
  const cases: Array<{ die: string; min: number; max: number }> = [
    { die: "1d4",  min: 1, max: 4  },
    { die: "1d6",  min: 1, max: 6  },
    { die: "1d8",  min: 1, max: 8  },
    { die: "1d10", min: 1, max: 10 },
    { die: "2d4",  min: 2, max: 8  },
    { die: "2d6",  min: 2, max: 12 },
    { die: "2d8",  min: 2, max: 16 },
  ];

  for (const c of cases) {
    it(`${c.die} stays within [${c.min}, ${c.max}]`, () => {
      for (let i = 0; i < 1000; i += 1) {
        const v = rollDamageDie(c.die);
        expect(v).toBeGreaterThanOrEqual(c.min);
        expect(v).toBeLessThanOrEqual(c.max);
      }
    });
  }

  it("throws on malformed dice notation", () => {
    expect(() => rollDamageDie("d6")).toThrow();
    expect(() => rollDamageDie("1xd6")).toThrow();
    expect(() => rollDamageDie("")).toThrow();
  });
});

describe("maxDamageDie", () => {
  it("returns max possible roll for each known die", () => {
    expect(maxDamageDie("1d4")).toBe(4);
    expect(maxDamageDie("1d6")).toBe(6);
    expect(maxDamageDie("1d8")).toBe(8);
    expect(maxDamageDie("1d10")).toBe(10);
    expect(maxDamageDie("2d4")).toBe(8);
    expect(maxDamageDie("2d6")).toBe(12);
    expect(maxDamageDie("2d8")).toBe(16);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Spawning
// ─────────────────────────────────────────────────────────────────────────────

describe("rollEnemyHP", () => {
  it("returns an integer within hp_range inclusive", () => {
    for (let i = 0; i < 1000; i += 1) {
      const hp = rollEnemyHP(goblin);
      expect(hp).toBeGreaterThanOrEqual(goblin.hp_range[0]);
      expect(hp).toBeLessThanOrEqual(goblin.hp_range[1]);
    }
  });

  it("returns the lower bound when hp_range collapsed", () => {
    const fixed: Enemy = { ...goblin, hp_range: [5, 5] };
    expect(rollEnemyHP(fixed)).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Initiative
// ─────────────────────────────────────────────────────────────────────────────

describe("rollInitiative", () => {
  it("returns ids sorted descending by 1d20 + agi_mod", () => {
    // Forced rolls: PLAYER rolls 0.95→20+2=22, goblin rolls 0.0→1+1=2.
    // Player should end up first.
    const rng = seqRng([0.95, 0.0]);
    const order = rollInitiative(
      [
        { id: "PLAYER", agi_mod: 2 },
        { id: "goblin_1", agi_mod: 1 },
      ],
      rng
    );
    expect(order[0]).toBe("PLAYER");
    expect(order[1]).toBe("goblin_1");
  });

  it("breaks ties in favor of PLAYER", () => {
    // Both roll 10 (0.45 → 10): player_total = 10 + 0 = 10, enemy_total = 10 + 0 = 10.
    const rng = seqRng([0.45, 0.45]);
    const order = rollInitiative(
      [
        { id: "goblin_1", agi_mod: 0 },
        { id: "PLAYER",   agi_mod: 0 },
      ],
      rng
    );
    expect(order[0]).toBe("PLAYER");
  });

  it("includes every combatant exactly once", () => {
    const order = rollInitiative([
      { id: "PLAYER",   agi_mod: 0 },
      { id: "wolf_1",   agi_mod: 3 },
      { id: "goblin_1", agi_mod: 1 },
    ]);
    expect(new Set(order).size).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Attack
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveAttack", () => {
  const baseAttacker = {
    name:       "Player",
    agi_mod:    2,
    str_mod:    1,
    damage_die: "1d6",
  };
  const baseTarget = {
    name:        "Goblin",
    agi_mod:     1,
    armor_bonus: 1,
    current_hp:  8,
  };

  it("crit on natural 20: outcome=crit, damage = max + 1d(die) + str_mod, killed_target if appropriate", () => {
    // First roll forces the d20 to 20 (0.95). Second roll is the crit's
    // bonus 1d6 — force it to 6 (0.95 → 6).
    const rng = seqRng([0.95, 0.95]);
    const r = resolveAttack({ attacker: baseAttacker, target: baseTarget, rng });
    expect(r.outcome).toBe("crit");
    // crit damage = maxDie(1d6)=6 + d6(forced 6) + str_mod(1) = 13
    expect(r.damage).toBe(13);
    expect(r.killed_target).toBe(true);  // 13 >= 8
    expect(r.hit_roll).toBe(20);
  });

  it("fumble on natural 1: outcome=fumble, damage=0", () => {
    const rng = seqRng([0.0]);  // d20 = 1
    const r = resolveAttack({ attacker: baseAttacker, target: baseTarget, rng });
    expect(r.outcome).toBe("fumble");
    expect(r.damage).toBe(0);
    expect(r.hit_roll).toBe(1);
    expect(r.killed_target).toBe(false);
  });

  it("hit when hit_total >= target_dc", () => {
    // d20 = 14 (0.65 → 14). hit_total = 14 + agi(2) = 16. target_dc = 10 + 1 + 1 = 12.
    // 16 >= 12 → hit. Then d6 → force a 4 (0.55).
    const rng = seqRng([0.65, 0.55]);
    const r = resolveAttack({ attacker: baseAttacker, target: baseTarget, rng });
    expect(r.outcome).toBe("hit");
    expect(r.target_dc).toBe(12);
    // damage = d6(4) + str_mod(1) = 5
    expect(r.damage).toBe(5);
    expect(r.killed_target).toBe(false);
  });

  it("miss when hit_total < target_dc", () => {
    // d20 = 5 (0.20 → 5). hit_total = 5 + 2 = 7 < 12.
    const rng = seqRng([0.20]);
    const r = resolveAttack({ attacker: baseAttacker, target: baseTarget, rng });
    expect(r.outcome).toBe("miss");
    expect(r.damage).toBe(0);
    expect(r.target_dc).toBe(12);
  });

  it("damage on hit is clamped to at least 1 (low str_mod + low roll)", () => {
    // d20 = 14 (hits), then d6 forced to 1 (0.0 → 1). str_mod = -3. raw = 1 + (-3) = -2 → max(1, -2) = 1.
    const rng = seqRng([0.65, 0.0]);
    const r = resolveAttack({
      attacker: { ...baseAttacker, str_mod: -3 },
      target:   baseTarget,
      rng,
    });
    expect(r.outcome).toBe("hit");
    expect(r.damage).toBe(1);
  });

  it("target_dc math is 10 + target.agi_mod + target.armor_bonus", () => {
    const rng = seqRng([0.0]);  // fumble — math is computed regardless of outcome
    const r = resolveAttack({
      attacker: baseAttacker,
      target:   { ...baseTarget, agi_mod: 3, armor_bonus: 2 },
      rng,
    });
    expect(r.target_dc).toBe(15);
  });

  it("killed_target true when damage >= target.current_hp", () => {
    // d20 = 14 (hit), d6 = 6, str = 1 → damage 7. target hp = 5. 7 >= 5.
    const rng = seqRng([0.65, 0.95]);
    const r = resolveAttack({
      attacker: baseAttacker,
      target:   { ...baseTarget, current_hp: 5 },
      rng,
    });
    expect(r.outcome).toBe("hit");
    expect(r.killed_target).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Defend
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveDefend", () => {
  it("returns applied=true (no randomness)", () => {
    expect(resolveDefend()).toEqual({ applied: true });
  });
});

describe("applyDefendDamageReduction", () => {
  it("halves damage rounded down", () => {
    expect(applyDefendDamageReduction(8)).toBe(4);
    expect(applyDefendDamageReduction(7)).toBe(3);
    expect(applyDefendDamageReduction(2)).toBe(1);
  });

  it("clamps minimum to 1 when damage > 0", () => {
    expect(applyDefendDamageReduction(1)).toBe(1);
  });

  it("returns 0 when damage is 0 (miss survives untouched)", () => {
    expect(applyDefendDamageReduction(0)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flee
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveFlee", () => {
  it("succeeds when flee_roll >= flee_dc", () => {
    // d20 = 20 (0.95). Player AGI 2 → flee_roll = 22.
    // Two living enemies, both AGI 0 → flee_dc = 10.
    const rng = seqRng([0.95]);
    const r = resolveFlee({
      player: { agi_mod: 2 },
      enemies: [
        { alive: true, agi_mod: 0 },
        { alive: true, agi_mod: 0 },
      ],
      rng,
    });
    expect(r.success).toBe(true);
    expect(r.flee_roll).toBe(22);
    expect(r.flee_dc).toBe(10);
  });

  it("fails when flee_roll < flee_dc", () => {
    // d20 = 1 (0.0). Player AGI 0 → flee_roll = 1. dc = 10.
    const rng = seqRng([0.0]);
    const r = resolveFlee({
      player: { agi_mod: 0 },
      enemies: [{ alive: true, agi_mod: 0 }],
      rng,
    });
    expect(r.success).toBe(false);
  });

  it("ignores dead enemies when averaging AGI", () => {
    // Two enemies; only the alive one counts. dead one has +10 agi but is ignored.
    const rng = seqRng([0.5]);  // d20 = 11
    const r = resolveFlee({
      player: { agi_mod: 0 },
      enemies: [
        { alive: true,  agi_mod: 2  },
        { alive: false, agi_mod: 10 },
      ],
      rng,
    });
    // dc = 10 + 2 = 12. roll = 11. fail.
    expect(r.flee_dc).toBe(12);
    expect(r.success).toBe(false);
  });

  it("returns dc 10 when no living enemies (defensive)", () => {
    const rng = seqRng([0.5]);
    const r = resolveFlee({
      player: { agi_mod: 0 },
      enemies: [{ alive: false, agi_mod: 5 }],
      rng,
    });
    expect(r.flee_dc).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Use item
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveUseItem", () => {
  it("heals 1d8 + 4 for a basic health potion", () => {
    // d8 forced to 4 (0.45). heal = 4 + 4 = 8.
    const rng = seqRng([0.45]);
    const r = resolveUseItem({
      item_id: BASIC_HEALTH_POTION_ID,
      player:  { current_hp: 5, max_hp: 20 },
      rng,
    });
    expect(r.healed_amount).toBe(8);
    expect(r.new_hp).toBe(13);
    expect(r.item_consumed).toBe(true);
  });

  it("caps healing at max_hp", () => {
    const rng = seqRng([0.95]);  // d8 = 8. raw heal = 12. capped.
    const r = resolveUseItem({
      item_id: BASIC_HEALTH_POTION_ID,
      player:  { current_hp: 18, max_hp: 20 },
      rng,
    });
    expect(r.new_hp).toBe(20);
    expect(r.healed_amount).toBe(2);  // actual amount restored
    expect(r.item_consumed).toBe(true);
  });

  it("returns no-op for unknown items", () => {
    const r = resolveUseItem({
      item_id: "consumable_unknown_thing",
      player:  { current_hp: 5, max_hp: 20 },
    });
    expect(r.healed_amount).toBe(0);
    expect(r.new_hp).toBe(5);
    expect(r.item_consumed).toBe(false);
  });
});
