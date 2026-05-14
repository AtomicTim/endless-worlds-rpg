import { ItemRarity } from "@/types/game";
import type { Genre, Item } from "@/types/game";
import { getLootPool } from "./loot-tables";
import type {
  LootPool,
  PoolItem,
  WeightedItem,
  WeightedItemWithRarity,
} from "./loot-tables/types";

/**
 * Day 21 — pure loot resolver (TASK 3 spec).
 *
 * Inputs everything it needs; outputs items + gold. No store access,
 * no MasterState read, no React. RNG is injected so tests can pin
 * results and replay sequences.
 *
 * 3-layer model:
 *   Layer 1 — static genre LootPool (lib/game/loot-tables/<genre>.ts)
 *   Layer 2 — WorldBible.world_loot_items (6-8 world-themed items)
 *   Layer 3 — RegionBible.region_loot_items (3-5 region-themed items)
 *            + RegionBible.boss_drop_item (unique boss reward)
 *
 * Drop rates (per spec):
 *   NORMAL: gold 80%, consumable 50%, valuable 30%, lore 20%,
 *           weapon/armor 5% (COMMON only).
 *   BOSS:   boss_drop_item 100% (if provided), gold 100% (3× tier
 *           pulled from the normal table), weapon/armor 60%
 *           (UNCOMMON/RARE preferred), consumable 40% (any rarity).
 *
 * The static pool's weighted items are templates without ids. The
 * resolver clones the template and stamps `id = crypto.randomUUID()`
 * so two of the same dropped item have distinct inventory rows. World
 * / region items already carry ids — those get suffixed with a unique
 * tail at stamp time to keep the same uniqueness invariant.
 */

export type Rng = () => number;

export interface LootParams {
  /** Stub-shaped reference back to a region loot table id. Future
   *  rounds may key per-region weight overrides off this; Day 21
   *  treats it as data for diagnostics only. */
  loot_table_id:      string;
  is_boss:            boolean;
  genre:              Genre | string;
  world_loot_items?:  Item[];
  region_loot_items?: Item[];
  boss_drop_item?:    Item;
  /** Prompt 1 — enemy.xp_value at drop time. Drives the gold tier:
   *  Tier 2 (6-12 gold) fires when xp_value >= 20 and the drop isn't
   *  from a boss. Optional for back-compat with container drops and
   *  pre-Prompt-1 saves. */
  xp_value?:          number;
  rng?:               Rng;
}

export interface LootResult {
  items: Item[];
  gold:  number;
}

// Drop probabilities — pulled out so tests + boss path can reference
// the same constants the docs do.
const NORMAL_GOLD_RATE        = 0.80;
const NORMAL_CONSUMABLE_RATE  = 0.50;
const NORMAL_VALUABLE_RATE    = 0.30;
const NORMAL_LORE_RATE        = 0.20;
const NORMAL_GEAR_RATE        = 0.05;

const BOSS_GEAR_RATE          = 0.60;
const BOSS_CONSUMABLE_RATE    = 0.40;
// Prompt 1 — BOSS_GOLD_MULTIPLIER removed (boss gold now 15-30 flat).

/**
 * Resolve loot for one enemy / container. Pure: same params + same
 * rng output sequence ⇒ same result.
 */
