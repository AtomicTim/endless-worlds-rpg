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
/**
 * If the input is wrapped in matching quote characters (straight or curly,
 * single or double), strip them and flag the call as dialogueMode. The API
 * route short-circuits dialogueMode to a DIALOGUE action without an AI call.
 */
function detectDialogue(input: string): { stripped: string; dialogueMode: boolean } {
  const t = input.trim();
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ["“", "”"],
    ["‘", "’"],
  ];
  for (const [open, close] of pairs) {
    if (t.startsWith(open) && t.endsWith(close) && t.length >= open.length + close.length + 1) {
      return { stripped: t.slice(open.length, t.length - close.length).trim(), dialogueMode: true };
    }
  }
  return { stripped: t, dialogueMode: false };
}

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

  const { stripped, dialogueMode } = detectDialogue(trimmed);

  try {
    const response = await fetch("/api/game/parse-intent", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        input: stripped,
        masterState,
        ...(dialogueMode ? { dialogueMode: true } : {}),
      }),
    });

    if (!response.ok) {
      return makeFallback(stripped);
    }

    const parsed = (await response.json()) as ParsedAction;

    // Backstop: every DIALOGUE action must carry a tone. The server-side
    // route SHOULD always set one (AI classification or fast-path heuristic),
    // but if it doesn't (model returned an unknown tone, JSON malformed,
    // legacy cache) default to 'neutral' so the resolver doesn't fall back
    // to keyword text matching.
    if (parsed.action_type === ActionType.DIALOGUE && !parsed.dialogue_tone) {
      parsed.dialogue_tone = "neutral";
    }

    return parsed;
  } catch {
    return makeFallback(stripped);
  }
}
