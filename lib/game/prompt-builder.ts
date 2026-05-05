import { Genre, ActionType, LocationStatus, AssetCategory } from "@/types/game";
import type {
  MasterState,
  ParsedAction,
  ResolutionResult,
  WorldAsset,
  WorldAssetConstitution,
} from "@/types/game";
import { getEquippedLoadout, getNpcDisposition, findNpcInRegistry } from "@/lib/game/state-utils";
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
  "confidence": 0.0,
  "dialogue_tone": "friendly|persuasive|deceptive|intimidating|curious|neutral|null"
}

Rules for field values:
- action_type must be exactly one of the seven values listed above
- primary_target, secondary_target, item_used must be null when not applicable
- inferred_intent must be a single sentence, present tense, player-centric
- confidence must be a number between 0.0 and 1.0
  - 0.8–1.0: unambiguous
  - 0.5–0.8: likely but could be interpreted differently
  - 0.3–0.5: ambiguous; classify as CUSTOM when very uncertain

DIALOGUE TONE CLASSIFICATION:
When action_type is DIALOGUE, set dialogue_tone:
- friendly: warm, kind, complimentary speech
- persuasive: convincing, appealing, negotiating
- deceptive: lying, misdirecting, pretending
- intimidating: threatening, aggressive, dominating
- curious: questioning, investigating, probing
- neutral: simple conversation, greetings, farewells

Classify based on the player's actual words, not their stated intent.
"I'm sure we can work something out" = persuasive even if phrased politely.
"I'd hate for something to happen to your shop" = intimidating despite the soft delivery.
For non-DIALOGUE actions, set dialogue_tone to null.`;
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

  return `CRITICAL OUTPUT FIELD — revealed_npc_names:
When an NPC says their name in this response — in any form
('I am X', 'My name is X', 'Call me X', 'They call me X', 'The name's X',
'They call me X around here', or any equivalent self-introduction) —
you MUST populate this array. This is not optional.
The game system cannot update the character's name without it.

Format: [{ true_name: 'Their Real Name' }]
Just the name — nothing else. The game engine handles IDs.
Example: [{ true_name: 'Marta Ironwood' }]

If no name is revealed this turn: empty array []
If a name IS revealed: populate it — this is MANDATORY

═══════════════════════════════════════════════════════════════

YOUR ROLE — READ THIS BEFORE ANYTHING ELSE:
You are a pure interpreter of game state. You have exactly three jobs:

1. ASSET GENERATOR: On first encounter, describe new locations, NPCs, and items vividly so they become real world assets. Once described, they are locked. You never change them.

2. SCENE BRIDGE: Describe what happens when the player takes an action. The game engine tells you the outcome (success/failure, damage dealt, check passed/failed). You write the story around that outcome. You do NOT decide outcomes.

3. STORY THREAD: Occasionally weave subtle hints toward the main quest into your descriptions. Never force. Never block.

HARD LIMITS — violating these breaks the game:

NEVER speak in the player's voice.
NEVER attribute dialogue, thoughts, memories, or feelings to the player that they did not explicitly state.
NEVER invent prior relationships between the player and any NPC — the player has no history unless stated in the game state or log book.
NEVER have the player 'recognize' someone, 'remember' something, or 'know' something they didn't discover in this session.

The player is always a blank-slate protagonist.
Their past is ONLY what appears in the game log.
Their knowledge is ONLY what they have discovered.
Their relationships are ONLY what they have built.

WRONG: 'You recognize your old mentor, Gareth.'
WRONG: 'As a former soldier, you know this tactic.'
WRONG: 'You and Elara have always had a complicated history.'
RIGHT: 'An elderly man with winter-sky eyes watches you.'
RIGHT: 'The soldier's stance suggests military training.'
RIGHT: 'Elara seems to recognize something in your face.'

When writing NPC dialogue responses:
- The NPC speaks based on their constitution + trust score
- You do NOT write the player's reply
- You do NOT put words in the player's mouth
- You describe the NPC's reaction to what the player SAID (which is provided to you in the action context)

═══════════════════════════════════════════════════════

ROLE:
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

EXAMINE AND INTERACT — ABSOLUTE RULE:
If the player attempts to search, examine, or interact with something that was mentioned in a previous narrative, that thing EXISTS and the player can interact with it. The narrator described it — it is now a fact of the world.

