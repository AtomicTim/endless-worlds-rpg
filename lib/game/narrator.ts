import type { MasterState, NarratorResponse, NPCMemory, ResolutionResult } from "@/types/game";

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

    return {
      narrative_text,
      ascii_art: typeof parsed.ascii_art === "string" ? parsed.ascii_art : undefined,
      sound_id:  typeof parsed.sound_id === "string"  ? parsed.sound_id  : undefined,
      new_npcs,
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
  state: MasterState
): Promise<NarratorResponse> {
  let response: Response;
  try {
    response = await fetch("/api/game/narrate", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ resolutionResult: result, masterState: state }),
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
