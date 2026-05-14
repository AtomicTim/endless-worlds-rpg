import type { Genre, Item, ItemRarity } from "@/types/game";

/**
 * Day 21 — static genre loot pool shapes (TASK 2 spec).
 *
 * One LootPool per genre. The pool plus any world-level or region-level
 * items (from WorldBible.world_loot_items / RegionBible.region_loot_items)
 * feeds the resolver. Pools are STATIC content — code, not AI — so loot
 * is reliable and balanced regardless of generation quality.
 *
 * Item objects in pool entries omit `id` (the resolver stamps a unique
 * one per drop so two of the same item in inventory have distinct rows).
 * Pool entries hold the template; resolver stamps + returns clones.
 */

export type PoolItem = Omit<Item, "id">;

export interface WeightedItem {
  item:   PoolItem;
  weight: number;
}

export interface WeightedGold {
  weight: number;
  min:    number;
  max:    number;
}

export interface WeightedItemWithRarity extends WeightedItem {
  rarity: ItemRarity;
}

/**
 * One genre's static loot pool. Resolver merges per-category arrays
 * with the world / region loot inputs to build the final draw set.
 *
 * Per Day 21 design:
 *   gold_drops:  three weight tiers (handful / decent / fat) so the
 *                amount rolled feels purposeful rather than uniform.
 *   consumables: heals + utility (antidote, rations) — common rarity.
 *   valuables:   sellable items with no mechanical effect.
 *   lore_items:  worldbuilding flavor; codex hooks for later phases.
 *   weapons:     COMMON drops are the default — UNCOMMON only on boss
 *                roll paths.
 *   armor:       same rarity gating as weapons.
 */
export interface LootPool {
  genre:        Genre;
  gold_drops:   WeightedGold[];
  consumables:  WeightedItem[];
  valuables:    WeightedItem[];
  lore_items:   WeightedItem[];
  weapons:      WeightedItemWithRarity[];
  armor:        WeightedItemWithRarity[];
}
