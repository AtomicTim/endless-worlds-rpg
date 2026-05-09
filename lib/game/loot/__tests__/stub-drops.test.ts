import type { Enemy } from "@/types/game";
import { rollStubDrops, BASIC_HEALTH_POTION_ID } from "../stub-drops";

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

const dragon: Enemy = {
  ...goblin,
  id:              "fantasy_dragon_whelp",
  name:            "Dragon Whelp",
  hp_range:        [50, 70],
  xp_value:        350,
};

/**
 * Build a deterministic RNG that returns each value in `values`
 * once per call, then loops. Use for asserting specific gold/potion
 * branches without flakiness.
 */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

describe("rollStubDrops", () => {
  it("drops gold when the gold roll falls under the chance window", () => {
    // values[0] = goldRng (under chance) → succeed
    // values[1] = d6 roll                → 0.5 * 6 = 3, +1 → 4
    // values[2] = potion roll (above .05) → no potion
    const rng = seqRng([0.0, 0.5, 0.99]);
    const drops = rollStubDrops(goblin, rng);
    expect(drops.gold).toBeGreaterThan(0);
    expect(drops.items).toEqual([]);
  });

  it("drops nothing when both rolls fail", () => {
    const rng = seqRng([0.99, 0.5, 0.99]);
    const drops = rollStubDrops(goblin, rng);
    expect(drops.gold).toBe(0);
    expect(drops.items).toEqual([]);
  });

  it("drops a basic health potion when the potion roll falls under 5%", () => {
    const rng = seqRng([0.99, 0.0, 0.01]);
    const drops = rollStubDrops(goblin, rng);
    expect(drops.gold).toBe(0);
    expect(drops.items).toEqual([BASIC_HEALTH_POTION_ID]);
  });

  it("can drop both gold and a potion in the same roll", () => {
    const rng = seqRng([0.0, 0.5, 0.01]);
    const drops = rollStubDrops(goblin, rng);
    expect(drops.gold).toBeGreaterThan(0);
    expect(drops.items).toEqual([BASIC_HEALTH_POTION_ID]);
  });

  it("scales gold-drop chance with xp_value (Math.random sweep — goblin)", () => {
    // Over many trials, goblin (xp 25) should drop gold ~26.25% of the time
    // (0.25 + 0.25 * 25/1000 = 0.256). Use a wide tolerance to keep flakes
    // off the green: ±5pp on a 5000-sample run is within normal binomial
    // variance.
    const N = 5000;
    let drops = 0;
    for (let i = 0; i < N; i++) {
      if (rollStubDrops(goblin).gold > 0) drops += 1;
    }
    const rate = drops / N;
    expect(rate).toBeGreaterThan(0.20);
    expect(rate).toBeLessThan(0.32);
  });

  it("scales gold-drop chance up to ~50% for high-xp enemies (dragon whelp)", () => {
    // xp 350 → chance = 0.25 + 0.25 * 350/1000 = 0.3375. Sweep with
    // ±5pp tolerance.
    const N = 5000;
    let drops = 0;
    for (let i = 0; i < N; i++) {
      if (rollStubDrops(dragon).gold > 0) drops += 1;
    }
    const rate = drops / N;
    expect(rate).toBeGreaterThan(0.28);
    expect(rate).toBeLessThan(0.40);
  });

  it("potion drop rate sits within ~5% (±1.5pp tolerance)", () => {
    // Spec: 5% chance. Binomial sigma at 10000 samples = sqrt(0.05*0.95/10000)
    // ≈ 0.0022, so ±1.5pp window is ~6.8σ — vanishingly flaky.
    const N = 10000;
    let potions = 0;
    for (let i = 0; i < N; i++) {
      if (rollStubDrops(goblin).items.includes(BASIC_HEALTH_POTION_ID)) potions += 1;
    }
    const rate = potions / N;
    expect(rate).toBeGreaterThan(0.035);
    expect(rate).toBeLessThan(0.065);
  });

  it("gold amount stays within d6 + xp/10 bounds when it drops", () => {
    // For goblin xp 25 → bonus = 2. d6 in [1,6] → gold in [3, 8].
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const drops = rollStubDrops(goblin);
      if (drops.gold === 0) continue;
      expect(drops.gold).toBeGreaterThanOrEqual(3);
      expect(drops.gold).toBeLessThanOrEqual(8);
    }
  });
});
