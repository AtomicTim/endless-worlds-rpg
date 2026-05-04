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

// ── ID normalisation ──────────────────────────────────────────────────────────

/**
 * Derives a canonical, deterministic asset ID from category + name so that the
 * same real-world entity always maps to the same DB row even when the Narrator
 * generates a slightly different slug across calls.
 *
 * e.g. normalizeAssetId("CHARACTER", "Old Ezra") → "character_old_ezra"
 */
export function normalizeAssetId(category: string, name: string): string {
  const slug   = name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "_");
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
    const nameKnown =
      asset.name_known !== undefined
        ? asset.name_known
        : asset.category !== AssetCategory.CHARACTER;

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
