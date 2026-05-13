import { createClient } from "@/lib/supabase/client";
import {
  AssetCategory,
  type CodexEntry,
  type WorldAsset,
  type WorldAssetConstitution,
} from "@/types/game";

// ── Row shapes (what comes back from Supabase) ────────────────────────────────
//
// We use loose `any` casts at the boundary because the auto-generated Database
// types in /types/database.ts don't (yet) know about the world_assets / codex
// tables. The narrow row interfaces below give us type safety inside this file.

interface WorldAssetRow {
  id:                  string;
  session_id:          string;
  asset_id:            string;
  category:            string;
  name:                string;
  constitution:        WorldAssetConstitution;
  significance:        string;
  first_seen_location: string | null;
  svg_content:         string | null;
  name_known:          boolean | null;
  created_at:          string;
  updated_at:          string;
}

interface CodexRow {
  id:                  string;
  session_id:          string;
  entry_id:            string;
  category:            string;
  name:                string;
  description:         string;
  first_seen_location: string | null;
  significance:        string;
  created_at:          string;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function rowToWorldAsset(row: WorldAssetRow): WorldAsset {
  // name_known defaults: false for CHARACTER (identity may be unknown),
  // true for everything else (locations, factions etc. are always "known").
  const defaultNameKnown = row.category !== "CHARACTER";
  return {
    id:                  row.asset_id,
    category:            row.category as AssetCategory,
    name:                row.name,
    constitution:        row.constitution ?? {},
    significance:        (row.significance === "MAJOR" ? "MAJOR" : "NOTABLE"),
    first_seen_location: row.first_seen_location ?? "",
    session_id:          row.session_id,
    created_at:          row.created_at,
    name_known:          row.name_known ?? defaultNameKnown,
    ...(row.svg_content ? { svg_content: row.svg_content } : {}),
  };
}

// ── Placeholder detection ─────────────────────────────────────────────────────

/**
 * Common descriptor words that appear in placeholder NPC names.
 * A CHARACTER name is a placeholder when it contains at least one of these.
 * Real proper names (e.g. "Kira Vale", "Old Ezra") either lack these entirely
 * or mix them with a surname — the heuristic is intentionally conservative:
 * it is better to show a "?" on a real name than to hide a "?" on a placeholder.
 */
const PLACEHOLDER_WORDS = new Set([
  // Roles / professions
  "figure", "man", "woman", "person", "stranger", "guard", "merchant",
  "shopkeeper", "ferryman", "innkeeper", "bartender", "soldier", "officer",
  "captain", "sergeant", "lieutenant", "doctor", "nurse", "engineer", "pilot",
  "technician", "vendor", "trader", "dealer", "broker", "runner", "keeper",
  "warden", "jailer", "herald", "courier", "scavenger", "raider", "cultist",
  "priest", "monk", "acolyte", "assassin", "thief", "beggar", "vagrant",
  "exile", "nomad", "wanderer",
  // Descriptors — physical
  "hooded", "masked", "scarred", "cloaked", "armored", "robed", "tattooed",
  "chrome", "eyed", "armed", "pale", "dark", "blind", "mute", "limping",
  "bearded", "shaven", "bald", "hunched", "towering", "gaunt", "heavyset",
  "one-armed", "one", "two", "three", "four", "old", "young", "elderly",
  "ancient", "grizzled", "weathered", "mysterious", "unknown", "nameless",
  "faceless", "tall", "short", "injured", "crippled",
  // Descriptors — background / origin
  "ashen", "village", "survivor", "local", "foreign", "exiled", "lone",
  "wandering", "nervous", "silent", "wasteland", "ruined", "forgotten",
  "lost", "fleeing", "passing",
]);

/**
 * Returns true when `name` looks like a descriptive NPC placeholder rather
 * than a proper character name. Used to avoid showing the "Identity Unknown"
 * badge on entries where the narrator gave us a real name directly.
 *
 * A name is treated as a placeholder when MORE THAN ONE of its words appear
 * in PLACEHOLDER_WORDS — compound descriptors like "Ashen Village Survivor"
 * (3 hits) are unambiguously not proper names. Single-word matches are
 * intentionally excluded to avoid false positives on names like "Old Ezra"
 * where only "old" matches but "Ezra" is a real given name.
 */
export function looksLikePlaceholder(name: string): boolean {
  const words  = name.toLowerCase().replace(/[^a-z\s-]/g, "").split(/[\s-]+/);
  const hits   = words.filter((w) => PLACEHOLDER_WORDS.has(w));
  return hits.length > 1;
}

// ── ID normalisation ──────────────────────────────────────────────────────────

/**
 * Lowercases, drops punctuation, collapses whitespace and underscore runs.
 * Underscores in the input are PRESERVED (so snake_case ids pass through
 * unchanged) — only true punctuation is stripped.
 */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")  // strip punctuation but keep underscores
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");          // collapse runs of underscores
}

