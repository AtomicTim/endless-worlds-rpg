import type { MasterState } from "@/types/game";

// ── Intent Parser ─────────────────────────────────────────────────────────────

/**
 * System prompt for Pass 1 of the two-pass AI loop.
 * Instructs the model to classify raw player input into a structured action.
 */
export function buildIntentParserPrompt(masterState: MasterState): string {
  const { genre, tone } = masterState.metadata;
  const { strength, agility, charisma, intelligence, perception } =
    masterState.player_state.attributes;
  const { current_location_id } = masterState.world_state;

  return `You are an intent classification engine for a ${genre} RPG with a ${tone} tone.

Your only task: read the player's text input and return a JSON object describing their intent.

CRITICAL RULES:
- Respond with ONLY valid JSON. No markdown, no code fences, no explanation.
- Do not add any text before or after the JSON object.
- The JSON must exactly match the shape specified below.

Current game context:
- Genre: ${genre}
- Tone: ${tone}
- Location: ${current_location_id}
- Player attributes: STR ${strength}, AGI ${agility}, CHA ${charisma}, INT ${intelligence}, PER ${perception}

Action type definitions:
- MOVE      — player wants to travel, go somewhere, or navigate
- ATTACK    — player wants to fight, strike, or use violence
- INTERACT  — player wants to use, operate, or manipulate an object/person (non-violent)
- EXAMINE   — player wants to look at, inspect, or investigate something
- USE_ITEM  — player explicitly references using a specific item from inventory
- DIALOGUE  — player wants to talk to, ask, or communicate with an NPC
- CUSTOM    — anything that does not fit the categories above

Required JSON shape (return exactly this, filled in):
{
  "action_type": "MOVE|ATTACK|INTERACT|EXAMINE|USE_ITEM|DIALOGUE|CUSTOM",
  "primary_target": "string describing the main target, or null",
  "secondary_target": "string describing a secondary target, or null",
  "item_used": "name of item from inventory, or null",
  "inferred_intent": "one sentence describing what the player wants to do",
  "confidence": 0.0
}

Rules for field values:
- action_type must be exactly one of the seven values listed above
- primary_target, secondary_target, item_used must be null when not applicable
- inferred_intent must be a single sentence, present tense, player-centric
- confidence must be a number between 0.0 and 1.0
  - 0.8–1.0: unambiguous
  - 0.5–0.8: likely but could be interpreted differently
  - 0.3–0.5: ambiguous; classify as CUSTOM when very uncertain`;
}

/**
 * User-turn context block sent alongside the raw player input.
 * Summarises the current game state for the model.
 */
export function buildIntentParserContext(masterState: MasterState): string {
  const { genre } = masterState.metadata;
  const { name, background } = masterState.player_state;
  const { current_location_id, visited_locations } = masterState.world_state;

  const recentEntries = masterState.log_book.entries
    .slice(-3)
    .map((e) => `  [${e.type}] ${e.content}`)
    .join("\n");

  const lines = [
    `Character: ${name} (${background})`,
    `Genre: ${genre}`,
    `Location: ${current_location_id}`,
    `Locations visited: ${visited_locations.length}`,
  ];

  if (recentEntries) {
    lines.push(`Recent log:\n${recentEntries}`);
  }

  return lines.join("\n");
}
