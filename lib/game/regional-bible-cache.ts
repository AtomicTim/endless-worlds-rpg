/**
 * Day 19D — Regional Bible cache + outline matching helpers.
 *
 * The WorldBible's adjacent_regions are structural outlines only. When
 * the player crosses into one we either fetch a pre-generated full
 * RegionBible from this cache (instant) or fall through to a live
 * generate-regional-bible call (with a brief loading indicator).
 *
 * Cache scope:
 *   - Module-level Map keyed by `${session_id}__${outline_id}`.
 *   - Cleared explicitly via invalidateRegionalBibleCache(sessionId)
 *     whenever the active session changes.
 *
 * The cache is also where background pre-generation lives. When the
 * narrator describes a directional exit hint, we kick off a void fetch
 * to generate-regional-bible and stash the result here. By the time the
 * player actually enters the region, the bible is usually already warm.
 */

import type {
  Genre,
  RegionBible,
  RegionOutline,
  WorldConsistencyDocument,
} from "@/types/game";

interface CacheKey {
  sessionId: string;
  outlineId: string;
}

const cache: Map<string, RegionBible> = new Map();
/**
 * V8.53 — in-flight pregeneration promises, keyed identically to the
 * main cache. Holds the *promise* itself (not just a sentinel) so a
 * navigation that races a pre-gen can `await` the existing fetch
 * instead of spawning a duplicate `/api/game/generate-regional-bible`
 * call. Pre-V8.53 this was a `Set<string>` flag — pregen knew to skip
 * if another pregen was running, but the navigation path couldn't see
 * the pregen at all and always fired its own duplicate.
 *
 * Resolves to `null` when the pregen failed (network / 500 / no bible
 * in payload) — callers fall through to a live fetch with a visible
 * loading indicator, same path as a total cache miss.
 */
const inFlight: Map<string, Promise<RegionBible | null>> = new Map();

function k({ sessionId, outlineId }: CacheKey): string {
  return `${sessionId}__${outlineId}`;
}

/**
 * Look up a previously-cached RegionBible for this outline (warm hit
 * means background pre-generation already completed). Returns null on
 * miss.
 *
 * Bug 2 diagnostic — log every read with the full cache key + the
 * cached bible's id (when present) so we can confirm the cache is
 * correctly partitioned by (sessionId, outlineId) and never serving
 * a different region's bible to the player.
 */
export function getCachedRegionalBible(
  sessionId: string,
  outlineId: string
): RegionBible | null {
  const cacheKey = k({ sessionId, outlineId });
  const cached   = cache.get(cacheKey) ?? null;
  console.log(
    "[RegionBibleCache] READ key:", cacheKey,
    "hit:", !!cached,
    cached ? "bible.id: " + cached.id : ""
  );
  return cached;
}

/**
 * Store a freshly-generated bible so the next move can use it instantly.
 *
 * Bug 2 diagnostic — log every write so cache poisoning (same key
 * landing on two different bibles) shows up in the logs immediately.
 */
export function cacheRegionalBible(
  sessionId: string,
  outlineId: string,
  bible:     RegionBible
): void {
  const cacheKey = k({ sessionId, outlineId });
  console.log(
    "[RegionBibleCache] WRITE key:", cacheKey,
    "bible.id:", bible.id,
    "bible.name:", bible.name
  );
  cache.set(cacheKey, bible);
}

/**
 * Clear every cache entry tied to a specific session — call this when the
 * player switches save slots so a fresh session never reads stale bibles
 * from a previous campaign. Pass undefined to wipe everything (e.g. on
 * logout).
 */
export function invalidateRegionalBibleCache(sessionId?: string): void {
  if (!sessionId) {
    cache.clear();
    inFlight.clear();
    return;
  }
  const prefix = `${sessionId}__`;
  // Snapshot into arrays before iterating — older TS targets can't iterate
  // Map keys directly without --downlevelIteration.
  const keysToDrop = Array.from(cache.keys()).filter((k) => k.startsWith(prefix));
  for (const key of keysToDrop) cache.delete(key);
  // V8.53 — inFlight is a Map now; iterate keys the same way.
  const inFlightToDrop = Array.from(inFlight.keys()).filter((k) => k.startsWith(prefix));
  for (const key of inFlightToDrop) inFlight.delete(key);
}

/**
 * Fuzzy outline matcher used by the WORLD_EXPLORE flow to decide whether
 * the player's destination matches a structural outline from the
 * WorldBible. Matching priorities:
 *   1. Exact id match (slug equality)
 *   2. Substring match against name (case-insensitive, both directions)
 *   3. Substring match against atmosphere_hint
 *
 * Returns the first matching outline, or null when nothing matches.
 */