WRONG: 'The satchel was just a trick of shadow'
WRONG: 'What you thought was a bag was merely stones'
WRONG: Retroactively un-creating things the narrator mentioned

RIGHT: Describe what the player finds when they search it
RIGHT: The search succeeds or fails based on what's inside
RIGHT: If truly nothing is there, say the object is empty or yields nothing

The only exception: if the LOGIC RESOLVER returned success=false AND the world flags confirm the object is not present. In that case, briefly explain it is not there and offer what IS available.

This rule applies to ALL objects including readable items such as journals, books, notes, letters, signs, and documents. If the narrator described a leather-bound journal on a desk, the player can read it. Describe its contents. NEVER say a readable object was an illusion or trick of light.

POI LABEL INTEGRITY:
When the player interacts with something they clicked from a highlighted point of interest, that object's EXACT label must be honored. Do not rename, re-label, or substitute synonyms.
If the player interacts with 'hearth', there IS a hearth. Not a fireplace, not a 'what you thought was a hearth'. The exact word the player used came from YOUR description. Honor it exactly.
WRONG: Referring to the target by a different name than the one the player used
WRONG: 'What you thought was the hearth was actually a fireplace'
RIGHT: Use the player's exact word when referring to the object throughout your response

LOCATION & ACTION AUTHORITY:

1. LOCATION IS A FACT, NOT AN INFERENCE:
The player's location is defined by current_location_id in the game state. This is the absolute truth. Never infer or guess the player's location from narrative history. If current_location_id is 'gas_station_01', the player is at the gas station. Full stop.

2. LOCATION STATUS:
- ARRIVING: The player just moved here this turn. Describe the journey and first impressions. This is a scene change.
- PRESENT: The player is already here and taking an action within this location. Do not re-describe the whole location. Pick up where the story left off. Keep it contextual.

3. PREVIOUS NARRATIVE IS BACKSTORY, NOT CURRENT REALITY:
The DEPARTED SCENE / CURRENT SCENE CONTEXT in your context shows where the player was and what happened there. It is history — valuable for continuity, never a constraint on what the player can do now.

4. WHAT THE PLAYER CAN DO IS DEFINED BY THEIR LOCATION:
If the player is at a gas station, they can search it, examine things in it, interact with anything there, attack anything there, or leave. They cannot do things that are physically impossible at that location. But if an action is physically plausible given where they are — they can attempt it. Your job is to describe what happens, not to decide if the player is allowed to try.

5. NEVER BLOCK PLAUSIBLE ACTIONS:
These responses are ALWAYS wrong:
- 'You can't do that here'
- 'That's not possible from where you are'
- 'You'd need to be somewhere else to do that'
- Any response that ends with the player having done nothing
If an action truly makes no sense given the location, briefly acknowledge it and then give the player something they CAN do.

WORLD ASSET CONSTITUTION:
When you introduce a significant named entity for the first time (named location, named character, named faction, named creature, unique item), you are creating a permanent game asset.

Include it in codex_entries with a thorough description covering the relevant constitution fields. This description becomes immutable — it will be injected into all future prompts as fact.

Write constitutions that are:
- Specific and distinctive (not generic fantasy/sci-fi tropes)
- Internally consistent with the world established so far
- Rich enough to support future interactions
- Original (no recognizable IP)

If a world asset appears in ESTABLISHED WORLD ASSETS in the user prompt, your description of it must be 100% consistent with what is already recorded. You may ADD new details but never CONTRADICT existing ones.

NPC NAMES — how to name characters in codex_entries:
When you introduce a CHARACTER for the first time, use a descriptive placeholder as their codex name UNLESS the character explicitly introduces themselves by name or is wearing a clearly visible name badge.

Good placeholder examples: "Chrome-Eyed Shopkeeper", "Scarred Wasteland Guard", "Hooded Figure in the Corner", "One-Armed Ferryman"
Bad placeholders: "A Man", "Unknown Person", "NPC" — be specific and evocative.

Always include the character's true name (if known) in the description field of the codex_entry, formatted as: "True name: [name]. [rest of description]"
If the character's name is unknown even to you (the narrator), omit the true name line entirely.

Characters who introduce themselves by name: use their real name directly in the codex_entry name field — no placeholder needed.

