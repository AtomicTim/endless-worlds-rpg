import { acceptNarratorItemsAcquired } from "@/lib/game/narrator-guards";
import type { Item } from "@/types/game";
import { ItemRarity, ItemType } from "@/types/game";

/**
 * Rule 107 regression — the narrator can NEVER add items to inventory.
 *
 * Symptom that drove this rule (V8.60 / FIX 1): a player typed "I look
 * for the Surveyor's Seal" inside a dungeon room. The narrator generated
 * flavor prose describing finding the item and emitted items_acquired
 * with the seal in it. The game loop then dropped the seal into the
 * player's pack — bypassing the dungeon's container guarantee, the loot
 * table, and the quest's intended discovery flow.
 *
 * The architectural fix: useGameLoop now routes narrator items_acquired
 * through `acceptNarratorItemsAcquired`, which returns [] unconditionally.
 * Only resolveLoot (containers, rule 84) and handleVictory → floor_loot
 * (combat, rule 83) may grant items. Merchant buyItem is a separate
 * mechanical-commerce path.
 *
 * The tests below pin that contract by passing every shape the narrator
 * has been observed to emit and asserting the filter returns empty.
 */

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id:        "item_test",
    name:      "Test Item",
    type:      ItemType.VALUABLE,
    rarity:    ItemRarity.COMMON,
    description: "A test object.",
    quantity:  1,
    stackable: false,
    weight:    1,
    value:     10,
    ...overrides,
  } as Item;
}

describe("acceptNarratorItemsAcquired", () => {
  it("returns empty array when narrator emitted no items", () => {
    expect(acceptNarratorItemsAcquired([])).toEqual([]);
    expect(acceptNarratorItemsAcquired(undefined)).toEqual([]);
  });

  it("drops a single narrator-emitted item — even a generic one", () => {
    const items = [makeItem({ name: "Trail Rations", type: ItemType.CONSUMABLE })];
    expect(acceptNarratorItemsAcquired(items)).toEqual([]);
  });

  it("drops a quest-relevant key item the narrator tried to grant (the symptom case)", () => {
    // Reproduces the Surveyor's Seal incident — narrator described the
    // player finding the key item inside a dungeon room and emitted it
    // in items_acquired. The filter MUST drop it; key items only arrive
    // via container search (resolveLoot) inside the middle-room.
    const surveyorsSeal = makeItem({
      id:           "item_surveyors_seal",
      name:         "The Surveyor's Seal",
      type:         ItemType.KEY,
      rarity:       ItemRarity.RARE,
      is_key_item:  true,
      unlocks_node: "dungeon_boss_room",
    });
    expect(acceptNarratorItemsAcquired([surveyorsSeal])).toEqual([]);
  });

  it("drops every rarity tier — RARE / LEGENDARY items get no special treatment", () => {
    const rarities = [
      ItemRarity.COMMON, ItemRarity.UNCOMMON, ItemRarity.RARE, ItemRarity.LEGENDARY,
    ];
    for (const rarity of rarities) {
      const result = acceptNarratorItemsAcquired([makeItem({ rarity })]);
      expect(result).toEqual([]);
    }
  });

  it("drops every item type — WEAPON / ARMOR / CONSUMABLE / KEY / LORE / VALUABLE / QUEST_ITEM / STAT_XP / CONTAINER", () => {
    const types = [
      ItemType.WEAPON, ItemType.ARMOR, ItemType.CONSUMABLE, ItemType.KEY,
      ItemType.LORE, ItemType.VALUABLE, ItemType.QUEST_ITEM, ItemType.STAT_XP,
      ItemType.CONTAINER,
    ];
    for (const type of types) {
      const result = acceptNarratorItemsAcquired([makeItem({ type })]);
      expect(result).toEqual([]);
    }
  });

  it("drops a long list of items — the count does not matter", () => {
    const many = Array.from({ length: 20 }, (_, i) => makeItem({ id: `item_${i}`, name: `Item ${i}` }));
    expect(acceptNarratorItemsAcquired(many)).toEqual([]);
  });
});