/**
 * Canonical location id used in world_state.current_location_id and
 * visited_locations. Lowercases, replaces non-alphanumeric runs with
 * underscores. Article prefixes (the_, a_, an_) are PRESERVED — the
 * WorldBible's emitted id is the canonical form, so "The Lowered Gaze"
 * stays as "the_lowered_gaze" all the way through.
 *
 * Audit Issue A fix: stripArticles removed. Two ID schemes used to coexist
 * (raw with article vs stripped) and corrupted asset/graph lookups
 * whenever the resolver normalized player input back into state.
 */
export function normalizeLocationId(name: string): string {
  return toSlug(name);
}

/**
 * Derives a canonical, deterministic asset ID from category + name so that the
 * same real-world entity always maps to the same DB row even when the Narrator
 * generates a slightly different slug across calls.
 *
 * Audit Issue A fix: LOCATION no longer strips leading articles. The
 * WorldBible's settlement node id and apply-world-bible's asset id stay
 * aligned with `location_<raw_slug>` end to end.
 *
 * e.g. normalizeAssetId("CHARACTER", "Old Ezra")  → "character_old_ezra"
 *      normalizeAssetId("LOCATION",  "The Tavern") → "location_the_tavern"
 */
export function normalizeAssetId(category: string, name: string): string {
  const slug = toSlug(name);
  const prefix = (
    {
      CHARACTER: "character",
      LOCATION:  "location",
      FACTION:   "faction",
      BESTIARY:  "creature",
      ITEM:      "item",
      LORE:      "lore",
    } as Record<string, string>
  )[category] ?? "asset";
  return `${prefix}_${slug}`;
}

function rowToCodexEntry(row: CodexRow): CodexEntry {
  const cat = (row.category ?? "LORE") as CodexEntry["category"];
  const sig = (row.significance ?? "NOTABLE") as CodexEntry["significance"];
  return {
    id:                  row.entry_id,
    category:            cat,
    name:                row.name,
    description:         row.description,
    first_seen_location: row.first_seen_location ?? "",
    significance:        sig,
  };
}

// ── World Asset persistence ───────────────────────────────────────────────────

/**
 * Upsert a world asset for the given session. Constitutions are write-once —
 * the first introduction is law, so `ignoreDuplicates` is set so subsequent
 * insert attempts on the same (session_id, asset_id) are silently dropped.
 *
 * Errors are logged but never thrown — never crash the game loop on a save.
 */
