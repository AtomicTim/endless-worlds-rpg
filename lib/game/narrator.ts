import type { Item, MasterState, NarratorResponse, NPCMemory, ResolutionResult } from "@/types/game";
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

    return {
      narrative_text,
      ascii_art: typeof parsed.ascii_art === "string" ? parsed.ascii_art : undefined,
      sound_id:  typeof parsed.sound_id === "string"  ? parsed.sound_id  : undefined,
      new_npcs,
      items_acquired,
    };
  } catch {
    return {
      narrative_text: rawText.trim().slice(0, 1000) || "...",
      new_npcs: [],
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
  lastNarrativeText?: string | null
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
