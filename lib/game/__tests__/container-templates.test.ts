/**
 * Day 21 TASK 12 — container-templates tests.
 *
 * Pure module: deterministic, no rng, no state. Tests assert the
 * exact strings the player will see in the story feed so a future
 * copy edit is caught here before it reaches QA.
 */

import { Genre, ItemRarity, ItemType } from "@/types/game";
import type { Item } from "@/types/game";
import {
  getEmptyContainerTemplate,
  getSearchNarrative,
} from "@/lib/game/container-templates";

function makeItem(name: string, rarity = ItemRarity.COMMON): Item {
  return {
    id:          `item_${name.toLowerCase().replace(/\W+/g, "_")}`,
    name,
    type:        ItemType.VALUABLE,
    rarity,
    description: "",
    quantity:    1,
    stackable:   false,
    effect:      {},
    value:       10,
  };
}

describe("getEmptyContainerTemplate", () => {
  it("pile-of-bones routes to the dust template", () => {
    expect(getEmptyContainerTemplate("Pile of Bones")).toBe(
      "The bones scatter at your touch, leaving nothing but dust."
    );
  });

  it("chest routes to the already-opened template", () => {
    expect(getEmptyContainerTemplate("The Iron Chest")).toBe(
      "The Iron Chest has already been opened and picked clean."
    );
  });

  it("type:container also routes to the already-opened template", () => {
    expect(getEmptyContainerTemplate("The Stone Cask", "container")).toBe(
      "The Stone Cask has already been opened and picked clean."
    );
  });

  it("barrel routes to the rot template", () => {
    expect(getEmptyContainerTemplate("Salt Barrel")).toBe(
      "Salt Barrel is empty save for the smell of rot."
    );
  });

  it("crate routes to the rot template", () => {
    expect(getEmptyContainerTemplate("Supply Crate")).toBe(
      "Supply Crate is empty save for the smell of rot."
    );
  });

  it("shelf routes to the stripped-bare template", () => {
    expect(getEmptyContainerTemplate("The Bookshelf")).toBe(
      "The Bookshelf has been stripped bare."
    );
  });

  it("type:fixture returns the immovable-fixture template", () => {
    expect(getEmptyContainerTemplate("The Statue", "fixture")).toBe(
      "The Statue is solid and immovable — nothing to take."
    );
  });

  it("type:lore returns the nothing-new template", () => {
    expect(getEmptyContainerTemplate("Ancient Mural", "lore")).toBe(
      "Ancient Mural reveals nothing new on a second look."
    );
  });

  it("type:trigger returns the already-done template", () => {
    expect(getEmptyContainerTemplate("Pressure Plate", "trigger")).toBe(
      "Pressure Plate has already done its work."
    );
  });

  it("unknown type + unknown name returns the generic fallback", () => {
    expect(getEmptyContainerTemplate("The Strange Object")).toBe(
      "You search The Strange Object and find nothing of value."
    );
  });

  it("missing name falls back to 'the container'", () => {
    expect(getEmptyContainerTemplate("")).toBe(
      "You search the container and find nothing of value."
    );
  });
});

describe("getSearchNarrative", () => {
  it("items + gold: uncovers list and gold amount", () => {
    const items = [makeItem("Silver Brooch"), makeItem("Cut Gemstone")];
    expect(getSearchNarrative("The Iron Chest", items, 25, Genre.FANTASY)).toBe(
      "You search The Iron Chest and uncover Silver Brooch and Cut Gemstone and 25 Gold."
    );
  });

  it("items only: finds the list of items (no Oxford comma at 2 items)", () => {
    const items = [makeItem("Silver Brooch"), makeItem("Cut Gemstone")];
    expect(getSearchNarrative("The Iron Chest", items, 0, Genre.FANTASY)).toBe(
      "You search The Iron Chest and find Silver Brooch and Cut Gemstone."
    );
  });

  it("items only with 3 items: Oxford-comma list", () => {
    const items = [
      makeItem("Silver Brooch"),
      makeItem("Cut Gemstone"),
      makeItem("Copper Idol"),
    ];
    expect(getSearchNarrative("the chest", items, 0, Genre.FANTASY)).toBe(
      "You search the chest and find Silver Brooch, Cut Gemstone, and Copper Idol."
    );
  });

  it("gold only: shows currency label", () => {
    expect(getSearchNarrative("the chest", [], 17, Genre.FANTASY)).toBe(
      "You search the chest and find 17 Gold."
    );
  });

  it("gold only in cyberpunk uses Credits", () => {
    expect(getSearchNarrative("the locker", [], 100, Genre.CYBERPUNK)).toBe(
      "You search the locker and find 100 Credits."
    );
  });

  it("gold only in horror uses Marks", () => {
    expect(getSearchNarrative("the offering bowl", [], 12, Genre.HORROR_LOVECRAFTIAN)).toBe(
      "You search the offering bowl and find 12 Marks."
    );
  });

  it("empty container delegates to getEmptyContainerTemplate", () => {
    // The Iron Chest with no items + no gold should match the
    // 'already-opened' template path.
    expect(getSearchNarrative("The Iron Chest", [], 0, Genre.FANTASY)).toBe(
      "The Iron Chest has already been opened and picked clean."
    );
  });

  it("empty + bones name routes through the bones template", () => {
    expect(getSearchNarrative("Pile of Bones", [], 0, Genre.FANTASY)).toBe(
      "The bones scatter at your touch, leaving nothing but dust."
    );
  });
});