export async function saveWorldAsset(
  sessionId: string,
  asset: WorldAsset
): Promise<void> {
  try {
    const supabase  = createClient();
    const assetId   = normalizeAssetId(asset.category, asset.name);
    // CHARACTER assets default name_known=false (identity may be a placeholder).
    // All other categories are always known by name.
    let nameKnown =
      asset.name_known !== undefined
        ? asset.name_known
        : asset.category !== AssetCategory.CHARACTER;

    // Auto-promote: if a CHARACTER was assigned name_known=false but the name
    // doesn't look like a descriptive placeholder (e.g. the narrator output a
    // real name directly), treat it as already-revealed so the UI never shows
    // a spurious "?" badge on a proper name.
    if (!nameKnown && asset.category === AssetCategory.CHARACTER && !looksLikePlaceholder(asset.name)) {
      nameKnown = true;
    }

    const row: Record<string, unknown> = {
      session_id:          sessionId,
      asset_id:            assetId,
      category:            asset.category,
      name:                asset.name,
      constitution:        asset.constitution,
      significance:        asset.significance,
      first_seen_location: asset.first_seen_location,
      name_known:          nameKnown,
    };
    // svg_content writes removed — art generation system is gone. The
    // column remains in the schema for backward compatibility but is no
    // longer populated.

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("world_assets") as any).upsert(
      row,
      { onConflict: "session_id,asset_id", ignoreDuplicates: true }
    );
    if (error) {
      console.error("[saveWorldAsset]", error);
    }
  } catch (err) {
    console.error("[saveWorldAsset] unexpected", err);
  }
}

// Day 19E: updateAssetNameRevealed removed — every NPC has a real name
// from generation. Display names are written once and never change.

/**
 * V8.65 — in-memory dedup set, keyed by `sessionId:entryId`. Marked
 * SYNCHRONOUSLY at the top of saveCodexEntry so two concurrent calls
 * for the same entry can't both pass the async pre-check and return
 * `created: true`. The set is module-scoped and clears on page reload,
 * which is correct — fresh page → fresh `created` reporting (the DB
 * pre-check then catches duplicate writes against the persisted row).
 *
 * Symptom this guards: "✦ Vessa Thornquist added to codex" appearing
 * TWICE in the story feed after one DIALOGUE action — step 7b (narrator
 * codex_entries) and step 7g (NPC interaction) both fire saveCodexEntry
 * concurrently; pre-V8.65 both races saw `alreadyExists = false`
 * because neither upsert had committed yet, so both returned
 * `{ created: true }` and both callsites emitted the beat.
 */
const codexCreatedThisSession = new Set<string>();

/**
 * Upsert a codex entry. Codex rows are also write-once per (session, entry).
 * Logs errors, never throws.
 *
 * FIX 6 — returns `{ created }` so callers can suppress duplicate
 * "✦ X added to codex" notifications. ignoreDuplicates makes the DB
 * write a no-op on conflict; we detect that by pre-checking whether
 * the row exists. Falls back to `created: true` (the safe default
 * that surfaces the notification) on any unexpected error.
 *
 * V8.65 — synchronous in-memory dedup prevents two concurrent calls
 * for the same entry from both reporting `created: true`. The first
 * caller wins; the second sees `created: false` immediately and skips
 * the beat. The DB upsert still runs in both paths so a flaky network
 * on the first call doesn't lose the persisted row.
 */
export async function saveCodexEntry(
  sessionId: string,
  entry: CodexEntry
): Promise<{ created: boolean }> {
  const entryId  = normalizeAssetId(entry.category, entry.name);
  const cacheKey = `${sessionId}:${entryId}`;

  // V8.65 race guard. Synchronous: a concurrent second caller hitting
  // this check before the async pre-check resolves sees the cached
  // entry and bails out of the "created" path. Still issues the upsert
  // below so the data write doesn't depend on the first caller's
  // network luck.
  const alreadyClaimedThisSession = codexCreatedThisSession.has(cacheKey);
  if (!alreadyClaimedThisSession) {
    codexCreatedThisSession.add(cacheKey);
  }

  try {
    const supabase = createClient();

    // Pre-check existence so we can tell the caller whether this is
    // genuinely new IN THE DB. The synchronous cache above handles the
    // race; the DB pre-check handles the page-reload case where the
    // entry already persisted from a previous session.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from("codex") as any)
      .select("entry_id")
      .eq("session_id", sessionId)
      .eq("entry_id", entryId)
      .maybeSingle() as { data: { entry_id: string } | null };
    const alreadyExistsInDb = !!existing;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("codex") as any).upsert(
      {
        session_id:          sessionId,
        entry_id:            entryId,
        category:            entry.category,
        name:                entry.name,
        description:         entry.description,
        first_seen_location: entry.first_seen_location,
        significance:        entry.significance,
      },
      { onConflict: "session_id,entry_id", ignoreDuplicates: true }
    );
    if (error) {
      console.error("[saveCodexEntry]", error);
    }
    // created: true iff (a) the DB row didn't already exist AND (b) this
    // is the first call for this entry in the current page session.
    // The cache catches the race; the DB check catches reload + revisit.
    return { created: !alreadyExistsInDb && !alreadyClaimedThisSession };
  } catch (err) {
    console.error("[saveCodexEntry] unexpected", err);
    // Defensive fallback: emit the beat only if no prior call claimed
    // this entry. Without this guard, an error mid-dedup could still
    // double-fire because the synchronous cache marked the entry but
    // the catch path used to ignore it.
    return { created: !alreadyClaimedThisSession };
  }
}

