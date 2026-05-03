import { Genre } from "@/types/game";
import type { MasterState, ResolutionResult } from "@/types/game";
import { getEquippedLoadout } from "@/lib/game/state-utils";

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

// ── Narrator (Pass 2) ─────────────────────────────────────────────────────────

/**
 * Canonical sound IDs the Narrator may emit. The audio engine maps these to
 * actual files; the Narrator must pick from this list (or null).
 */
export const SOUND_IDS = [
  "tavern_ambient",
  "forest_ambient",
  "dungeon_ambient",
  "city_ambient",
  "combat_tense",
  "discovery_sting",
  "horror_drone",
  "space_ambient",
  "wasteland_wind",
] as const;

export type SoundId = (typeof SOUND_IDS)[number];

const NARRATOR_PERSONALITIES: Record<Genre, string> = {
  [Genre.FANTASY]:
    "You are a master storyteller in the tradition of epic fantasy. Write in vivid, immersive prose. Use archaic but accessible language. Describe the world with sensory detail — what the character sees, smells, hears. Make every action feel consequential.",

  [Genre.CYBERPUNK]:
    "You are a terse, street-smart narrator in a neon-soaked dystopia. Short punchy sentences. Corporate jargon mixed with street slang. The city is always watching. Keep it cool, keep it dark.",

  [Genre.HORROR_LOVECRAFTIAN]:
    "You are an unreliable narrator descending into cosmic dread. Build slow dread. Question what is real. Use clinical detachment that breaks into horror. Never explain the inexplicable. The universe is indifferent and vast.",

  [Genre.SPACE_OPERA]:
    "You are the narrator of a grand space opera. Epic scale, operatic emotion, pulpy excitement. Planets, empires, ancient evils. Make the cosmos feel alive and dangerous.",

  [Genre.POST_APOCALYPTIC]:
    "You are a dry, world-weary narrator in a world that ended. Dark humor is your armor. Be terse. The wasteland doesn't care about your feelings. But sometimes, rarely, something beautiful survives.",
};

export function getNarratorPersonality(genre: Genre): string {
  return NARRATOR_PERSONALITIES[genre];
}

/**
 * System prompt for Pass 2 of the two-pass AI loop.
 * Sets genre tone, locks the JSON schema, and forbids contradicting the
 * resolver's success/failure outcome.
 */
export function buildNarratorSystemPrompt(state: MasterState): string {
  const { genre, tone } = state.metadata;
  const personality = getNarratorPersonality(genre);
  const soundList = SOUND_IDS.join(" | ");

  return `${personality}

CRITICAL RULES:
- Respond with ONLY valid JSON. No markdown, no code fences, no preamble or trailing text.
- The JSON must conform exactly to the schema below.
- narrative_text must be 80–200 words of immersive story prose.
- Reference the player's character name and background naturally.
- Reference recent log entries to maintain continuity, but do not summarise them.
- NEVER contradict the success/failure outcome from the resolution result.
- Do not invent stats, damage numbers, or mechanical results — those are already decided.

GENRE: ${genre}
TONE: ${tone}

NARRATOR_RESPONSE JSON SCHEMA (return exactly this shape, filled in):
{
  "narrative_text": "string — 80–200 words of story prose for this beat",
  "ascii_art": "string or null — an 8-line by 40-char ASCII scene; only set on MOVE actions",
  "sound_id": "string or null — one of: ${soundList}",
  "new_npcs": []
}

new_npcs is an array of NPCMemory objects for any newly-introduced named characters in this beat. Each entry MUST match this shape:
{
  "id": "uuid-shaped string",
  "npc_key": "snake_case identifier",
  "name": "display name",
  "role": "short role descriptor (e.g. 'merchant', 'guard', 'cultist')",
  "relationship_status": "one of: neutral | friendly | hostile | wary | reverent",
  "trust_score": 50,
  "memory_snippets": []
}

Only include new_npcs if you actually introduce a named character in the narrative. Otherwise return an empty array. Do not invent NPCs the player did not encounter in this beat.`;
}

