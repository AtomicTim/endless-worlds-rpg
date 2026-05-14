/**
 * Day 21 TASK 12 — loot-resolver integration tests.
 *
 * Pure module: resolveLoot is deterministic when called with a
 * seeded rng. These tests pin the rng sequence so the assertions
 * can describe exactly what should drop.
 *
 * The rng is consumed in a fixed order inside resolveLoot:
 *   1. rng() < NORMAL_GOLD_RATE check
 *   2. tier weight pick
 *   3. tier-internal min/max roll
 *   4. rng() < NORMAL_CONSUMABLE_RATE
 *   5. (if hit) inner weight pick
 *   6. (if hit) inner item pick weight pass — variable
 *   ... etc
 *
 * Tests below avoid asserting exact rng sequences (too fragile) and
 * instead pin behavior by using "all-zeros rng → always hit" or
 * "all-high rng → always miss" patterns. That keeps the contract
 * meaningful (drop rates / boss path / world+region item injection)
 * without coupling to implementation details.
 */

import { Genre, ItemRarity, ItemType } from "@/types/game";
import type { Item } from "@/types/game";
import { resolveLoot } from "@/lib/game/loot-resolver";

/** rng that always returns 0 — every probability gate hits, every
 *  weighted pick lands on the first eligible entry. */
function rngAlwaysZero(): () => number {
  return () => 0;
}

/** rng that always returns 0.99 — every probability gate misses
 *  (except gates with rate >= 0.99). */
function rngAlwaysHigh(): () => number {
  return () => 0.99;
}

/** rng that replays a fixed sequence (and loops). */
function rngSeq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const REGION_LORE_ITEM: Item = {
  id:          "test_region_lore",
  name:        "Region-Specific Codex Fragment",
  type:        ItemType.LORE,
  rarity:      ItemRarity.UNCOMMON,
  description: "Lore that only spawns here.",
  quantity:    1,
  stackable:   false,
  effect:      {},
  value:       10,
};

const WORLD_VALUABLE_ITEM: Item = {
  id:          "test_world_valuable",
  name:        "World-Specific Trinket",
  type:        ItemType.VALUABLE,
  rarity:      ItemRarity.UNCOMMON,
  description: "Trinket native to this world.",
  quantity:    1,
  stackable:   false,
  effect:      {},
  value:       40,
};

const BOSS_DROP: Item = {
  id:          "test_boss_drop",
  name:        "Trophy Blade",
  type:        ItemType.WEAPON,
  rarity:      ItemRarity.RARE,
  description: "Boss reward.",
  quantity:    1,
  stackable:   false,
  effect:      { damage_die: "1d10" },
  value:       300,
};

describe("resolveLoot — Day 21 TASK 3 normal path", () => {
  it("static pool only: produces items + gold without crashing", () => {
    const out = resolveLoot({
      loot_table_id: "stub",
      is_boss:       false,
      genre:         Genre.FANTASY,
      rng:           rngAlwaysZero(),
    });
    // All gates trip with rng=0 → at least 4 item drops (consumable,
    // valuable, lore, weapon-or-armor) + gold.
    expect(out.items.length).toBeGreaterThanOrEqual(3);
    expect(out.gold).toBeGreaterThan(0);
  });

  it("misses every drop gate when rng is high", () => {
    const out = resolveLoot({
      loot_table_id: "stub",
      is_boss:       false,
      genre:         Genre.FANTASY,
      rng:           rngAlwaysHigh(),
    });
    // Every probability is < 0.99 in the normal path, so nothing drops.
    expect(out.items.length).toBe(0);
    expect(out.gold).toBe(0);
  });

  it("each dropped item carries a unique id (no shared references)", () => {
    const out = resolveLoot({
      loot_table_id: "stub",
      is_boss:       false,
      genre:         Genre.FANTASY,
      rng:           rngAlwaysZero(),
    });
    const ids = out.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Two pool drops can't share object identity.
    for (const item of out.items) {
      expect(item.id).toBeTruthy();
    }
  });
});

describe("resolveLoot — world / region item injection", () => {
  it("world_loot_items can appear in the resolved output", () => {
    // Tight rng: trip the lore gate, force the weighted pick to land
    // on the world-injected entry by zeroing the inner pick value.
    // Lore pool has 3 static entries (50/30/20) summing to 100; adding
    // a 4th entry with weight 30 lands the pick on the new entry when
    // rng = 0 for the inner pick (it starts from index 0 — but the
    // tail world entry only lands when rng > 0.999). Easier path: send
    // 50+ lore-only items in world array — overwhelming the pool. We
    // use a single sentinel item and use rngAlwaysZero so the FIRST
    // entry of the (cloned) array wins. Reorder via the merge
    // function: world items get APPENDED, so they only land at the
    // tail. Use rng = [..., near 1] to grab the tail.
    //
    // Simpler approach: instead of asserting injection ALWAYS appears,
    // assert that with an empty static pool stub, the world entry
    // becomes the only option and DOES appear. We can't blank the
    // static pool here without rewriting it — but we CAN run the
    // resolver many times and confirm the world entry appears at
    // least once across rolls.
    const samples = 200;
    const rng = () => Math.random();
    let saw = false;
    for (let i = 0; i < samples; i += 1) {
      const out = resolveLoot({
        loot_table_id:    "stub",
        is_boss:          false,
        genre:            Genre.FANTASY,
        world_loot_items: [WORLD_VALUABLE_ITEM],
        rng,
      });
      if (out.items.some((it) => it.name === WORLD_VALUABLE_ITEM.name)) {
        saw = true;
        break;
      }
    }
    expect(saw).toBe(true);
  });

  it("region_loot_items can appear in the resolved output", () => {
    const samples = 200;
    const rng = () => Math.random();
    let saw = false;
    for (let i = 0; i < samples; i += 1) {
      const out = resolveLoot({
        loot_table_id:     "stub",
        is_boss:           false,
        genre:             Genre.FANTASY,
        region_loot_items: [REGION_LORE_ITEM],
        rng,
      });
      if (out.items.some((it) => it.name === REGION_LORE_ITEM.name)) {
        saw = true;
        break;
      }
    }
    expect(saw).toBe(true);
  });

  it("empty world / region arrays don't crash and don't change behavior", () => {
    const out = resolveLoot({
      loot_table_id:     "stub",
      is_boss:           false,
      genre:             Genre.FANTASY,
      world_loot_items:  [],
      region_loot_items: [],
      rng:               rngAlwaysHigh(),
    });
    expect(out.items.length).toBe(0);
    expect(out.gold).toBe(0);
  });
});