/**
 * Day 20 Combat — write a bestiary codex entry on first encounter
 * (combat-spec §6 + Prompt 3 spec).
 *
 * One entry per enemy.id (NOT per spawn instance). The description
 * field carries the formatted block the Codex Bestiary tab renders:
 *   <enemy.description>
 *   HP: <min>-<max> · DMG: <die> · First seen: <location_name>
 *
 * saveCodexEntry returns { created } from its idempotency
 * pre-check, so repeat encounters with the same enemy.id resolve
 * to created=false and the caller can suppress the "added to
 * codex" toast.
 */
export async function writeBestiaryEntry(
  sessionId: string,
  enemy: {
    id:           string;
    name:         string;
    description:  string;
    hp_range:     [number, number];
    damage_die:   string;
  },
  firstSeenLocationId: string,
  firstSeenLocationName: string
): Promise<{ created: boolean }> {
  const description =
    `${enemy.description}\n\n` +
    `HP: ${enemy.hp_range[0]}-${enemy.hp_range[1]}\n` +
    `Damage: ${enemy.damage_die}\n` +
    `First seen: ${firstSeenLocationName}`;

  return saveCodexEntry(sessionId, {
    id:                  `bestiary_${enemy.id}`,
    category:            "BESTIARY",
    name:                enemy.name,
    description,
    first_seen_location: firstSeenLocationId,
    significance:        "NOTABLE",
  });
}

// ── World Asset reads ─────────────────────────────────────────────────────────

/**
 * Fetches assets relevant to a given location: every asset first seen there,
 * plus every CHARACTER asset (characters move around the world, so they
 * remain relevant regardless of where they were first introduced).
 *
 * Robust against historical inconsistency in first_seen_location formatting:
 * older saves may have stored it as a raw narrative string ("The Wanderer's
 * Rest inn") while newer ones use the canonical slug ("wanderers_rest_inn").
 * We fetch every asset for the session, then filter on the client by either
 * exact match OR normalizeLocationId(first_seen_location) === locationId.
 *
 * Returns [] on any error so the narrator call always proceeds.
 */
