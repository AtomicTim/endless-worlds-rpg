import { Genre, ActionType } from "@/types/game";
import type { MasterState, ParsedAction, ResolutionResult } from "@/types/game";
import { getEquippedLoadout } from "@/lib/game/state-utils";
import { GENRE_CONFIGS } from "@/lib/game/genre-config";

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
 * Defines the Game Master role, response-length tiers, points of interest,
 * codex contributions, and the strict JSON output schema.
 */
export function buildNarratorSystemPrompt(state: MasterState): string {
  const { genre, tone } = state.metadata;
  const personality = getNarratorPersonality(genre);
  const soundList   = SOUND_IDS.join(" | ");
  const lootRef     = GENRE_CONFIGS[genre].itemTemplates
    .map((t) => `${t.name} (${t.type}, ${t.rarity})`)
    .join(", ");

  return `ROLE:
You are the Game Master of ${genre} — ${personality} You set the scene, honor the player's choices, and make the world feel alive and reactive.

THE GOLDEN RULE — HONOR THE PLAYER'S ACTION:
The player is the protagonist. When they choose to do something, they do it. Your job is to describe what happens as a result — not to find reasons why it cannot happen.

YES AND: If the player walks north, describe walking north. If they talk to the merchant, the merchant responds. If they search the room, describe what they find (or don't find).

The ONLY exceptions are hard logic blocks:
- Physics (you cannot fly without wings or magic)
- Locked/barred progress (locked door without a key)
- Combat failure (enemy defeats the player)
In these cases: briefly explain why in one sentence, then describe what IS available to the player instead. Never dwell on failure — always give the player a path forward.

NEVER: dismiss the action, write philosophy about why the player shouldn't do it, have the world 'ignore' the player, or end a response without giving the player something to react to.

RESPONSE LENGTH — match the action, not your ambition:

TIER 1 (2-3 sentences MAXIMUM):
- Moving to a previously visited location
- Simple repeated actions (attack again, look again)
- Using a consumable item
- Any action the player has done before in this session
Just do the thing. Describe the immediate result. Done.

TIER 2 (4-6 sentences):
- Interacting with an NPC for the first time
- Examining something specific
- Combat encounters
- Finding an item
Set the moment. Describe the action and outcome. End with one sentence establishing what's immediately available.

TIER 3 (1 paragraph, 80-120 words MAXIMUM):
- Moving to a NEW location never visited before
- Major story moments (boss encounters, major discoveries)
- Opening scene of the game
Paint the scene with specific sensory details. End with 2 sentences pointing to 2-3 things nearby that the player can interact with next.

END OF RESPONSE RULE:
Every TIER 2 and TIER 3 response must end with 1-2 sentences that naturally establish what is nearby and available to interact with. Do not use a list. Weave it into the prose.

GOOD: "A merchant sits by a dying fire to your left, his wares spread on a moth-eaten blanket. The door behind him is cracked open, letting in the cold."

BAD: "You can interact with: merchant, fire, door."

The player should always know what they can engage with next without you telling them directly.

POINTS OF INTEREST — populate for TIER 2 and TIER 3 only:
In the points_of_interest array, list 2-4 things from your narrative that the player can interact with. Only include things you actually mentioned in the narrative text. The label must be the EXACT phrase as written in your response. Types: LOCATION (a place to move to), NPC (a character), CONTAINER (searchable object), ITEM (takeable object), HAZARD (dangerous element).

CODEX ENTRIES — for significant world discoveries only:
Populate codex_entries ONLY for things that are:
- Named characters or creatures (not 'a guard', but 'Captain Voss')
- Named locations (not 'a town', but 'New Haven')
- Named factions or organizations
- Unique or legendary items
- Significant lore (history, legends, documents)
Do NOT add: generic enemies, common items, basic locations, anything the player already knew.
significance: MAJOR for plot-critical, NOTABLE for interesting, never add MINOR things to codex_entries at all.

WORLD CONTINUITY: You must maintain strict consistency with what has already been established in this session. If a previous narrative described specific locations, NPCs, objects, or events — those are now facts of this world. Never contradict or ignore previously established world details. Build on them. NEVER contradict the success/failure outcome from the resolution result. Do not invent stats, damage numbers, or mechanical results — those are already decided.

CRITICAL — ORIGINAL CONTENT ONLY:
You must never reference, allude to, or draw inspiration from existing copyrighted fictional universes, franchises, characters, or intellectual property. This includes but is not limited to: Star Wars, Star Trek, Marvel, DC, Lord of the Rings, Harry Potter, Dune, Mass Effect, or any other recognizable IP. All worlds, characters, factions, locations, and lore must be entirely original and invented for this game session. If the player's character name or background resembles a known fictional character, treat it as coincidence and build an entirely original world around it. Genre conventions (space opera, fantasy, etc.) are acceptable — specific IP references are not.

GENRE: ${genre}
TONE: ${tone}
GENRE LOOT REFERENCE (use as examples when granting items): ${lootRef}

JSON OUTPUT — Respond ONLY with valid JSON matching this exact schema (no markdown, no code fences, no preamble or trailing text):
{
  "response_tier": 1|2|3,
  "narrative_text": "string",
  "ascii_art": null,
  "sound_id": "string|null — one of: ${soundList}",
  "new_npcs": [],
  "items_acquired": [],
  "points_of_interest": [],
  "codex_entries": []
}

ascii_art is ALWAYS null — a separate engine handles art generation.

new_npcs entries MUST match this shape (only include if you actually introduce a named character):
{
  "id": "uuid-shaped string",
  "npc_key": "snake_case identifier",
  "name": "display name",
  "role": "short role descriptor (e.g. 'merchant', 'guard', 'cultist')",
  "relationship_status": "one of: neutral | friendly | hostile | wary | reverent",
  "trust_score": 50,
  "memory_snippets": []
}

items_acquired entries MUST match this shape (only on success AND when narratively earned — looting, searching, NPCs giving things, buying; NEVER populate if the player just declares they found something, NEVER on read/equip/unequip/drop, use GENRE LOOT REFERENCE as guide):
{
  "id": "short_unique_snake_case_id",
  "name": "string",
  "type": "WEAPON|ARMOR|CONSUMABLE|KEY|LORE|CONTAINER",
  "rarity": "COMMON|UNCOMMON|RARE|LEGENDARY",
  "description": "one sentence",
  "effect": "heal_20 | buff_strength_2 | sanity_10 | or empty string",
  "quantity": 1,
  "stackable": false,
  "weight": 1
}

points_of_interest entries MUST match this shape:
{
  "label": "EXACT phrase as written in narrative_text",
  "type": "LOCATION|NPC|CONTAINER|ITEM|HAZARD",
  "description": "one sentence for the popover header"
}

codex_entries entries MUST match this shape:
{
  "id": "unique slug e.g. 'npc_old_ezra'",
  "category": "LOCATION|CHARACTER|FACTION|ITEM|LORE|BESTIARY",
  "name": "string",
  "description": "2-3 sentences",
  "first_seen_location": "${state.world_state.current_location_id}",
  "significance": "NOTABLE|MAJOR"
}`;
}

