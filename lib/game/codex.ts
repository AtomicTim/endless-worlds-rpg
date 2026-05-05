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
 * Strips a leading article ("the_", "a_", "an_") from a snake_case slug.
 * Used to canonicalize LOCATION ids so "The Wanderer's Rest" and
 * "Wanderer's Rest" produce the same asset id and current_location_id.
 */
function stripArticles(slug: string): string {
  return slug.replace(/^(the|a|an)_/, "");
}

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
 * Canonical, prefix-less location id used in world_state.current_location_id
 * and visited_locations. Lowercases, replaces non-alphanumeric runs with
 * underscores, and strips leading articles so the narrator's various
 * descriptions of the same place collapse to one slug.
 *
 *   normalizeLocationId("The Wanderer's Rest inn") → "wanderers_rest_inn"
 *   normalizeLocationId("heavy oak door")          → "heavy_oak_door"
 *   normalizeLocationId("fantasy_tavern_01")       → "fantasy_tavern_01"
 */
export function normalizeLocationId(name: string): string {
  return stripArticles(toSlug(name));
}

/**
 * Derives a canonical, deterministic asset ID from category + name so that the
 * same real-world entity always maps to the same DB row even when the Narrator
 * generates a slightly different slug across calls.
 *
 * For LOCATION assets, leading articles are stripped so "The X" and "X"
 * collapse to a single id.
 *
 * e.g. normalizeAssetId("CHARACTER", "Old Ezra")  → "character_old_ezra"
 *      normalizeAssetId("LOCATION",  "The Tavern") → "location_tavern"
 */
export function normalizeAssetId(category: string, name: string): string {
  let slug = toSlug(name);
  if (category === "LOCATION") {
    slug = stripArticles(slug);
  }
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
    if (asset.svg_content) row.svg_content = asset.svg_content;

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

/**
 * Update ONLY the svg_content of an existing world asset.
 * Uses .update() (not upsert) so it never overwrites the constitution.
 * Silently no-ops if the asset doesn't exist yet.
 */
export async function updateWorldAssetSvg(
  sessionId: string,
  assetId:   string,
  svgContent: string
): Promise<void> {
  try {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("world_assets") as any)
      .update({ svg_content: svgContent })
      .eq("session_id", sessionId)
      .eq("asset_id", assetId)
      .is("svg_content", null);   // only write when not already set
    if (error) {
      console.error("[updateWorldAssetSvg]", error);
    }
  } catch (err) {
    console.error("[updateWorldAssetSvg] unexpected", err);
  }
}

/**
 * Mark a CHARACTER asset's identity as revealed.
 * Updates both world_assets (name + name_known) and the matching codex entry
 * so the player-facing encyclopedia shows the true name immediately.
 * Called by the Day 15 NPC dialogue system when a character introduces
 * themselves by name.
 * Never throws — logs errors only.
 */
export async function updateAssetNameRevealed(
  sessionId: string,
  assetId:   string,
  trueName:  string
): Promise<void> {
  try {
    const supabase = createClient();

    // Update world_assets
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: assetErr } = await (supabase.from("world_assets") as any)
      .update({ name: trueName, name_known: true })
      .eq("session_id", sessionId)
      .eq("asset_id", assetId);
    if (assetErr) {
      console.error("[updateAssetNameRevealed] world_assets update failed:", assetErr);
    }

    // Update codex entry (entry_id == assetId since both are normalizeAssetId output)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: codexErr } = await (supabase.from("codex") as any)
      .update({ name: trueName })
      .eq("session_id", sessionId)
      .eq("entry_id", assetId);
    if (codexErr) {
      console.error("[updateAssetNameRevealed] codex update failed:", codexErr);
    }
  } catch (err) {
    console.error("[updateAssetNameRevealed] unexpected", err);
  }
}

/**
 * Upsert a codex entry. Codex rows are also write-once per (session, entry).
 * Logs errors, never throws.
 */
export async function saveCodexEntry(
  sessionId: string,
  entry: CodexEntry
): Promise<void> {
  try {
    const supabase = createClient();
    const entryId  = normalizeAssetId(entry.category, entry.name);
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
  } catch (err) {
    console.error("[saveCodexEntry] unexpected", err);
  }
}

// ── World Asset reads ─────────────────────────────────────────────────────────

/**
 * Fetches assets relevant to a given location: every asset first seen there,
 * plus every CHARACTER asset (characters move around the world, so they
 * remain relevant regardless of where they were first introduced).
 *
 * Returns [] on any error so the narrator call always proceeds.
 */
export async function getWorldAssetsForLocation(
  sessionId: string,
  locationId: string
): Promise<WorldAsset[]> {
  try {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("world_assets") as any)
      .select("*")
      .eq("session_id", sessionId)
      .or(`first_seen_location.eq.${locationId},category.eq.CHARACTER`);

    if (error) {
      console.error("[getWorldAssetsForLocation]", error);
      return [];
    }
    return (data as WorldAssetRow[] | null ?? []).map(rowToWorldAsset);
  } catch (err) {
    console.error("[getWorldAssetsForLocation] unexpected", err);
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
