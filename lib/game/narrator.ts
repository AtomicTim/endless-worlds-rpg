import type {
  CodexEntry,
  Item,
  MasterState,
  NarratorResponse,
  NPCMemory,
  ParsedAction,
  PointOfInterest,
  ResolutionResult,
  WorldAsset,
} from "@/types/game";
import { ItemType, ItemRarity } from "@/types/game";

// ── Error type ────────────────────────────────────────────────────────────────

export class NarratorError extends Error {
  constructor(
    message: string,
    public readonly code: "AUTH" | "VALIDATION" | "API" | "NETWORK"
  ) {
    super(message);
    this.name = "NarratorError";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripJsonFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

/**
 * Convert the narrator's simplified effect string ("heal_20", "buff_strength_2",
 * "sanity_10") to the Record shape the Item interface expects.
 */
function parseEffectString(raw: string): Record<string, number | string> | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const result: Record<string, number | string> = {};
  for (const part of trimmed.split("|").map((s) => s.trim()).filter(Boolean)) {
    // heal_20, sanity_10 → { heal: 20 }, { sanity: 10 }
    const simple = part.match(/^(heal|sanity)_(-?\d+)$/);
    if (simple) {
      result[simple[1]] = parseInt(simple[2], 10);
      continue;
    }
    // buff_strength_2 → { buff_strength_2: 1 }
    const buff = part.match(/^buff_[a-z_]+_\d+$/);
    if (buff) {
      result[part] = 1;
      continue;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeNarratorItem(raw: unknown): Item | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const id   = typeof o.id   === "string" ? o.id   : `item_${Date.now()}`;
  const name = typeof o.name === "string" ? o.name : null;
  if (!name) return null;

  const typeRaw   = typeof o.type   === "string" ? o.type.toUpperCase()   : "";
  const rarityRaw = typeof o.rarity === "string" ? o.rarity.toUpperCase() : "";

  const type   = Object.values(ItemType).includes(typeRaw as ItemType)     ? (typeRaw as ItemType)     : ItemType.LORE;
  const rarity = Object.values(ItemRarity).includes(rarityRaw as ItemRarity) ? (rarityRaw as ItemRarity) : ItemRarity.COMMON;

  const effect = parseEffectString(typeof o.effect === "string" ? o.effect : "");

  return {
    id,
    name,
    type,
    rarity,
    description: typeof o.description === "string" ? o.description : "",
    ...(effect ? { effect } : {}),
    quantity:  typeof o.quantity  === "number" ? o.quantity  : 1,
    stackable: typeof o.stackable === "boolean" ? o.stackable : type === ItemType.CONSUMABLE,
    weight:    typeof o.weight    === "number"  ? o.weight    : 1,
  };
}

const POI_TYPES = new Set(["LOCATION", "NPC", "CONTAINER", "ITEM", "HAZARD"]);
const CODEX_CATEGORIES = new Set(["LOCATION", "CHARACTER", "FACTION", "ITEM", "LORE", "BESTIARY"]);
const CODEX_SIGNIFICANCE = new Set(["MINOR", "NOTABLE", "MAJOR"]);

function normalizePOI(raw: unknown): PointOfInterest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.label !== "string" || !o.label.trim()) return null;
  const t = typeof o.type === "string" ? o.type.toUpperCase() : "";
  if (!POI_TYPES.has(t)) return null;
  return {
    label:       o.label,
    type:        t as PointOfInterest["type"],
    description: typeof o.description === "string" ? o.description : "",
  };
}

function normalizeCodex(raw: unknown): CodexEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.name !== "string" || !o.name.trim()) return null;
  const cat = typeof o.category === "string" ? o.category.toUpperCase() : "";
  if (!CODEX_CATEGORIES.has(cat)) return null;
  const sig = typeof o.significance === "string" ? o.significance.toUpperCase() : "NOTABLE";
  if (!CODEX_SIGNIFICANCE.has(sig)) return null;
  return {
    id:                  typeof o.id === "string" && o.id.trim() ? o.id : `codex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    category:            cat as CodexEntry["category"],
    name:                o.name,
    description:         typeof o.description === "string" ? o.description : "",
    first_seen_location: typeof o.first_seen_location === "string" ? o.first_seen_location : "",
    significance:        sig as CodexEntry["significance"],
  };
}

function isNPCMemory(v: unknown): v is NPCMemory {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.npc_key === "string" &&
    typeof o.name === "string" &&
    typeof o.role === "string" &&
    typeof o.relationship_status === "string" &&
    typeof o.trust_score === "number" &&
    Array.isArray(o.memory_snippets)
  );
}

/**
 * Parse the assembled streamed text into a NarratorResponse. If the body is
 * not valid JSON, fall back to wrapping the raw text in narrative_text so the
 * game loop never breaks on a single malformed AI response.
 */
export function parseNarratorResponse(rawText: string): NarratorResponse {
  const cleaned = stripJsonFences(rawText);

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    const narrative_text =
      typeof parsed.narrative_text === "string" && parsed.narrative_text.length > 0
        ? parsed.narrative_text
        : rawText.slice(0, 1000);

    const new_npcs = Array.isArray(parsed.new_npcs)
      ? parsed.new_npcs.filter(isNPCMemory)
      : [];

    const items_acquired = Array.isArray(parsed.items_acquired)
      ? (parsed.items_acquired.map(normalizeNarratorItem).filter(Boolean) as Item[])
      : [];

    const points_of_interest = Array.isArray(parsed.points_of_interest)
      ? (parsed.points_of_interest.map(normalizePOI).filter(Boolean) as PointOfInterest[])
      : [];

    const codex_entries = Array.isArray(parsed.codex_entries)
      ? (parsed.codex_entries.map(normalizeCodex).filter(Boolean) as CodexEntry[])
      : [];

    const revealed_npc_names = Array.isArray(parsed.revealed_npc_names)
      ? (parsed.revealed_npc_names as unknown[]).reduce<Array<{ asset_id: string; true_name: string }>>(
          (acc, entry) => {
            if (
              entry &&
              typeof entry === "object" &&
              typeof (entry as Record<string, unknown>).asset_id  === "string" &&
              typeof (entry as Record<string, unknown>).true_name === "string"
            ) {
              acc.push({
                asset_id:  (entry as Record<string, unknown>).asset_id  as string,
                true_name: (entry as Record<string, unknown>).true_name as string,
              });
            }
            return acc;
          },
          []
        )
      : [];

    const tierRaw = parsed.response_tier;
    const response_tier: 1 | 2 | 3 =
      tierRaw === 1 || tierRaw === 2 || tierRaw === 3 ? tierRaw : 2;

    return {
      response_tier,
      narrative_text,
      ascii_art:           null,
      sound_id:            typeof parsed.sound_id === "string" ? parsed.sound_id : null,
      new_npcs,
      items_acquired,
      points_of_interest,
      codex_entries,
      ...(revealed_npc_names.length > 0 ? { revealed_npc_names } : {}),
    };
  } catch {
    return {
      response_tier:      2,
      narrative_text:     rawText.trim().slice(0, 1000) || "...",
      new_npcs:           [],
      points_of_interest: [],
      codex_entries:      [],
    };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Calls /api/game/narrate, consumes the streamed response, and returns a
 * fully-parsed NarratorResponse.
 *
 * Throws NarratorError for auth (401) and network failures. JSON-parse
 * failures degrade gracefully via parseNarratorResponse's fallback.
 */
export async function narrateAction(
  result: ResolutionResult,
  state: MasterState,
  lastNarrativeText?: string | null,
  action?: ParsedAction | null,
  locationAssets?: WorldAsset[] | null
): Promise<NarratorResponse> {
  let response: Response;
  try {
    response = await fetch("/api/game/narrate", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        resolutionResult: result,
        masterState:      state,
        ...(lastNarrativeText ? { lastNarrativeText } : {}),
        ...(action ? { action } : {}),
        ...(locationAssets && locationAssets.length > 0 ? { locationAssets } : {}),
      }),
    });
  } catch (err) {
    throw new NarratorError(
      err instanceof Error ? err.message : "Network error",
      "NETWORK"
    );
  }

  if (response.status === 401) {
    throw new NarratorError("Unauthorized", "AUTH");
  }
  if (!response.ok) {
    throw new NarratorError(`Narrator request failed (${response.status})`, "API");
  }
  if (!response.body) {
    throw new NarratorError("No response body from narrator", "API");
  }

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
    buffer += decoder.decode(); // flush any pending bytes
  } catch (err) {
    throw new NarratorError(
      err instanceof Error ? err.message : "Stream read failed",
      "NETWORK"
    );
  }

  return parseNarratorResponse(buffer);
}
