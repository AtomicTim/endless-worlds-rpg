import { Genre } from "@/types/game";
import type { LootPool } from "./types";
import { LOOT_POOL as FANTASY_POOL }   from "./fantasy";
import { LOOT_POOL as CYBERPUNK_POOL } from "./cyberpunk";
import { LOOT_POOL as HORROR_POOL }    from "./horror";
import { LOOT_POOL as SPACE_POOL }     from "./space";
import { LOOT_POOL as APOC_POOL }      from "./apoc";

/**
 * Day 21 — genre → static loot pool registry.
 *
 * `getLootPool` is the single read site for the resolver. Unknown
 * genres fall back to Fantasy so combat victory never crashes on a
 * malformed save.
 */

const POOLS: Record<Genre, LootPool> = {
  [Genre.FANTASY]:             FANTASY_POOL,
  [Genre.CYBERPUNK]:           CYBERPUNK_POOL,
  [Genre.HORROR_LOVECRAFTIAN]: HORROR_POOL,
  [Genre.SPACE_OPERA]:         SPACE_POOL,
  [Genre.POST_APOCALYPTIC]:    APOC_POOL,
};

export function getLootPool(genre: Genre | string | undefined): LootPool {
  if (genre && (POOLS as Record<string, LootPool>)[genre]) {
    return (POOLS as Record<string, LootPool>)[genre];
  }
  return FANTASY_POOL;
}

export type { LootPool, WeightedItem, WeightedGold, WeightedItemWithRarity, PoolItem } from "./types";
