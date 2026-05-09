import type { Enemy } from "@/types/game";
import { FANTASY_BESTIARY } from "../fantasy";

const DAMAGE_DIE_RE = /^\d+d\d+$/;
const ALLOWED_DICE = new Set([
  "1d4", "1d6", "1d8", "1d10", "2d4", "2d6", "2d8",
]);

describe("FANTASY_BESTIARY", () => {
  it("ships exactly 14 entries (combat-spec §6.4)", () => {
    expect(FANTASY_BESTIARY).toHaveLength(14);
  });

  it("has no duplicate ids", () => {
    const ids = FANTASY_BESTIARY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each entry has every required Enemy field populated", () => {
    for (const e of FANTASY_BESTIARY) {
      expect(typeof e.id).toBe("string");
      expect(e.id.length).toBeGreaterThan(0);
      expect(typeof e.name).toBe("string");
      expect(e.name.length).toBeGreaterThan(0);
      expect(typeof e.description).toBe("string");
      expect(e.description.length).toBeGreaterThan(0);
      expect(Array.isArray(e.hp_range)).toBe(true);
      expect(e.hp_range).toHaveLength(2);
      expect(typeof e.hp_range[0]).toBe("number");
      expect(typeof e.hp_range[1]).toBe("number");
      expect(typeof e.agi_mod).toBe("number");
      expect(typeof e.str_mod).toBe("number");
      expect(typeof e.damage_die).toBe("string");
      expect(typeof e.armor_bonus).toBe("number");
      expect(typeof e.xp_value).toBe("number");
      expect(typeof e.loot_table_id).toBe("string");
      expect(e.loot_table_id.length).toBeGreaterThan(0);
      expect(typeof e.is_boss).toBe("boolean");
      expect(typeof e.behavior_flavor).toBe("string");
    }
  });

  it("hp_range[0] < hp_range[1] for every enemy", () => {
    for (const e of FANTASY_BESTIARY) {
      expect(e.hp_range[0]).toBeLessThan(e.hp_range[1]);
      expect(e.hp_range[0]).toBeGreaterThan(0);
    }
  });

  it("damage_die matches /^\\d+d\\d+$/ and is in the spec's allowed set", () => {
    for (const e of FANTASY_BESTIARY) {
      expect(e.damage_die).toMatch(DAMAGE_DIE_RE);
      expect(ALLOWED_DICE.has(e.damage_die)).toBe(true);
    }
  });

  it("agi_mod and str_mod stay within [-2, +4]", () => {
    for (const e of FANTASY_BESTIARY) {
      expect(e.agi_mod).toBeGreaterThanOrEqual(-2);
      expect(e.agi_mod).toBeLessThanOrEqual(4);
      expect(e.str_mod).toBeGreaterThanOrEqual(-2);
      expect(e.str_mod).toBeLessThanOrEqual(4);
    }
  });

  it("armor_bonus stays within [0, 4]", () => {
    // Spec body says 0-3 typical, but the dragon whelp at +4 is the
    // documented apex outlier in §6.4. Cap test at 4 to match the
    // table verbatim.
    for (const e of FANTASY_BESTIARY) {
      expect(e.armor_bonus).toBeGreaterThanOrEqual(0);
      expect(e.armor_bonus).toBeLessThanOrEqual(4);
    }
  });

  it("is_boss is false on every entry (bosses come from WorldBible)", () => {
    for (const e of FANTASY_BESTIARY) {
      expect(e.is_boss).toBe(false);
    }
  });

  it("loot_table_id follows fantasy_<id>_loot pattern", () => {
    for (const e of FANTASY_BESTIARY) {
      expect(e.loot_table_id).toBe(`${e.id}_loot`);
    }
  });

  it("xp_value increases monotonically across the published ladder", () => {
    // Spot-check progression along a known order to catch table drift.
    const order = [
      "fantasy_giant_rat",      // 10
      "fantasy_goblin",         // 25
      "fantasy_wolf",           // 30
      "fantasy_skeleton",       // 40
      "fantasy_bandit",         // 50
      "fantasy_orc",            // 75
      "fantasy_ogre",           // 150
      "fantasy_troll",          // 200
      "fantasy_dragon_whelp",   // 350
    ];
    let last = -Infinity;
    for (const id of order) {
      const e = FANTASY_BESTIARY.find((x) => x.id === id);
      expect(e).toBeDefined();
      expect(e!.xp_value).toBeGreaterThanOrEqual(last);
      last = e!.xp_value;
    }
  });
});

// ── Type-check guard ────────────────────────────────────────────────────────
// Compile-time only — confirms one Enemy entry constructed from scratch
// type-checks. If a required field is added to Enemy without updating the
// bestiary, this fails to compile alongside the bestiary file itself.
const _typeCheckProbe: Enemy = {
  id:              "test_probe",
  name:            "Test Probe",
  description:     "A unit-test probe.",
  hp_range:        [1, 2],
  agi_mod:         0,
  str_mod:         0,
  damage_die:      "1d4",
  armor_bonus:     0,
  xp_value:        1,
  loot_table_id:   "test_probe_loot",
  is_boss:         false,
  behavior_flavor: "test",
};
void _typeCheckProbe;