describe("resolveLoot — boss path", () => {
  it("always includes boss_drop_item when provided", () => {
    // Run a few rolls — boss_drop_item should always appear regardless
    // of rng. The boss path doesn't gate boss_drop_item.
    for (let i = 0; i < 5; i += 1) {
      const out = resolveLoot({
        loot_table_id:  "stub",
        is_boss:        true,
        genre:          Genre.FANTASY,
        boss_drop_item: BOSS_DROP,
        rng:            rngSeq([0.1 * i, 0.2 * i, 0.3 * i, 0.4 * i, 0.5 * i, 0.6 * i, 0.7 * i, 0.8 * i]),
      });
      expect(out.items.some((it) => it.name === BOSS_DROP.name)).toBe(true);
    }
  });

  it("boss gold is in the 15-30 calibrated band", () => {
    // Prompt 1 — boss gold is now a flat random 15-30 (was 3× a
    // pool.gold_drops weighted roll). With rng=0 the formula
    // Math.floor(0 * 16) + 15 = 15.
    const out = resolveLoot({
      loot_table_id: "stub",
      is_boss:       true,
      genre:         Genre.FANTASY,
      rng:           rngAlwaysZero(),
    });
    expect(out.gold).toBe(15);
  });

  it("boss path does not auto-add gold to player resources (resolver is pure)", () => {
    // Sanity — the resolver returns gold as a number, never mutates a
    // player object. This is a regression guard for the V8 victory
    // model that auto-applied loot inline (now moved to the strip).
    const out = resolveLoot({
      loot_table_id:  "stub",
      is_boss:        true,
      genre:          Genre.FANTASY,
      boss_drop_item: BOSS_DROP,
      rng:            rngAlwaysZero(),
    });
    expect(typeof out.gold).toBe("number");
    // No "player" field on LootResult.
    expect("player" in out).toBe(false);
  });

  it("boss weapon/armor rate is meaningfully higher than normal", () => {
    // Normal gear rate is 5%, boss is 60%. Across 200 rolls the boss
    // path should produce gear (weapon or armor) at least 50× — well
    // above the normal path's expected ~10. We check the boss path
    // produces gear at least 80 times out of 200 (40% — comfortable
    // floor below the 60% target) to give Math.random's variance
    // headroom without flakiness.
    let bossGearCount = 0;
    for (let i = 0; i < 200; i += 1) {
      const out = resolveLoot({
        loot_table_id:  "stub",
        is_boss:        true,
        genre:          Genre.FANTASY,
        boss_drop_item: BOSS_DROP,
      });
      // Filter OUT the boss_drop_item — count only OTHER weapon/armor.
      const otherGear = out.items.filter(
        (it) =>
          (it.type === ItemType.WEAPON || it.type === ItemType.ARMOR) &&
          it.name !== BOSS_DROP.name
      );
      if (otherGear.length > 0) bossGearCount += 1;
    }
    expect(bossGearCount).toBeGreaterThanOrEqual(80);
  });
});

describe("resolveLoot — determinism + edge cases", () => {
  it("same params + same rng sequence => identical results", () => {
    const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.0];
    const a = resolveLoot({
      loot_table_id: "stub", is_boss: false, genre: Genre.FANTASY, rng: rngSeq(seq),
    });
    const b = resolveLoot({
      loot_table_id: "stub", is_boss: false, genre: Genre.FANTASY, rng: rngSeq(seq),
    });
    // Same gold value, same item count, same item names (the ids
    // differ — crypto.randomUUID intentionally non-deterministic in
    // production paths; tests don't pin ids).
    expect(a.gold).toBe(b.gold);
    expect(a.items.length).toBe(b.items.length);
    expect(a.items.map((i) => i.name)).toEqual(b.items.map((i) => i.name));
  });

  it("unknown genre falls back to Fantasy pool (no crash)", () => {
    expect(() =>
      resolveLoot({
        loot_table_id: "stub",
        is_boss:       false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        genre:         "totally_made_up_genre" as any,
        rng:           rngAlwaysZero(),
      })
    ).not.toThrow();
  });

  it("each genre's static pool resolves cleanly (no missing tables)", () => {
    for (const genre of [
      Genre.FANTASY, Genre.CYBERPUNK, Genre.HORROR_LOVECRAFTIAN,
      Genre.SPACE_OPERA, Genre.POST_APOCALYPTIC,
    ]) {
      const out = resolveLoot({
        loot_table_id: "stub", is_boss: false, genre, rng: rngAlwaysZero(),
      });
      expect(out.items.length).toBeGreaterThanOrEqual(1);
      expect(out.gold).toBeGreaterThan(0);
    }
  });
});