export async function getWorldAssetsForLocation(
  sessionId: string,
  locationId: string,
  /** FIX 1 — optional parent region zone id. When the player is at a
   *  settlement hub or sub-location the region zone asset
   *  (first_seen_location = regionId) is normally filtered out.
   *  Passing the root zone id here widens the filter so the region
   *  zone asset lands in locationAssets and the Region map panel can
   *  show its atmosphere prose. */
  parentRegionId?: string
): Promise<WorldAsset[]> {
  console.log("[getWorldAssetsForLocation] querying for:", sessionId, locationId);
  try {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("world_assets") as any)
      .select("*")
      .eq("session_id", sessionId);

    if (error) {
      console.error("[getWorldAssetsForLocation]", error);
      return [];
    }
    const rows = (data as WorldAssetRow[] | null) ?? [];

    // Audit Issue A fix: build a fallback id set for backward compat
    // with old saves that wrote stripped (no-article) ids. The new
    // canonical form preserves articles, but pre-existing rows may use
    // either. Match on raw, plus the article-flipped variant.
    const altLocationId = locationId.startsWith("the_")
      ? locationId.slice(4)            // "the_lowered_gaze" → "lowered_gaze"
      : `the_${locationId}`;           // "lowered_gaze"     → "the_lowered_gaze"

    // FIX 1 — alt form of the parent region id (article stripping parity).
    const altParentRegionId = parentRegionId
      ? (parentRegionId.startsWith("the_")
          ? parentRegionId.slice(4)
          : `the_${parentRegionId}`)
      : undefined;

    // Audit Issue U fix: CHARACTER pass-through is scoped to the same
    // session_id (every row already shares the session id thanks to the
    // outer .eq, but we keep the predicate explicit for clarity).
    return rows
      .filter((r) => {
        if (r.category === "CHARACTER") return r.session_id === sessionId;
        if (!r.first_seen_location)     return false;
        if (r.first_seen_location === locationId)    return true;
        if (r.first_seen_location === altLocationId) return true;
        // FIX 1 — also include assets whose first_seen_location is the
        // parent region zone id (e.g. "the_rustveil_commons"). This pulls
        // the geographic region zone's location asset into locationAssets
        // even when the player is at a settlement hub or sub-location,
        // so WorldMap's Region tier panel can display the region prose.
        if (parentRegionId    && r.first_seen_location === parentRegionId)    return true;
        if (altParentRegionId && r.first_seen_location === altParentRegionId) return true;
        const normalized = normalizeLocationId(r.first_seen_location);
        return normalized === locationId || normalized === altLocationId;
      })
      .map(rowToWorldAsset);
  } catch (err) {
    console.error("[getWorldAssetsForLocation] unexpected", err);
    return [];
  }
}

/**
 * Day 19+ — fallback fetch that returns every world_asset for a session
 * with no location filtering. Used by the game page when the
 * location-filtered query returns empty so the player never lands in
 * a session with zero assets just because location ids didn't line up.
 *
 * Returns [] on any error so the caller can degrade gracefully.
 */
export async function getAllWorldAssets(
  sessionId: string
): Promise<WorldAsset[]> {
  try {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("world_assets") as any)
      .select("*")
      .eq("session_id", sessionId);
    if (error) {
      console.error("[getAllWorldAssets]", error);
      return [];
    }
    return (data as WorldAssetRow[] | null ?? []).map(rowToWorldAsset);
  } catch (err) {
    console.error("[getAllWorldAssets] unexpected", err);
    return [];
  }
}

export async function getWorldAssetsByCategory(
  sessionId: string,
  category: AssetCategory
): Promise<WorldAsset[]> {
  try {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("world_assets") as any)
      .select("*")
      .eq("session_id", sessionId)
      .eq("category", category)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getWorldAssetsByCategory]", error);
      return [];
    }
    return (data as WorldAssetRow[] | null ?? []).map(rowToWorldAsset);
  } catch (err) {
    console.error("[getWorldAssetsByCategory] unexpected", err);
    return [];
  }
}

// ── Codex reads ───────────────────────────────────────────────────────────────

export async function getCodexByCategory(
  sessionId: string,
  category: CodexEntry["category"]
): Promise<CodexEntry[]> {
  try {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("codex") as any)
      .select("*")
      .eq("session_id", sessionId)
      .eq("category", category)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getCodexByCategory]", error);
      return [];
    }
    return (data as CodexRow[] | null ?? []).map(rowToCodexEntry);
  } catch (err) {
    console.error("[getCodexByCategory] unexpected", err);
    return [];
  }
}

export async function getAllCodex(sessionId: string): Promise<CodexEntry[]> {
  try {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("codex") as any)
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getAllCodex]", error);
      return [];
    }
    return (data as CodexRow[] | null ?? []).map(rowToCodexEntry);
  } catch (err) {
    console.error("[getAllCodex] unexpected", err);
    return [];
  }
}
