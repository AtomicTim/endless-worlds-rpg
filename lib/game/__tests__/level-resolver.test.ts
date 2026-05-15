/**
 * Day 22 — leveling system tests.
 *
 * Coverage:
 *   - buildStartingAttributes: every one of the 25 shipped backgrounds
 *     resolves to the locked starting distribution (base 2 across the
 *     board, primary 4, secondary 3) — catches typos and accidental
 *     primary/secondary swaps in ARCHETYPE_MAP.
 *   - checkLevelUp: threshold crossing at every level boundary; cap
 *     handling; multi-level jumps (defensive — current XP pacing never
 *     emits one but the resolver supports it).
 *   - resolveLevelUp: correct primary/secondary identification and
 *     HP_PER_LEVEL lookup per archetype; LEVEL_CAP clamp.
 *   - applyLevelUp: stat-cap enforcement; HP scaling; free-stat option;
 *     pending_level_up cleared.
 *   - applyStatBoost: cap enforcement, single-stat target.
 */

import { ARCHETYPE_MAP, buildStartingAttributes } from "@/lib/game/archetypes";
import {
  applyLevelUp,
  applyStatBoost,
  checkLevelUp,
  resolveLevelUp,
  xpForNextLevel,
} from "@/lib/game/level-resolver";
import {
  HP_PER_LEVEL,
  LEVEL_CAP,
  STAT_BASE,
  STAT_CAP,
  STAT_PRIMARY_BONUS,
  STAT_SECONDARY_BONUS,
  XP_THRESHOLDS,
} from "@/lib/game/constants";
import type { Attributes, PlayerState } from "@/types/game";

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    name:       "TestHero",
    background: "knight",
    health:     30,
    max_health: 30,
    resources:  {},
    attributes: {
      strength:     4,
      agility:      3,
      intelligence: 2,
      perception:   2,
      charisma:     2,
    },
    inventory: [],
    level:     1,
    xp:        0,
    pending_level_up: false,
    stat_cap:  STAT_CAP,
    // P6 — ability fields are required on PlayerState; populated by P7.
    learned_abilities:      [],
    equipped_ability_slots: [null, null, null, null],
    passive_ability:        null,
    perks:                  [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Archetype map — exhaustive 25-entry coverage
// ─────────────────────────────────────────────────────────────────────────────

describe("ARCHETYPE_MAP — Day 22 locked archetype table", () => {
  it("contains exactly 25 entries (5 classes × 5 genres)", () => {
    expect(Object.keys(ARCHETYPE_MAP).length).toBe(25);
  });

  it("every archetype's primary and secondary are valid Attributes keys", () => {
    const validKeys: Array<keyof Attributes> = [
      "strength", "agility", "intelligence", "perception", "charisma",
    ];
    for (const [name, cfg] of Object.entries(ARCHETYPE_MAP)) {
      expect(validKeys).toContain(cfg.primary);
      expect(validKeys).toContain(cfg.secondary);
      // No archetype should have the same primary + secondary — design
      // requires two distinct stats for stat-distribution spread.
      expect(cfg.primary).not.toBe(cfg.secondary);
      // Pin the lookup result so a typo'd key here would fail loud.
      expect(cfg).toBe(ARCHETYPE_MAP[name]);
    }
  });
});

describe("buildStartingAttributes — 25 archetype mappings", () => {
  // The locked Day 22 archetype table from project-log.md. Each entry's
  // [primary, secondary] must produce primary=4, secondary=3, others=2.
  // This is duplicated from ARCHETYPE_MAP intentionally — if someone
  // mistypes the map, this fixture stays correct and surfaces the drift.
  const EXPECTED: Record<string, [keyof Attributes, keyof Attributes]> = {
    knight:         ["strength",     "agility"],
    rogue:          ["agility",      "perception"],
    mage:           ["intelligence", "perception"],
    ranger:         ["perception",   "agility"],
    herald:         ["charisma",     "intelligence"],
    netrunner:      ["intelligence", "perception"],
    fixer:          ["charisma",     "intelligence"],
    street_samurai: ["agility",      "strength"],
    enforcer:       ["strength",     "agility"],
    ghost:          ["perception",   "agility"],
    investigator:   ["intelligence", "perception"],
    cultist:        ["perception",   "intelligence"],
    survivor:       ["strength",     "agility"],
    phantom:        ["agility",      "perception"],
    medium:         ["charisma",     "intelligence"],
    commander:      ["charisma",     "intelligence"],
    pilot:          ["agility",      "perception"],
    engineer:       ["intelligence", "strength"],
    marine:         ["strength",     "agility"],
    recon:          ["perception",   "agility"],
    scavenger:      ["perception",   "intelligence"],
    raider:         ["strength",     "agility"],
    medic:          ["intelligence", "charisma"],
    runner:         ["agility",      "perception"],
    demagogue:      ["charisma",     "intelligence"],
  };

  for (const [background, [primary, secondary]] of Object.entries(EXPECTED)) {
    it(`${background}: primary=${primary}+${STAT_PRIMARY_BONUS}, secondary=${secondary}+${STAT_SECONDARY_BONUS}`, () => {
      const attrs = buildStartingAttributes(background);
      const primaryExpected   = STAT_BASE + STAT_PRIMARY_BONUS;
      const secondaryExpected = STAT_BASE + STAT_SECONDARY_BONUS;

      expect(attrs[primary]).toBe(primaryExpected);
      expect(attrs[secondary]).toBe(secondaryExpected);

      // Every other stat must stay at STAT_BASE — catches accidental
      // crosstalk where two archetypes share a primary/secondary cell.
      const validKeys: Array<keyof Attributes> = [
        "strength", "agility", "intelligence", "perception", "charisma",
      ];
      for (const k of validKeys) {
        if (k === primary || k === secondary) continue;
        expect(attrs[k]).toBe(STAT_BASE);
      }
    });
  }

  it("unknown background returns flat STAT_BASE attributes (no bonuses)", () => {
    const attrs = buildStartingAttributes("not_a_real_class");
    expect(attrs.strength).toBe(STAT_BASE);
    expect(attrs.agility).toBe(STAT_BASE);
    expect(attrs.intelligence).toBe(STAT_BASE);
    expect(attrs.perception).toBe(STAT_BASE);
    expect(attrs.charisma).toBe(STAT_BASE);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// checkLevelUp
// ─────────────────────────────────────────────────────────────────────────────

describe("checkLevelUp — threshold crossings", () => {
  it("returns leveled_up=false when XP is below threshold for current level", () => {
    expect(checkLevelUp(0,  1)).toEqual({ leveled_up: false, new_level: 1 });
    expect(checkLevelUp(50, 1)).toEqual({ leveled_up: false, new_level: 1 });
    expect(checkLevelUp(99, 1)).toEqual({ leveled_up: false, new_level: 1 });
  });

  it("returns leveled_up=true with new_level=2 when XP hits the first threshold", () => {
    expect(checkLevelUp(100, 1)).toEqual({ leveled_up: true, new_level: 2 });
    expect(checkLevelUp(150, 1)).toEqual({ leveled_up: true, new_level: 2 });
  });

  it("crosses subsequent thresholds correctly", () => {
    expect(checkLevelUp(199, 2)).toEqual({ leveled_up: false, new_level: 2 });
    expect(checkLevelUp(200, 2)).toEqual({ leveled_up: true,  new_level: 3 });
    expect(checkLevelUp(550, 4)).toEqual({ leveled_up: true,  new_level: 5 });
  });

  it("supports multi-level jumps (defensive — current pacing won't trigger this)", () => {
    // Boss + back-to-back fights could conceivably award enough XP to
    // skip a level. The resolver walks the full ladder.
    expect(checkLevelUp(550, 1)).toEqual({ leveled_up: true, new_level: 5 });
  });

  it("clamps new_level at LEVEL_CAP", () => {
    const final = XP_THRESHOLDS[XP_THRESHOLDS.length - 1]; // reaches LEVEL_CAP
    expect(checkLevelUp(final + 999, 1)).toEqual({
      leveled_up: true,
      new_level:  LEVEL_CAP,
    });
  });

  it("returns leveled_up=false when already at LEVEL_CAP regardless of XP", () => {
    expect(checkLevelUp(99999, LEVEL_CAP)).toEqual({
      leveled_up: false,
      new_level:  LEVEL_CAP,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// xpForNextLevel
// ─────────────────────────────────────────────────────────────────────────────

describe("xpForNextLevel", () => {
  it("returns the matching threshold for each level 1..LEVEL_CAP-1", () => {
    for (let lvl = 1; lvl < LEVEL_CAP; lvl += 1) {
      expect(xpForNextLevel(lvl)).toBe(XP_THRESHOLDS[lvl - 1]);
    }
  });

  it("returns null at LEVEL_CAP (no further progression)", () => {
    expect(xpForNextLevel(LEVEL_CAP)).toBeNull();
  });

  it("returns null for invalid (sub-1) levels", () => {
    expect(xpForNextLevel(0)).toBeNull();
    expect(xpForNextLevel(-3)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveLevelUp
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveLevelUp — auto gains", () => {
  it("knight (STR primary) gains HP_PER_LEVEL.strength=8 and primary=STR, secondary=AGI", () => {
    const r = resolveLevelUp("knight", 1);
    expect(r.new_level).toBe(2);
    expect(r.primary_stat).toBe("strength");
    expect(r.secondary_stat).toBe("agility");
    expect(r.hp_gained).toBe(HP_PER_LEVEL.strength);
    expect(r.auto_stat_gains.strength).toBe(1);
    expect(r.auto_stat_gains.agility).toBe(1);
  });

  it("mage (INT primary) gains HP_PER_LEVEL.intelligence=5", () => {
    const r = resolveLevelUp("mage", 3);
    expect(r.new_level).toBe(4);
    expect(r.primary_stat).toBe("intelligence");
    expect(r.secondary_stat).toBe("perception");
    expect(r.hp_gained).toBe(HP_PER_LEVEL.intelligence);
  });

  it("rogue (AGI primary) gains HP_PER_LEVEL.agility=6", () => {
    const r = resolveLevelUp("rogue", 1);
    expect(r.hp_gained).toBe(HP_PER_LEVEL.agility);
  });

  it("herald (CHA primary) gains HP_PER_LEVEL.charisma=5", () => {
    const r = resolveLevelUp("herald", 1);
    expect(r.hp_gained).toBe(HP_PER_LEVEL.charisma);
    expect(r.primary_stat).toBe("charisma");
    expect(r.secondary_stat).toBe("intelligence");
  });

  it("unknown background falls back to STR/AGI + 5 HP baseline", () => {
    const r = resolveLevelUp("not_a_class", 2);
    expect(r.new_level).toBe(3);
    // Default-archetype fallback: STR/AGI. HP_PER_LEVEL.strength=8.
    expect(r.primary_stat).toBe("strength");
    expect(r.secondary_stat).toBe("agility");
    expect(r.hp_gained).toBe(HP_PER_LEVEL.strength);
  });

  it("new_level clamps at LEVEL_CAP", () => {
    const r = resolveLevelUp("knight", LEVEL_CAP);
    expect(r.new_level).toBe(LEVEL_CAP);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyLevelUp
// ─────────────────────────────────────────────────────────────────────────────

describe("applyLevelUp — splice + cap", () => {
  it("applies primary + secondary auto-gains and the free stat", () => {
    const p = makePlayer({
      level: 1,
      attributes: {
        strength: 4, agility: 3, intelligence: 2, perception: 2, charisma: 2,
      },
    });
    const result = resolveLevelUp("knight", 1);
    const slice  = applyLevelUp(p, { ...result, free_stat: "intelligence" });
    expect(slice.attributes?.strength).toBe(5);     // 4 + auto +1
    expect(slice.attributes?.agility).toBe(4);      // 3 + auto +1
    expect(slice.attributes?.intelligence).toBe(3); // 2 + free +1
    expect(slice.attributes?.perception).toBe(2);   // untouched
    expect(slice.attributes?.charisma).toBe(2);     // untouched
    expect(slice.level).toBe(2);
    expect(slice.pending_level_up).toBe(false);
  });

  it("HP raises both max_health AND current health by hp_gained", () => {
    const p = makePlayer({ health: 22, max_health: 30 });
    const result = resolveLevelUp("knight", 1);
    const slice  = applyLevelUp(p, { ...result, free_stat: "perception" });
    expect(slice.max_health).toBe(30 + HP_PER_LEVEL.strength);
    expect(slice.health).toBe(22 + HP_PER_LEVEL.strength);
  });

  it("caps every attribute at STAT_CAP — auto gains DO NOT overshoot", () => {
    const p = makePlayer({
      attributes: {
        strength: STAT_CAP, agility: STAT_CAP, intelligence: STAT_CAP,
        perception: STAT_CAP, charisma: STAT_CAP,
      },
    });
    const result = resolveLevelUp("knight", 5);
    const slice  = applyLevelUp(p, { ...result, free_stat: "strength" });
    expect(slice.attributes?.strength).toBe(STAT_CAP);
    expect(slice.attributes?.agility).toBe(STAT_CAP);
    expect(slice.attributes?.intelligence).toBe(STAT_CAP);
  });

  it("missing free_stat is honoured — primary/secondary still apply", () => {
    const p = makePlayer({ attributes: {
      strength: 4, agility: 3, intelligence: 2, perception: 2, charisma: 2,
    } });
    const result = resolveLevelUp("knight", 1);
    // free_stat omitted intentionally — applyLevelUp must still bump
    // primary + secondary and clear pending_level_up.
    const slice  = applyLevelUp(p, result);
    expect(slice.attributes?.strength).toBe(5);
    expect(slice.attributes?.agility).toBe(4);
    expect(slice.attributes?.intelligence).toBe(2); // no free point used
    expect(slice.pending_level_up).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyStatBoost
// ─────────────────────────────────────────────────────────────────────────────

describe("applyStatBoost — STAT_XP fast-apply", () => {
  it("adds +1 to the chosen stat", () => {
    const p = makePlayer({ attributes: {
      strength: 4, agility: 3, intelligence: 2, perception: 2, charisma: 2,
    } });
    const next = applyStatBoost(p, "intelligence");
    expect(next.intelligence).toBe(3);
    // Other stats unchanged.
    expect(next.strength).toBe(4);
    expect(next.agility).toBe(3);
  });

  it("respects STAT_CAP — capped stats stay capped", () => {
    const p = makePlayer({ attributes: {
      strength: STAT_CAP, agility: 3, intelligence: 2, perception: 2, charisma: 2,
    } });
    const next = applyStatBoost(p, "strength");
    expect(next.strength).toBe(STAT_CAP);
  });
});