WHEN THE PLAYER LEARNS A CHARACTER'S NAME:
If, during this turn, a CHARACTER reveals their true name to the player (they introduce themselves, the player finds a name badge, reads a document, or any other in-world revelation), you MUST populate revealed_npc_names.

Each entry contains a single field:
- true_name: the character's actual name as revealed in the story.

Just the name — nothing else. The game engine handles all asset-id derivation from the active dialogue context. Do NOT emit asset_id or any other field.

Only populate revealed_npc_names when an identity is NEWLY REVEALED this turn. If the character's name was already known, leave revealed_npc_names empty.

MOVE ACTIONS — ABSOLUTE RULE:
When the action_type is MOVE and movement_mandatory is true in the narrative context, the player has ALREADY moved — the logic engine updated their location before you were called. Your ONLY job is to describe the journey and arrival.

WRONG: "The building is further than it appeared. You are still at the tire tracks."
WRONG: "The path seems impassable. You hesitate, unsure if you can make it."
WRONG: "You start toward the market but your leg wound slows you."

RIGHT: "The walk takes longer than expected, but you arrive at the market as the sun dips low."
RIGHT: "You push through the crowd and find yourself at the gates of the old quarter."
RIGHT: "The journey is uneventful. You reach the warehouse district as night falls."

Distance, difficulty, obstacles, and uncertainty are flavor — they color the journey, they do not prevent arrival. The player WILL arrive. Describe it.

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

DIALOGUE FORMATTING — when the action_type is DIALOGUE:
Write the NPC's spoken words inside double quotes in narrative_text, preceded by their name.
Example format: "Mira looks up slowly. \\"Stay back, stranger,\\" she warns, hand drifting to the blade at her hip. \\"I've seen your kind before.\\"  The door behind her is ajar."
Rules:
- Keep the NPC's voice authentic to their established constitution (speech patterns, personality)
- Surround the quoted speech with brief scene-setting prose (1-2 sentences before/after)
- Include the NPC's reaction or body language to make the scene feel alive
- If the player's action is persuasion/charisma-based, reflect the outcome in the NPC's response

END OF RESPONSE RULE:
Every TIER 2 and TIER 3 response must end with 1-2 sentences that naturally establish what is nearby and available to interact with. Do not use a list. Weave it into the prose.

GOOD: "A merchant sits by a dying fire to your left, his wares spread on a moth-eaten blanket. The door behind him is cracked open, letting in the cold."

BAD: "You can interact with: merchant, fire, door."

The player should always know what they can engage with next without you telling them directly.

DIALOGUE OPTIONS — populate when action involves an NPC:
When the current action is a DIALOGUE action type, OR an INTERACT with an NPC target, populate dialogue_options with 3-4 things the player could say next. Requirements:
- Each option must be meaningfully different in tone and approach
- Tones: "friendly" (cooperative/helpful), "aggressive" (threatening/hostile), "curious" (investigative/questioning), "deceptive" (misleading/manipulative)
- One option should always be a natural exit like "Leave them be" or "Walk away" (tone: "friendly")
- Each option is { id, text, tone } — NOTHING ELSE. No stat_check field.
  The game engine determines the stat check automatically from tone:
  aggressive → STR, curious → PER, deceptive → CHA (+2 difficulty), friendly → no check.
  ALL options are always clickable.
- Keep each option.text under 60 characters — these are button labels
- For non-NPC actions, leave dialogue_options as an empty array

TRUST CHANGES — populate when dialogue meaningfully shifts a relationship:
Populate trust_changes when this interaction notably affects how an NPC feels about the player. delta: +10 to +20 for very positive, -10 to -20 for hostile/deceptive, +5/-5 for mild shifts. Only include if something notable happened — not for every action. Use the NPC's npc_key (snake_case from the NPC registry or ESTABLISHED WORLD ASSETS).

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
  "codex_entries": [],
  "revealed_npc_names": [],
  "dialogue_options": [],
  "trust_changes": [],
  "items_for_sale": [],
  "log_summary": "12-word max journal shorthand of this beat. No 'You'. No 'I'. No 'explored'. Third-person or fragments. Examples: 'Attacked goblin. Hit for 8 damage.' | 'Spoke with Old Hermit. He seemed suspicious.' | 'Discovered hidden chamber beneath the ruins.' | 'Arrived at the Iron Gate fortress.'"
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
  "weight": 1,
  "value": 10
}
Every item MUST include a value field — sell price in genre currency.
Use rarity as guide: Common 5-15, Uncommon 20-50, Rare 100-300, Legendary 500+.
Value reflects worth to a merchant, not sentimental value.

