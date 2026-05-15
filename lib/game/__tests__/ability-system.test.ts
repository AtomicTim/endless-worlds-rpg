// P6 — Ability system foundation tests.
//
// Verifies the v1 library is fully populated for all 25 classes, that
// each class has the correct slot+passive shape, and that the slot
// unlock helpers match the rule 97 / 164 schedule (5 / 10 / 15).

import {
  ABILITY_LIBRARY,
  getAbilitiesForClass,
  getPassiveForClass,
  getSlotAbilitiesForClass,
  getUnlockedSlotCount,
  isSlotUnlocked,
} from "@/lib/game/abilities";

/** Canonical 25-class set. Mirrors the 5-genre table in CLAUDE.md. */
const ALL_CLASSES = [
  // Fantasy
  "knight", "rogue", "mage", "ranger", "herald",
  // Cyberpunk
  "netrunner", "fixer", "street_samurai", "enforcer", "ghost",
  // Horror
  "investigator", "cultist", "survivor", "phantom", "medium",
  // Space Opera
  "commander", "pilot", "engineer", "marine", "recon",
  // Post-Apoc
  "scavenger", "raider", "medic", "runner", "demagogue",
];

describe("ABILITY_LIBRARY — class coverage", () => {
  it("contains entries for all 25 classes", () => {
    for (const classId of ALL_CLASSES) {
      const entries = getAbilitiesForClass(classId);
      expect(entries.length).toBeGreaterThan(0);
    }
  });

  it("ships 125 entries total (25 classes × 5)", () => {
    expect(Object.keys(ABILITY_LIBRARY).length).toBe(125);
  });

  it("every class has exactly 1 passive ability", () => {
    for (const classId of ALL_CLASSES) {
      const passives = getAbilitiesForClass(classId).filter((e) => e.is_passive);
      expect(passives.length).toBe(1);
    }
  });

  it("every class has abilities for slots 1, 2, 3, and 4", () => {
    for (const classId of ALL_CLASSES) {
      const slots = getAbilitiesForClass(classId)
        .filter((e) => !e.is_passive)
        .map((e) => e.slot_position)
        .sort();
      expect(slots).toEqual([1, 2, 3, 4]);
    }
  });
});

describe("getAbilitiesForClass", () => {
  it("returns 5 entries for Knight (4 slot abilities + 1 passive)", () => {
    expect(getAbilitiesForClass("knight").length).toBe(5);
  });

  it("orders slot 1 → 2 → 3 → 4, passive last", () => {
    const entries = getAbilitiesForClass("knight");
    expect(entries.map((e) => e.slot_position ?? "passive")).toEqual([
      1, 2, 3, 4, "passive",
    ]);
  });

  it("returns an empty array for an unknown class", () => {
    expect(getAbilitiesForClass("not_a_class")).toEqual([]);
  });
});

describe("getPassiveForClass", () => {
  it("returns an entry with is_passive: true for every class", () => {
    for (const classId of ALL_CLASSES) {
      const p = getPassiveForClass(classId);
      expect(p).toBeDefined();
      expect(p!.is_passive).toBe(true);
      expect(p!.class_id).toBe(classId);
    }
  });

  it("returns the canonical Knight passive (Iron Resolve)", () => {
    expect(getPassiveForClass("knight")?.base_name).toBe("Iron Resolve");
  });

  it("returns undefined for an unknown class", () => {
    expect(getPassiveForClass("not_a_class")).toBeUndefined();
  });
});

describe("getSlotAbilitiesForClass", () => {
  it("returns exactly 1 entry for slot 1 (slot 1 is fixed per class in v1)", () => {
    for (const classId of ALL_CLASSES) {
      expect(getSlotAbilitiesForClass(classId, 1).length).toBe(1);
    }
  });

  it("the slot 1 entry has slot_position === 1 and is_passive === false", () => {
    const [knight_s1] = getSlotAbilitiesForClass("knight", 1);
    expect(knight_s1.slot_position).toBe(1);
    expect(knight_s1.is_passive).toBe(false);
    expect(knight_s1.base_name).toBe("Shield Bash");
  });

  it("returns 1 entry for each of slots 2, 3, 4 in v1", () => {
    for (const classId of ALL_CLASSES) {
      expect(getSlotAbilitiesForClass(classId, 2).length).toBe(1);
      expect(getSlotAbilitiesForClass(classId, 3).length).toBe(1);
      expect(getSlotAbilitiesForClass(classId, 4).length).toBe(1);
    }
  });
});

describe("getUnlockedSlotCount — rule 97 / 164 schedule", () => {
  it("level 1 → 1 slot", () => {
    expect(getUnlockedSlotCount(1)).toBe(1);
  });
  it("level 4 → 1 slot (just below the slot-2 unlock)", () => {
    expect(getUnlockedSlotCount(4)).toBe(1);
  });
  it("level 5 → 2 slots (slot-2 unlock)", () => {
    expect(getUnlockedSlotCount(5)).toBe(2);
  });
  it("level 9 → 2 slots", () => {
    expect(getUnlockedSlotCount(9)).toBe(2);
  });
  it("level 10 → 3 slots (slot-3 unlock)", () => {
    expect(getUnlockedSlotCount(10)).toBe(3);
  });
  it("level 14 → 3 slots", () => {
    expect(getUnlockedSlotCount(14)).toBe(3);
  });
  it("level 15 → 4 slots (slot-4 unlock)", () => {
    expect(getUnlockedSlotCount(15)).toBe(4);
  });
  it("level 20 → 4 slots (level cap)", () => {
    expect(getUnlockedSlotCount(20)).toBe(4);
  });
});

describe("isSlotUnlocked", () => {
  it("slot 1 is always unlocked, even at level 1", () => {
    expect(isSlotUnlocked(1, 1)).toBe(true);
  });
  it("slot 2 at level 4 → false", () => {
    expect(isSlotUnlocked(2, 4)).toBe(false);
  });
  it("slot 2 at level 5 → true", () => {
    expect(isSlotUnlocked(2, 5)).toBe(true);
  });
  it("slot 3 at level 9 → false; at level 10 → true", () => {
    expect(isSlotUnlocked(3, 9)).toBe(false);
    expect(isSlotUnlocked(3, 10)).toBe(true);
  });
  it("slot 4 at level 14 → false; at level 15 → true", () => {
    expect(isSlotUnlocked(4, 14)).toBe(false);
    expect(isSlotUnlocked(4, 15)).toBe(true);
  });
});

describe("ABILITY_LIBRARY — shape invariants", () => {
  it("every entry has base_charges === 2", () => {
    for (const entry of Object.values(ABILITY_LIBRARY)) {
      expect(entry.base_charges).toBe(2);
    }
  });

  it("non-passive entries have a defined slot_position; passives do not", () => {
    for (const entry of Object.values(ABILITY_LIBRARY)) {
      if (entry.is_passive) {
        expect(entry.slot_position).toBeUndefined();
      } else {
        expect([1, 2, 3, 4]).toContain(entry.slot_position);
      }
    }
  });

  it("ability ids are unique snake_case slugs", () => {
    const ids = Object.keys(ABILITY_LIBRARY);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("v1 abilities carry no stat_requirement (own-class abilities have no gate — rule 165)", () => {
    for (const entry of Object.values(ABILITY_LIBRARY)) {
      expect(entry.stat_requirement).toBeUndefined();
    }
  });
});