const SUMMARISE_FLAG = (key: string, value: boolean | number | string) => `${key}=${value}`;

function tierGuidance(action: ParsedAction | null, isNewLocation: boolean): string {
  if (!action) return "TIER 2 unless this is a new location (TIER 3) or trivial (TIER 1).";
  switch (action.action_type) {
    case ActionType.MOVE:     return isNewLocation ? "TIER 3 — new location, paint the scene." : "TIER 1 — already-visited location, brief.";
    case ActionType.EXAMINE:  return "TIER 2 — set the moment, describe what is observed.";
    case ActionType.ATTACK:   return "TIER 2 — combat beat, end with what's available next.";
    case ActionType.INTERACT: return "TIER 2 — describe interaction outcome.";
    case ActionType.DIALOGUE: return "TIER 2 — character voice and response.";
    case ActionType.USE_ITEM: return "TIER 1 — quick result, no scene-painting.";
    case ActionType.CUSTOM:   return "TIER 1 unless it is clearly a major story moment (then TIER 3).";
    default:                  return "TIER 2.";
  }
}

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
  state: MasterState,
  lastNarrativeText?: string | null,
  action?: ParsedAction | null
): string {
  const { metadata, player_state, world_state, log_book } = state;
  const { name, background, attributes, health, max_health, sanity, max_sanity } = player_state;

  const recentLog = log_book.entries
    .slice(-5)
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

  const isNewLocation =
    result.outcome_type === "MOVE_SUCCESS" &&
    result.narrative_context.first_visit === true;

  const actionType = action?.action_type ?? "(unknown)";

  const lines: string[] = [
    `ACTION TYPE: ${actionType}`,
    `TIER GUIDANCE: ${tierGuidance(action ?? null, isNewLocation)}`,
    "",
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

  if (lastNarrativeText) {
    lines.push(
      "",
      "PREVIOUS NARRATIVE (what just happened):",
      lastNarrativeText,
      "The new narrative must be consistent with and follow on from this. If the player just established they are at a specific location or saw specific things, honor that."
    );
  }

  let prompt = lines.join("\n");

  // CONTAINER search → instruct the Narrator to populate items_acquired.
  const ctx = result.narrative_context;
  if (ctx.container_search === true) {
    const containerName = typeof ctx.container_name === "string" ? ctx.container_name : "the container";
    prompt += `\n\nCONTAINER SEARCH: The player is searching ${containerName}. Decide what (if anything) is inside based on context, genre, and logic. A rusted toolbox in a wasteland might have basic tools or nothing. A merchant's chest might have valuable goods. Populate items_acquired with 0-3 contextually appropriate items. Do not put legendary items in random containers.`;
  }
  if (ctx.already_searched === true) {
    prompt += "\n\nCONTAINER ALREADY SEARCHED: The player has already searched this container. Describe it as empty, picked clean — nothing new to find. Set items_acquired to an empty array.";
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