export function matchRegionOutline(
  outlines: readonly RegionOutline[] | undefined,
  target:   string | undefined | null
): RegionOutline | null {
  if (!outlines || outlines.length === 0) return null;
  if (!target) return null;
  const t = target.trim().toLowerCase();
  if (!t) return null;

  // Pass 1 — exact id match.
  for (const o of outlines) {
    if (o.id.toLowerCase() === t) return o;
  }

  // Pass 2 — name substring (either direction so "darkwood" matches
  // "the darkwood thicket" and vice versa).
  for (const o of outlines) {
    const name = o.name.toLowerCase();
    if (!name) continue;
    if (name.includes(t) || t.includes(name)) return o;
  }

  // Pass 3 — atmosphere hint substring as a final loose fallback.
  for (const o of outlines) {
    const hint = (o.atmosphere_hint ?? "").toLowerCase();
    if (!hint) continue;
    // Only count the hint match if a meaningful chunk of the player's
    // input appears in it — otherwise common words like "the" will
    // collide with everything.
    if (t.length >= 4 && hint.includes(t)) return o;
  }

  return null;
}

/**
 * Fire-and-forget background pre-generation. Does nothing on cache hit
 * or when a fetch for the same outline is already in flight. Used when
 * the narrator surfaces a directional hint toward an undiscovered
 * region, AND fired in bulk by the new-game wizard for every adjacent
 * region right after apply-world-bible (V8.53) — by the time the player
 * finishes the opening narrative, the adjacent regions are warm.
 *
 * Errors are swallowed silently. The live WORLD_EXPLORE flow will retry
 * with a visible loading state if the cache is still empty when needed.
 *
 * V8.53 — the inner promise is stored in `inFlight` so a navigation
 * that arrives mid-pregen can await it via `awaitRegionalBible` instead
 * of spawning a duplicate fetch. Pre-V8.53 the pregen's result was
 * thrown away in that race (both fetches completed; navigation used
 * its own, pregen wrote to cache too late).
 */
export function pregenerateRegionalBible(args: {
  sessionId:           string;
  outline:             RegionOutline;
  originRegionName:    string;
  directionFromOrigin: string;
  genre:               Genre;
  wcd:                 WorldConsistencyDocument;
  existingRegionNames: string[];
}): void {
  const cacheKey = k({ sessionId: args.sessionId, outlineId: args.outline.id });
  if (cache.has(cacheKey) || inFlight.has(cacheKey)) return;

  const promise: Promise<RegionBible | null> = (async () => {
    try {
      const res = await fetch("/api/game/generate-regional-bible", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          session_id:            args.sessionId,
          outline:               args.outline,
          origin_region_name:    args.originRegionName,
          direction_from_origin: args.directionFromOrigin,
          genre:                 args.genre,
          wcd:                   args.wcd,
          existing_region_names: args.existingRegionNames,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json() as { bible?: RegionBible };
      if (data.bible) {
        // Bug 2 diagnostic — route through the public WRITE log so
        // pre-generated bibles appear in the same cache audit trail
        // as live writes.
        console.log(
          "[RegionBibleCache] WRITE key:", cacheKey,
          "bible.id:", data.bible.id,
          "bible.name:", data.bible.name,
          "(pregenerated)"
        );
        cache.set(cacheKey, data.bible);
        console.log(
          `[RegionBible/cache] Pre-generated: ${data.bible.name} (${args.outline.id})`
        );
        return data.bible;
      }
      return null;
    } catch {
      // Best-effort — the live fetch will surface any failure.
      return null;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, promise);
}

/**
 * V8.53 — async cache resolver with in-flight dedup.
 *
 *   1. Cache hit → return the bible immediately (no async wait).
 *   2. In-flight pregen → await that pre-existing promise. When it
 *      lands the bible is in cache. Resolves to the bible, or null if
 *      the pregen failed.
 *   3. Neither → return null. Caller falls through to its own live
 *      fetch with a visible loading state.
 *
 * This is the path useGameLoop's WORLD_EXPLORE branch should call.
 * The legacy synchronous `getCachedRegionalBible` stays exported for
 * any caller that strictly cannot await (none today).
 */
export async function awaitRegionalBible(
  sessionId: string,
  outlineId: string
): Promise<RegionBible | null> {
  const cacheKey = k({ sessionId, outlineId });

  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(
      "[RegionBibleCache] AWAIT key:", cacheKey,
      "cache-hit bible.id:", cached.id
    );
    return cached;
  }

  const pending = inFlight.get(cacheKey);
  if (pending) {
    console.log(
      "[RegionBibleCache] AWAIT key:", cacheKey,
      "inflight-dedup — awaiting existing pregen"
    );
    return await pending;
  }

  console.log(
    "[RegionBibleCache] AWAIT key:", cacheKey,
    "total-miss — caller should fire live fetch"
  );
  return null;
}