export function resolveLoot(params: LootParams): LootResult {
  const rng  = params.rng ?? Math.random;
  const pool = getLootPool(params.genre);

  const items: Item[] = [];
  let   gold          = 0;

  if (params.is_boss) {
    // ── Boss path ──────────────────────────────────────────────────────────
    if (params.boss_drop_item) {
      items.push(stampItem(params.boss_drop_item, rng));
    }
    // Prompt 1 — boss gold tier: 15-30 inclusive. Replaces the prior
    // `rollGold(pool.gold_drops) * 3` formula (which produced wildly
    // varying amounts depending on the genre's table tiers).
    gold = Math.floor(rng() * 16) + 15;

    // 60% weapon/armor (preferring higher rarity).
    if (rng() < BOSS_GEAR_RATE) {
      const gear = pickGearForBoss(pool, rng);
      if (gear) items.push(stampPoolItem(gear, rng));
    }

    // 40% consumable (any rarity in the pool).
    if (rng() < BOSS_CONSUMABLE_RATE) {
      const merged = mergePool(pool.consumables, params.world_loot_items, params.region_loot_items, "CONSUMABLE");
      const pick   = pickWeighted(merged, rng);
      if (pick) items.push(stampPickedItem(pick, rng));
    }

    return { items, gold };
  }

  // ── Normal path ────────────────────────────────────────────────────────────
  // Prompt 1 — tiered enemy gold by xp_value. Replaces the
  // pool.gold_drops weighted table for non-boss enemy drops:
  //   Tier 2 (xp_value >= 20): 6-12 gold
  //   Tier 1 (default):        2-5 gold
  // Gold still gates on NORMAL_GOLD_RATE (80%) for thematic
  // consistency with container drops.
  if (rng() < NORMAL_GOLD_RATE) {
    const xp = params.xp_value ?? 0;
    gold = xp >= 20
      ? Math.floor(rng() * 7) + 6
      : Math.floor(rng() * 4) + 2;
  }

  if (rng() < NORMAL_CONSUMABLE_RATE) {
    const merged = mergePool(pool.consumables, params.world_loot_items, params.region_loot_items, "CONSUMABLE");
    const pick   = pickWeighted(merged, rng);
    if (pick) items.push(stampPickedItem(pick, rng));
  }

  if (rng() < NORMAL_VALUABLE_RATE) {
    const merged = mergePool(pool.valuables, params.world_loot_items, params.region_loot_items, "VALUABLE");
    const pick   = pickWeighted(merged, rng);
    if (pick) items.push(stampPickedItem(pick, rng));
  }

  if (rng() < NORMAL_LORE_RATE) {
    const merged = mergePool(pool.lore_items, params.world_loot_items, params.region_loot_items, "LORE");
    const pick   = pickWeighted(merged, rng);
    if (pick) items.push(stampPickedItem(pick, rng));
  }

  if (rng() < NORMAL_GEAR_RATE) {
    // 50/50 weapon vs armor on normal drops, COMMON only.
    const armoryArr  = rng() < 0.5 ? pool.weapons : pool.armor;
    const commonOnly = armoryArr.filter((e) => e.rarity === ItemRarity.COMMON);
    const pick       = pickWeighted(commonOnly, rng);
    if (pick) items.push(stampPoolItem(pick, rng));
  }

  return { items, gold };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — kept private to avoid polluting the export surface.
// Tests cover them through resolveLoot's behavior.
// ─────────────────────────────────────────────────────────────────────────────

/** Merge the static pool's category with world/region items of the
 *  matching ItemType. World/region items get weight 30 by default
 *  (mid-tier) so they appear at a meaningful but not overwhelming
 *  rate. The `categoryType` filter scopes which world/region items
 *  count for this pool (consumables only here, valuables only here,
 *  etc.). */
function mergePool(
  staticEntries:    WeightedItem[],
  worldItems:       Item[] | undefined,
  regionItems:      Item[] | undefined,
  categoryType:     "CONSUMABLE" | "VALUABLE" | "LORE"
): WeightedItem[] {
  const out: WeightedItem[] = staticEntries.map((e) => ({ ...e }));
  const tag = categoryType;
  const merge = (arr: Item[] | undefined) => {
    if (!arr) return;
    for (const i of arr) {
      if (i.type !== tag) continue;
      out.push({ item: stripIdFromPoolEntry(i), weight: 30 });
    }
  };
  merge(worldItems);
  merge(regionItems);
  return out;
}

/** Strip the `id` off a world/region Item so we can route it through
 *  the same pool shape as the static pool entries. The resolver
 *  stamps a fresh id at drop time. */
function stripIdFromPoolEntry(item: Item): PoolItem {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _droppedId, ...rest } = item;
  return rest;
}

/** Weighted random pick. Returns null on empty arrays. */
function pickWeighted<T extends { weight: number }>(arr: T[], rng: Rng): T | null {
  if (arr.length === 0) return null;
  const total = arr.reduce((s, e) => s + e.weight, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const e of arr) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return arr[arr.length - 1];
}

/** Boss-path gear pick — 50/50 weapons vs armor, preferring higher
 *  rarity. Filters out COMMON when at least one UNCOMMON/RARE exists,
 *  otherwise falls back to COMMON so boss kills still drop something. */
function pickGearForBoss(pool: LootPool, rng: Rng): WeightedItemWithRarity | null {
  const arr = rng() < 0.5 ? pool.weapons : pool.armor;
  const higher = arr.filter(
    (e) => e.rarity === ItemRarity.UNCOMMON || e.rarity === ItemRarity.RARE
  );
  const candidates = higher.length > 0 ? higher : arr;
  return pickWeighted(candidates, rng);
}

/** Stamp a fresh uuid id on a static-pool template entry. */
function stampPoolItem(entry: WeightedItem | WeightedItemWithRarity, rng: Rng): Item {
  return stampItem(entry.item, rng);
}

/** Stamp `picked.item` (already-cloned weighted entry). */
function stampPickedItem(picked: WeightedItem, rng: Rng): Item {
  return stampItem(picked.item, rng);
}

/**
 * Clone a pool item template (or any Item missing an id) and stamp
 * a fresh unique id. Falls back to a deterministic id when neither
 * crypto.randomUUID nor sane Math.random are available — keeps the
 * resolver pure-deterministic when used with a seeded rng.
 */
function stampItem(template: PoolItem | Item, rng: Rng): Item {
  const newId = makeId(rng);
  // Defensive copy so dropping the same template twice doesn't
  // create two refs to the same object inside player.inventory.
  return {
    ...template,
    id: newId,
  } as Item;
}

/** Generate a unique-ish id. Uses crypto.randomUUID when available
 *  (browser + modern Node); falls back to a short hex from the rng
 *  so the resolver stays pure under a seeded test rng. */
function makeId(rng: Rng): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    // Even with a fake rng injected, crypto.randomUUID is fine for
    // production paths — tests that need deterministic ids should
    // mock makeId or assert by shape, not exact strings.
    try { return crypto.randomUUID(); } catch { /* fall through */ }
  }
  // Deterministic fallback. 4 bytes from the rng — collision risk is
  // acceptable for tests because they assert by item count/category,
  // not by id equality.
  const n = Math.floor(rng() * 0xffffffff);
  return `loot_${n.toString(16).padStart(8, "0")}`;
}
