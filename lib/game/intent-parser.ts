import { ActionType } from "@/types/game";
import type { MasterState, ParsedAction } from "@/types/game";

// ── Error type ────────────────────────────────────────────────────────────────

export class IntentParserError extends Error {
  constructor(
    message: string,
    public readonly code: "VALIDATION" | "API" | "PARSE"
  ) {
    super(message);
    this.name = "IntentParserError";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFallback(input: string): ParsedAction {
  return {
    action_type:     ActionType.CUSTOM,
    inferred_intent: input.slice(0, 200),
    confidence:      0.5,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Sends the player's raw text to the intent-parser API route and returns a
 * typed ParsedAction.
 *
 * Throws IntentParserError for validation failures (empty / too long input).
 * Returns a CUSTOM fallback action on API or network errors so the game loop
 * can continue gracefully.
 */
export async function parseIntent(
  input: string,
  masterState: MasterState
): Promise<ParsedAction> {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new IntentParserError("Input cannot be empty.", "VALIDATION");
  }
  if (trimmed.length > 500) {
    throw new IntentParserError(
      "Input must be 500 characters or fewer.",
      "VALIDATION"
    );
  }

  try {
    const response = await fetch("/api/game/parse-intent", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ input: trimmed, masterState }),
    });

    if (!response.ok) {
      return makeFallback(trimmed);
    }

    return (await response.json()) as ParsedAction;
  } catch {
    return makeFallback(trimmed);
  }
}
