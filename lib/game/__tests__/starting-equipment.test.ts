import { Genre, ItemType } from "@/types/game";
import {
  BACKGROUND_CONFIGS,
  buildStartingInventory,
  buildItem,
  BASIC_HEALTH_POTION_ID,
} from "../starting-equipment";

const VALID_DAMAGE_DIE = /^\d+d\d+$/;

describe("starting-equipment — every genre × background ships a combat-ready loadout", () => {
  // Walk every genre × background. Each must:
  //   1. exist in BACKGROUND_CONFIGS
  //   2. include an equipped WEAPON with a valid damage_die
  //   3. include an equipped ARMOR with a numeric armor_bonus (>= 0)
  //   4. include at least one CONSUMABLE (the basic health potion)
  for (const [genre, bgs] of Object.entries(BACKGROUND_CONFIGS)) {
    for (const background of Object.keys(bgs)) {
      it(`${genre}/${background}: equipped weapon + equipped armor + consumable`, () => {
        const { items, bonusAttribute } = buildStartingInventory(
          genre as Genre,
          background
        );
        expect(items.length).toBeGreaterThanOrEqual(3);
        expect(bonusAttribute).not.toBeNull();

        const weapon = items.find((i) => i.type === ItemType.WEAPON && i.equipped);
        expect(weapon).toBeDefined();
        const die = weapon!.effect?.damage_die;
        expect(typeof die).toBe("string");
        expect(die!).toMatch(VALID_DAMAGE_DIE);

        const armor = items.find((i) => i.type === ItemType.ARMOR && i.equipped);
        expect(armor).toBeDefined();
        const bonus = armor!.effect?.armor_bonus;
        expect(typeof bonus).toBe("number");
        expect(bonus!).toBeGreaterThanOrEqual(0);

        const consumable = items.find((i) => i.type === ItemType.CONSUMABLE);
        expect(consumable).toBeDefined();
      });
    }
  }
});

describe("starting-equipment — health potion uses canonical id for combat use_item", () => {
  it("Fantasy knight's health potion id matches BASIC_HEALTH_POTION_ID", () => {
    const { items } = buildStartingInventory(Genre.FANTASY, "knight");
    const potion = items.find((i) => i.id === BASIC_HEALTH_POTION_ID);
    expect(potion).toBeDefined();
    expect(potion!.type).toBe(ItemType.CONSUMABLE);
    expect(potion!.quantity).toBe(2);
    expect(potion!.stackable).toBe(true);
  });

  it("Cyberpunk netrunner ships 2× stim patches keyed to BASIC_HEALTH_POTION_ID", () => {
    const { items } = buildStartingInventory(Genre.CYBERPUNK, "netrunner");
    const stim = items.find((i) => i.id === BASIC_HEALTH_POTION_ID);
    expect(stim).toBeDefined();
    expect(stim!.name).toBe("Stim Patch");
    expect(stim!.quantity).toBe(2);
  });
});

describe("starting-equipment — buildItem", () => {
  it("assigns a stable id when spec.id is provided", () => {
    const item = buildItem({
      id:          "test_id",
      name:        "Test Sword",
      type:        ItemType.WEAPON,
      description: "A test.",
      equipped:    true,
      effect:      { damage_die: "1d6" },
    });
    expect(item.id).toBe("test_id");
    expect(item.equipped).toBe(true);
    expect(item.effect?.damage_die).toBe("1d6");
  });

  it("generates a UUID when spec.id is omitted", () => {
    const item = buildItem({
      name:        "Test Lore",
      type:        ItemType.LORE,
      description: "x",
    });
    // crypto.randomUUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("defaults consumables to stackable=true; non-consumables to false", () => {
    const consumable = buildItem({
      name:        "Potion",
      type:        ItemType.CONSUMABLE,
      description: "x",
    });
    const weapon = buildItem({
      name:        "Sword",
      type:        ItemType.WEAPON,
      description: "x",
    });
    expect(consumable.stackable).toBe(true);
    expect(weapon.stackable).toBe(false);
  });

  it("defaults quantity to 1 when omitted", () => {
    const item = buildItem({
      name:        "Sword",
      type:        ItemType.WEAPON,
      description: "x",
    });
    expect(item.quantity).toBe(1);
  });
});

describe("starting-equipment — buildStartingInventory edge cases", () => {
  it("returns empty payload for an unknown background", () => {
    const out = buildStartingInventory(Genre.FANTASY, "necromancer");
    expect(out.items).toEqual([]);
    expect(out.bonusAttribute).toBeNull();
  });
});