const SUMMARISE_FLAG = (key: string, value: boolean | number | string) => `${key}=${value}`;

const ASCII_ART_INSTRUCTION = `
Generate an ascii_art field: an 8-line × 40-character ASCII scene using ONLY block elements (█▓▒░), box-drawing characters (┌┐└┘│─), and punctuation symbols. STRICT RULES: NO words, labels, or letters inside the art whatsoever. NO named objects or icons that represent specific things. Use ONLY the density and distribution of block characters (█▓▒░) to convey depth, light, and shadow — dense blocks (█) for foreground and solid surfaces, lighter blocks (░) for atmosphere and distance. The art must be purely abstract and atmospheric, evoking the location through texture and form alone.`;

const LOW_SANITY_INSTRUCTION = `
The character's sanity is critically low. Make the narrative increasingly unreliable and fractured. Time may slip. Reality may bend. Sentences may begin one way and end another. The narrator's clinical detachment cracks. Do not explain — only describe what the character experiences, even if it is impossible.`;

const LOW_SANITY_THRESHOLD = 30;

/**
 * User-turn prompt: packages the resolution result and the slices of state the
 * Narrator needs into a single structured block. Conditionally appends ASCII
 * art / low-sanity instructions.
 */
export function buildNarratorUserPrompt(
  result: ResolutionResult,
  state: MasterState
): string {
  const { metadata, player_state, world_state, log_book } = state;
  const { name, background, attributes, health, max_health, sanity, max_sanity } = player_state;

  const recentLog = log_book.entries
    .slice(-3)
    .map((e) => `  [${e.type}] ${e.content}`)
    .join("\n");

  const flagPairs = Object.entries(world_state.flags).slice(-10);
  const flagSummary =
    flagPairs.length > 0
      ? flagPairs.map(([k, v]) => SUMMARISE_FLAG(k, v)).join(", ")
      : "(none)";

  const sanityLine =
    sanity !== undefined && max_sanity !== undefined
      ? `\n- Sanity: ${sanity}/${max_sanity}`
      : "";

  const loadout    = getEquippedLoadout(state);
  const weaponLine = loadout.weapon
    ? `${loadout.weapon.name}${loadout.weapon.stat_bonus ? ` (${Object.entries(loadout.weapon.stat_bonus).map(([k, v]) => `+${v as number} ${k}`).join(", ")})` : ""}`
    : "None";
  const armorLine  = loadout.armor ? loadout.armor.name : "None";

  const lines: string[] = [
    "RESOLUTION RESULT:",
    `- Outcome: ${result.outcome_type}`,
    `- Success: ${result.success}`,
    `- Narrative context: ${JSON.stringify(result.narrative_context)}`,
    "",
    "CHARACTER:",
    `- Name: ${name}`,
    `- Background: ${background}`,
    `- HP: ${health}/${max_health}${sanityLine}`,
    `- Attributes: STR ${attributes.strength}, AGI ${attributes.agility}, CHA ${attributes.charisma}, INT ${attributes.intelligence}, PER ${attributes.perception}`,
    "",
    "EQUIPPED LOADOUT:",
    `- Weapon: ${weaponLine}`,
    `- Armor: ${armorLine}`,
    "",
    `LOCATION: ${world_state.current_location_id}`,
    "",
    `ACTIVE WORLD FLAGS (most recent 10): ${flagSummary}`,
    "",
    "RECENT LOG:",
    recentLog || "  (no recent entries)",
  ];

  let prompt = lines.join("\n");

  // MOVE actions get the ASCII art instruction.
  if (result.outcome_type.startsWith("MOVE")) {
    prompt += "\n" + ASCII_ART_INSTRUCTION;
  }

  // Lovecraftian + low sanity → unreliable narrator instruction.
  if (
    metadata.genre === Genre.HORROR_LOVECRAFTIAN &&
    sanity !== undefined &&
    sanity < LOW_SANITY_THRESHOLD
  ) {
    prompt += "\n" + LOW_SANITY_INSTRUCTION;
  }

  return prompt;
}
