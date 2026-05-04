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
  return {
    id:                  row.asset_id,
    category:            row.category as AssetCategory,
    name:                row.name,
    constitution:        row.constitution ?? {},
    significance:        (row.significance === "MAJOR" ? "MAJOR" : "NOTABLE"),
    first_seen_location: row.first_seen_location ?? "",
    session_id:          row.session_id,
    created_at:          row.created_at,
  };
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
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("world_assets") as any).upsert(
      {
        session_id:          sessionId,
        asset_id:            asset.id,
        category:            asset.category,
        name:                asset.name,
        constitution:        asset.constitution,
        significance:        asset.significance,
        first_seen_location: asset.first_seen_location,
      },
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
 * Upsert a codex entry. Codex rows are also write-once per (session, entry).
 * Logs errors, never throws.
 */
export async function saveCodexEntry(
  sessionId: string,
  entry: CodexEntry
): Promise<void> {
  try {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("codex") as any).upsert(
      {
        session_id:          sessionId,
        entry_id:            entry.id,
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
