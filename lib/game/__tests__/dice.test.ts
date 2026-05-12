import {
  rollD20,
  rollD6,
  rollD4,
  getAttributeModifier,
  rollWithAdvantage,
  rollWithDisadvantage,
} from "../dice";

describe("rollD20", () => {
  it("returns integers in [1, 20]", () => {
    for (let i = 0; i < 2000; i++) {
      const v = rollD20();
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(20);
    }
  });

  it("is deterministic when seeded", () => {
    expect(rollD20(42)).toBe(rollD20(42));
    expect(rollD20(0)).toBe(rollD20(0));
    expect(rollD20(123456)).toBe(rollD20(123456));
  });

  it("produces a variety of values across well-spaced seeds (smoke test)", () => {
    const seen = new Set<number>();
    // Spaced seeds avoid the consecutive-input correlation inherent to LCGs.
    for (let i = 0; i < 100; i++) seen.add(rollD20(i * 7919 + 13));
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe("rollD6", () => {
  it("returns integers in [1, 6]", () => {
    for (let i = 0; i < 2000; i++) {
      const v = rollD6();
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it("is deterministic when seeded", () => {
    expect(rollD6(7)).toBe(rollD6(7));
  });
});

describe("rollD4", () => {
  it("returns integers in [1, 4]", () => {
    for (let i = 0; i < 1000; i++) {
      const v = rollD4();
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(4);
    }
  });

  it("is deterministic when seeded", () => {
    expect(rollD4(99)).toBe(rollD4(99));
  });
});

// V8.51 — calibrated for our 2-10 stat scale.
//   floor((score - 2) / 2)
//   score 2 → 0    score 6 → 2
//   score 3 → 0    score 7 → 2
//   score 4 → 1    score 8 → 3
//   score 5 → 1    score 9 → 3
//   score 10 → 4 (max achievable)
describe("getAttributeModifier — Day 22 archetype stat scale (2-10)", () => {
  it("returns 0 for score 2 (floor / unbumped stat)", () => {
    expect(getAttributeModifier(2)).toBe(0);
  });

  it("returns 0 for score 3 (archetype secondary base)", () => {
    expect(getAttributeModifier(3)).toBe(0);
  });

  it("returns 1 for score 4 (archetype primary base)", () => {
    expect(getAttributeModifier(4)).toBe(1);
  });

  it("returns 1 for score 5 (rounds down)", () => {
    expect(getAttributeModifier(5)).toBe(1);
  });

  it("returns 2 for score 6", () => {
    expect(getAttributeModifier(6)).toBe(2);
  });

  it("returns 3 for score 8", () => {
    expect(getAttributeModifier(8)).toBe(3);
  });

  it("returns 4 for score 10 (cap)", () => {
    expect(getAttributeModifier(10)).toBe(4);
  });

  it("returns -1 for score 1 (defensive — below 2-10 floor)", () => {
    // Stats should never drop below 2 in practice (STAT_BASE), but the
    // formula tolerates lower values rather than throwing.
    expect(getAttributeModifier(1)).toBe(-1);
  });
});

describe("rollWithAdvantage", () => {
  it("returns >= rollWithDisadvantage for the same seed", () => {
    for (let s = 1; s < 50; s++) {
      expect(rollWithAdvantage(s)).toBeGreaterThanOrEqual(rollWithDisadvantage(s));
    }
  });

  it("is deterministic when seeded", () => {
    expect(rollWithAdvantage(42)).toBe(rollWithAdvantage(42));
  });

  it("returns a value in [1, 20]", () => {
    for (let i = 0; i < 200; i++) {
      const v = rollWithAdvantage();
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(20);
    }
  });
});

describe("rollWithDisadvantage", () => {
  it("is deterministic when seeded", () => {
    expect(rollWithDisadvantage(42)).toBe(rollWithDisadvantage(42));
  });

  it("returns a value in [1, 20]", () => {
    for (let i = 0; i < 200; i++) {
      const v = rollWithDisadvantage();
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(20);
    }
  });
});