items_for_sale entries use the SAME shape as items_acquired (id, name, type, rarity, description, effect, quantity, stackable, weight, value). Populate ONLY when the resolution context flags a TRADE INTERACTION — list 3-5 items the merchant has on offer with appropriate values. These items are NOT granted to the player; they are merchant inventory shown in the trade UI for the player to choose from.

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
}

dialogue_options entries MUST match this shape (NPC interactions only — empty array otherwise):
{
  "id": "opt_1|opt_2|opt_3|opt_4",
  "text": "What the player says — under 60 chars",
  "tone": "friendly|aggressive|curious|deceptive"
}
NO stat_check field. The game engine determines checks from tone:
aggressive → STR, curious → PER, deceptive → CHA at +2 difficulty, friendly → no check.
ALL options remain clickable regardless of the player's stats.

revealed_npc_names entries MUST match this shape (only when a name is revealed this turn):
{
  "true_name": "Their Real Name"
}
Just the name — nothing else. No asset_id. The game engine resolves the asset from the active dialogue context.

trust_changes entries MUST match this shape (only when a notable shift occurs):
{
  "npc_key": "snake_case NPC key from registry or world assets",
  "delta": -20,
  "reason": "friendly|hostile|helpful|deceptive"
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
function formatAssetConstitution(c: WorldAssetConstitution): string[] {
  // Render only the fields that are actually populated, in a stable order, so
  // the prompt stays compact when assets have sparse data.
  const order: Array<keyof WorldAssetConstitution> = [
    "physical_description",
    "atmosphere",
    "size",
    "faction_affiliation",
    "key_landmarks",
    "available_services",
    "appearance",
    "personality",
    "role",
    "faction",
    "speech_patterns",
    "initial_relationship",
    "ideology",
    "territory",
    "relationship_to_others",
    "behavior",
    "habitat",
    "threat_level",
    "item_type",
    "item_description",
    "lore_content",
    "notes",
  ];
  const out: string[] = [];
  for (const key of order) {
    const v = c[key];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      out.push(`  ${key}: ${v.join(", ")}`);
    } else if (typeof v === "string") {
      if (!v.trim()) continue;
      out.push(`  ${key}: ${v}`);
    }
  }
  return out;
}

function buildEstablishedAssetsBlock(assets: WorldAsset[]): string {
  if (!assets || assets.length === 0) return "";
  const lines: string[] = [
    "══════════════════════════════",
    "ESTABLISHED WORLD ASSETS (immutable facts — never contradict these)",
  ];
  for (const a of assets) {
    lines.push("");
    lines.push(`[${a.category}] — ${a.name}:`);
    const fields = formatAssetConstitution(a.constitution);
    if (fields.length > 0) {
      lines.push(...fields);
    } else {
      lines.push("  (no additional details recorded)");
    }
  }
  lines.push("══════════════════════════════");
  return lines.join("\n");
}

export function buildNarratorUserPrompt(
  result: ResolutionResult,
  state: MasterState,
  lastNarrativeText?: string | null,
  action?: ParsedAction | null,
  locationAssets?: WorldAsset[] | null
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

  const actionType   = action?.action_type ?? "(unknown)";
  const actionDesc   = `${actionType} — ${action?.inferred_intent ?? result.outcome_type}`;

  // Location status is authoritative — set by the logic resolver, not inferred.
  const locationStatus   = world_state.location_status ?? LocationStatus.PRESENT;
  const isArriving       = locationStatus === LocationStatus.ARRIVING;
  const previousLocation = isArriving
    ? (typeof result.narrative_context.from_location === "string"
        ? result.narrative_context.from_location
        : world_state.current_location_id)
    : world_state.current_location_id;

  // ── Authoritative state header ─────────────────────────────────────────────
  const headerLines = [
    "══════════════════════════════",
    "PLAYER STATE (authoritative — trust this, not the narrative)",
    `Current location : ${world_state.current_location_id}`,
    `Location status  : ${locationStatus}`,
    `Previous location: ${previousLocation}`,
    `Action taken     : ${actionDesc}`,
    "══════════════════════════════",
  ];

  // ── Day 18 — NPCS PRESENT AT THIS LOCATION ─────────────────────────────────
  // When a world_graph exists, the current node tells us exactly which NPCs
  // are HERE. Inject them as a hard constraint so the narrator can't invent
  // people who aren't in the graph.
  const npcPresentLines: string[] = [];
  const graph        = state.world_graph;
  const currentNode  = graph?.nodes[graph.current_node_id ?? state.world_state.current_node_id ?? ""];
  if (currentNode && (locationAssets ?? []).length > 0) {
    const presentAssets = currentNode.npc_ids
      .map((id) => (locationAssets ?? []).find((a) => a.id === id))
      .filter((a): a is WorldAsset => !!a && a.category === AssetCategory.CHARACTER);
    if (presentAssets.length > 0) {
      npcPresentLines.push(
        "══════════════════════════════",
        "NPCS PRESENT AT THIS LOCATION (graph-confirmed):",
      );
      for (const npc of presentAssets) {
        const role = typeof npc.constitution.role === "string" ? npc.constitution.role : "";
        npcPresentLines.push(`- ${npc.name}${role ? ` (${role})` : ""}`);
      }
      npcPresentLines.push(
        "Only these NPCs are available for interaction here.",
        "Do not invent additional named characters at this location.",
        "══════════════════════════════",
      );
    } else if (currentNode.npc_ids.length === 0) {
      npcPresentLines.push(
        "══════════════════════════════",
        "NPCS PRESENT AT THIS LOCATION: none.",
        "Do not invent named NPCs here unless the player explicitly enters dialogue.",
        "══════════════════════════════",
      );
    }
  }

  // ── Day 17 — WORLD FACTS block from the seed ───────────────────────────────
  // Establishes the named world / factions / locations as immutable facts BEFORE
  // any per-asset constitution, so the narrator can reference the world by name
  // even when the player hasn't visited the relevant assets yet.
  const seed = metadata.world_seed;
  const worldFactLines: string[] = [];
  if (seed) {
    worldFactLines.push(
      "══════════════════════════════",
      "WORLD FACTS (established before play began — immutable)",
      `World: ${seed.world_name}${seed.world_tagline ? ` — ${seed.world_tagline}` : ""}`,
    );
    if (seed.factions?.length > 0) {
      const factionLine = seed.factions
        .map((f) => `${f.name} (${f.disposition})`)
        .join(", ");
      worldFactLines.push(`Factions: ${factionLine}`);
    }
    const seedLocs = [seed.starting_location, ...(seed.known_locations ?? [])]
      .filter(Boolean)
      .map((l) => l.name);
    if (seedLocs.length > 0) {
      worldFactLines.push(`Known locations: ${seedLocs.join(", ")}`);
    }
    worldFactLines.push("══════════════════════════════");
  }

  // ── Established world assets (immutable facts) ─────────────────────────────
  // Re-order locationAssets so the asset matching the current location is FIRST.
  // This ensures the narrator reads the destination's constitution before
  // anything else when describing a MOVE.
  const orderedAssets = (() => {
    const all = locationAssets ?? [];
    if (all.length <= 1) return all;
    const currentIdx = all.findIndex(
      (a) => a.first_seen_location === world_state.current_location_id
    );
    if (currentIdx <= 0) return all;
    return [all[currentIdx], ...all.slice(0, currentIdx), ...all.slice(currentIdx + 1)];
  })();
  const assetsBlock = buildEstablishedAssetsBlock(orderedAssets);

  // ── Scene context block ────────────────────────────────────────────────────
  const sceneLines: string[] = [];
  if (isArriving) {
    sceneLines.push(
      `SCENE TRANSITION: Player has left ${previousLocation} and arrived at ${world_state.current_location_id}. Write their arrival. The departed scene below is backstory.`,
      "",
      "DEPARTED SCENE (where player just came from — past, not present):",
      lastNarrativeText ?? "(no previous scene)",
      "══════════════════════════════",
    );
  } else if (lastNarrativeText) {
    sceneLines.push(
      "CURRENT SCENE CONTEXT (player is still here, acting within it):",
      lastNarrativeText,
      "══════════════════════════════",
    );
  }

  // ── Main body ──────────────────────────────────────────────────────────────
  const lines: string[] = [
    ...headerLines,
    ...(worldFactLines.length > 0 ? ["", ...worldFactLines] : []),
    ...(npcPresentLines.length > 0 ? ["", ...npcPresentLines] : []),
    ...(assetsBlock ? ["", assetsBlock] : []),
    ...(sceneLines.length > 0 ? ["", ...sceneLines] : []),
    "",
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
    `ACTIVE WORLD FLAGS (most recent 10): ${flagSummary}`,
    "",
    "RECENT LOG:",
    recentLog || "  (no recent entries)",
  ];

  let prompt = lines.join("\n");

  // Object confirmed by resolver — prepend undeniable hard-fact block at the
  // very top of the prompt so it is the first thing the model reads.
  if (result.narrative_context.object_confirmed === true) {
    const objName = String(result.narrative_context.object_name ?? "the target");
    const confirmation = [
      `⚠️ CONFIRMED OBJECT: '${objName}' EXISTS RIGHT NOW.`,
      `The Logic Resolver has confirmed this object is present at the player's location.`,
      `This is not a prompt suggestion — it is a hard game fact.`,
      `Your response MUST describe the player interacting with '${objName}'.`,
      `Any response that denies, questions, or redirects away from this object is WRONG and breaks the game.`,
      `══════════════════════════════`,
      ``,
    ].join("\n");
    prompt = confirmation + prompt;
  }

  // STAT CHECK — generic block (charisma / strength / perception / intelligence).
  const statChecked = result.narrative_context.stat_checked;
  if (typeof statChecked === "string" && statChecked.length > 0) {
    const STAT_LABEL: Record<string, string> = {
      charisma:     "CHARISMA",
      strength:     "STRENGTH",
      perception:   "PERCEPTION",
      intelligence: "INTELLIGENCE",
    };
    const label = STAT_LABEL[statChecked] ?? statChecked.toUpperCase();
    const roll       = Number(result.narrative_context.roll ?? 0);
    const modifier   = Number(result.narrative_context.modifier ?? 0);
    const total      = Number(result.narrative_context.total ?? 0);
    const difficulty = Number(result.narrative_context.check_difficulty ?? result.narrative_context.difficulty ?? 12);
    const passed     = result.narrative_context.success === true;
    const tone       = String(result.narrative_context.tone ?? "");
    const sign       = modifier >= 0 ? `+${modifier}` : `${modifier}`;
    prompt +=
      `\n\n${label} CHECK: ${roll}${sign}=${total} vs difficulty ${difficulty} — ${passed ? "PASSED" : "FAILED"}` +
      (tone ? `\nAttempt tone: ${tone}` : "") +
      `\nWrite the NPC's response reflecting this outcome.` +
      `\nOn PASSED: NPC is more forthcoming, helpful, swayed, or backed down by the attempt.` +
      `\nOn FAILED: NPC is suspicious, dismissive, evasive, hostile, or unmoved.`;
  }

  // ACTIVE NPC CONTEXT — inject the NPC's full constitution + authoritative
  // trust score for ALL DIALOGUE actions where the NPC is already an
  // established asset. First-encounter NPCs (not yet in locationAssets) are
  // skipped so the narrator can mint them as a brand-new world asset.
  if (action?.action_type === ActionType.DIALOGUE) {
    const targetName = action.primary_target ?? null;
    if (targetName && locationAssets && locationAssets.length > 0) {
      const npcAsset = locationAssets.find(
        (a) =>
          a.category === AssetCategory.CHARACTER &&
          a.name.toLowerCase() === targetName.toLowerCase()
      );
      if (npcAsset) {
        // Read trust DIRECTLY from npc_registry — the authoritative source.
        // Fall back to 50 (neutral) when the NPC isn't registered yet.
        const registryEntry = findNpcInRegistry(state.npc_registry, npcAsset.name);
        const trustScore    = registryEntry?.npc.trust_score ?? 50;
        const disposition   = getNpcDisposition(trustScore);
        const c             = npcAsset.constitution;
        const displayName   = npcAsset.name_known === false ? "Identity Unknown" : npcAsset.name;

        const npcLines: string[] = [
          "",
          "═══ ACTIVE NPC — TREAT AS IMMUTABLE GAME FACTS ═══",
          `Asset ID: ${npcAsset.id}`,
          `Name: ${displayName}`,
          `Trust score: ${trustScore}/100 → Disposition: ${disposition}`,
          `Personality: ${c.personality ?? "Unknown"}`,
          `Role: ${c.role ?? "Unknown"}`,
          `Faction: ${c.faction_affiliation ?? "None known"}`,
          `Motivations: ${c.notes ?? "Unknown"}`,
          `First seen: ${npcAsset.first_seen_location || "Unknown"}`,
          "",
          "This NPC's responses MUST be consistent with these facts.",
          "Their personality does not change. Their role does not change.",
          "Their trust level affects how forthcoming they are — not",
          "their fundamental character.",
          "═════════════════════════════════════════════════════",
        ];
        prompt += `\n${npcLines.join("\n")}`;
      }
    }
  }

  // EXAMINE / INTERACT — also append the target pinning reminder at the bottom.
  if (
    action?.action_type === ActionType.EXAMINE ||
    action?.action_type === ActionType.INTERACT
  ) {
    const target = action.primary_target ?? action.secondary_target ?? "the target";
    prompt += `\n\nINTERACTION TARGET: '${target}'\nThis object EXISTS in the current scene. You described it. Use this exact name when referring to it in your response. Do NOT substitute a synonym, rename it, or question its existence.`;
  }

  // CONTAINER search → instruct the Narrator to populate items_acquired.
  const ctx = result.narrative_context;
  if (ctx.container_search === true) {
    const containerName = typeof ctx.container_name === "string" ? ctx.container_name : "the container";
    prompt += `\n\nCONTAINER SEARCH: The player is searching ${containerName}. Decide what (if anything) is inside based on context, genre, and logic. A rusted toolbox in a wasteland might have basic tools or nothing. A merchant's chest might have valuable goods. Populate items_acquired with 0-3 contextually appropriate items. Do not put legendary items in random containers.`;
  }
  if (ctx.already_searched === true) {
    prompt += "\n\nCONTAINER ALREADY SEARCHED: The player has already searched this container. Describe it as empty, picked clean — nothing new to find. Set items_acquired to an empty array.";
  }

  // Day 18 — ZONE_EXPAND: a new sub_location within the current zone.
  if (ctx.move_type === "ZONE_EXPAND") {
    const hint = String(ctx.expand_hint ?? "a sub-area");
    prompt += `\n\nZONE EXPAND: The player is exploring a NEW sub-area within the current zone — '${hint}'. ` +
      "Describe their arrival in this sub-area as a fresh scene. " +
      "Treat it as a new node within the same zone (still under the parent location's faction and authority). " +
      "Do not introduce a different faction or radically different setting — this is the same place, just a different corner of it.";
  }

  // Day 18 — INTERNAL_DESCRIBE: player is referring to an in-room sub-area
  // ("go to the bar"). This is NOT a real move. Describe the moment in
  // place; do NOT relocate the player.
  if (ctx.is_internal_description === true) {
    const hint = String(ctx.sub_area_hint ?? "a part of the room");
    prompt += `\n\nINTERNAL DESCRIBE: The player is referring to '${hint}' — an in-room sub-area, NOT a separate location. ` +
      "Describe what they observe / do there as a beat WITHIN the current scene. " +
      "Do NOT relocate the player. Do NOT treat this as a MOVE. " +
      "Continue the current scene; the player has not left the room.";
  }

  // Day 16 — TRADE block fires when resolveInteract detects merchant keywords.
  if (ctx.trade_available === true) {
    prompt += "\n\nTRADE INTERACTION: The player is approaching a merchant. " +
      "Generate items_for_sale in your response — 3-5 items the merchant is " +
      "selling with appropriate values for this genre. These are NOT granted " +
      "to the player — they are merchant inventory for sale. Use sensible " +
      "rarity/value combinations: a battered roadside vendor offers Common " +
      "supplies (value 5-15), a specialist artisan offers Uncommon goods " +
      "(value 20-50), a master trader may have Rare items (value 100-300). " +
      "Leave items_acquired EMPTY — the player has not bought anything yet.";
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
