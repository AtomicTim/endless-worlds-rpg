import { Genre, ActionType, LocationStatus, AssetCategory } from "@/types/game";
import type {
  MasterState,
  ParsedAction,
  ResolutionResult,
  WorldAsset,
  WorldAssetConstitution,
  WorldConsistencyDocument,
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
export type Verbosity = "terse" | "standard" | "rich";

/**
 * Day 19A — Format the World Consistency Document as a prompt block.
 * Exported so /api/game/generate-world-seed can prepend the same block
 * verbatim to its own prompt (Step 4 of Day 19A).
 *
 * Returns "" when wcd is undefined so callers can unconditionally
 * concatenate without null checks.
 */
export function formatWcdBlock(wcd: WorldConsistencyDocument | undefined): string {
  if (!wcd) return "";
  const sep = "═══════════════════════════════════════════════════════════════";
  const lines: string[] = [];
  lines.push(sep);
  lines.push("WORLD CONSISTENCY DOCUMENT — ABSOLUTE FACTS");
  lines.push(sep);
  lines.push(`World: ${wcd.world_name} — ${wcd.world_tagline}`);
  lines.push(wcd.atmosphere);
  lines.push("");
  lines.push("Landmarks (every inhabitant knows these exist):");
  for (const lm of wcd.landmarks ?? []) {
    lines.push(`- ${lm.name} (${lm.known_by}): ${lm.public_description}`);
  }
  lines.push("");
  lines.push("Factions:");
  for (const f of wcd.factions ?? []) {
    lines.push(`- ${f.name}: ${f.territory}. ${f.public_reputation}. Disposition to player: ${f.disposition_to_player}.`);
  }
  lines.push("");
  lines.push("World Rules (universal truths — never contradict these):");
  for (const r of wcd.world_rules ?? []) {
    lines.push(`- ${r}`);
  }
  lines.push("");
  lines.push("YOU MUST NEVER contradict this document. These facts exist regardless of what the player has discovered. NPCs know about landmarks according to their known_by level: everyone knows 'everyone' landmarks, only locals know 'locals' ones, only scholars know 'scholars' ones.");
  lines.push(sep);
  return lines.join("\n");
}

/**
 * Day 23.5C — Format the player's character profile (species, gender,
 * appearance, origin, motivation) as a compact narrator context block.
 *
 * Returns "" when player_state.character_profile is absent (old saves
 * that predate 23.5). The caller unconditionally concatenates so this
 * must be empty-string-safe — never null.
 *
 * Block format:
 *   ═══ PLAYER CHARACTER ═══
 *   Species: {species.name} — {species.lore_notes}
 *   Gender: {gender}
 *   Appearance: {appearance.summary}
 *   Origin: {origin.label} — {origin.description}
 *   Motivation: {motivation}   (omitted entirely if empty)
 *   ════════════════════════
 */
export function formatPlayerCharacterBlock(state: MasterState): string {
  const profile = state.player_state.character_profile;
  if (!profile) return "";

  const lines: string[] = ["═══ PLAYER CHARACTER ═══"];

  // Species — look up in metadata.species by id. When the metadata
  // species list is missing or the id doesn't match, skip the species
  // line silently and still emit the rest.
  const species = (state.metadata.species ?? []).find(
    (s) => s.id === profile.species_id
  );
  if (species) {
    const lore = species.lore_notes?.trim();
    lines.push(
      lore
        ? `Species: ${species.name} — ${lore}`
        : `Species: ${species.name}`,
    );
  }

  lines.push(`Gender: ${profile.gender}`);

  const appearanceSummary = profile.appearance?.summary?.trim();
  if (appearanceSummary) {
    lines.push(`Appearance: ${appearanceSummary}`);
  }

  const originLabel = profile.origin?.label?.trim();
  const originDesc  = profile.origin?.description?.trim();
  if (originLabel) {
    lines.push(
      originDesc
        ? `Origin: ${originLabel} — ${originDesc}`
        : `Origin: ${originLabel}`,
    );
  }

  const motivation = profile.motivation?.trim();
  if (motivation) {
    lines.push(`Motivation: ${motivation}`);
  }

  lines.push("════════════════════════");
  console.log("[prompt-builder] PLAYER CHARACTER block injected");
  return lines.join("\n");
}

// FIX 6 — Concrete, measurable sentence caps so the three modes
// produce visibly different output. Also overrides the earlier
// RESPONSE LENGTH tiers in the system prompt — the verbosity block
// is appended LAST, so its caps are the final word the model reads.
// FIX 11 — three modes are now mutually exclusive and strictly bounded.
// Each block ends with the same override line so the model can't argue
// itself into a "but the action is interesting" exception. Counts MUST
// match across modes — they're orthogonal length budgets, not gradients.
const VERBOSITY_BLOCKS: Record<Verbosity, string> = {
  terse:    `\n\nRESPONSE LENGTH — TERSE (STRICTLY ENFORCED):
- 2 sentences maximum for any routine action
- 3 sentences maximum for NPC dialogue responses
- 4 sentences maximum for new location arrivals
- Every sentence: 12 words maximum, no exceptions
- Count your sentences before responding. If over limit, cut.
This length rule overrides all other instructions.`,
  standard: `\n\nRESPONSE LENGTH — STANDARD (STRICTLY ENFORCED):
- 3-4 sentences for routine actions
- 4-5 sentences for NPC dialogue responses
- 5-7 sentences for new location arrivals
- Sentences may be complete thoughts, not fragments
This length rule overrides all other instructions.`,
  rich:     `\n\nRESPONSE LENGTH — RICH (STRICTLY ENFORCED):
- 5-7 sentences for routine actions
- 6-8 sentences for NPC dialogue responses
- 8-12 sentences for new location arrivals
- Full atmospheric prose. Sensory detail. Character depth.
This length rule overrides all other instructions.`,
};

export function buildNarratorSystemPrompt(
  state: MasterState,
  verbosity: Verbosity = "standard",
  wcd?: WorldConsistencyDocument
): string {
  // FIX 6 — log the verbosity that actually reached the prompt builder
  // so we can correlate UI clicks → store → narrator end-to-end.
  console.log("[PromptBuilder] verbosity block added:", verbosity);
  const { genre, tone } = state.metadata;
  const personality = getNarratorPersonality(genre);
  const soundList   = SOUND_IDS.join(" | ");
  const lootRef     = GENRE_CONFIGS[genre].itemTemplates
    .map((t) => `${t.name} (${t.type}, ${t.rarity})`)
    .join(", ");

  // Day 19A — World Consistency Document is the absolute first block.
  // Empty string when no WCD is set yet (old saves, fresh sessions before
  // generate-wcd has run). Trailing newline ensures the next block is
  // visually separated.
  const wcdPrefix = wcd ? `${formatWcdBlock(wcd)}\n\n` : "";

  // Day 23.5C — PLAYER CHARACTER block. Lives between WCD and HARD RULES
  // so the narrator anchors on who the player is before reading the rules.
  // Silently omitted when character_profile is absent (old saves predating
  // 23.5). Combat narration uses a different system prompt and doesn't
  // receive this block (per spec).
  const playerCharacterBlock = formatPlayerCharacterBlock(state);
  const playerCharacterPrefix =
    playerCharacterBlock.length > 0 ? `${playerCharacterBlock}\n\n` : "";

  return `${wcdPrefix}${playerCharacterPrefix}YOUR ROLE AND HARD RULES — READ BEFORE ANYTHING ELSE
═══════════════════════════════════════════════════════════════

A — YOUR THREE JOBS:

1. DESCRIBE: Translate what just happened into vivid prose. Use the locked asset data you are given as ground truth.
2. BRIDGE: Connect player actions to their outcomes. The game engine tells you what succeeded or failed — you describe it.
3. THREAD: Occasionally weave subtle hints from the main quest breadcrumbs into your descriptions. Never force it. Never make it obvious.

You are a pure DESCRIBER, not a world generator. The world has already been built — your job is to bring it to life on the page.

B — WHAT YOU MUST NEVER DO:

- NEVER invent or name a location that is not in ESTABLISHED WORLD ASSETS or the player's current location.
- NEVER introduce a named NPC who is not in the NPCS PRESENT or RESPONDING CHARACTER blocks.
- NEVER invent a named interactable object that is not in the TIER 1 OBJECTS list.
- NEVER say an object disappeared, wasn't there, or the player cannot interact with it.
- NEVER speak in the player's voice or attribute actions, memories, thoughts, feelings, or relationships to them that they did not explicitly state.
- NEVER contradict the World Consistency Document.
- NEVER say an NPC left, is unavailable, or is gone — a failed check means they are guarded or unhelpful, not absent.

STAT CHECK FAILURES — CRITICAL RULE:
When a stat check FAILS, the NPC must NOT reveal the information
the player was asking for. A failed check means:
- The NPC is suspicious, cagey, or deflects the question
- The NPC gives vague non-answers or changes the subject
- The NPC may reveal the check itself ('you're fishing for
  information') but gives nothing useful
- Named locations, people, factions, or secrets are NEVER
  revealed on a failed check
Wrong: Failed PER check → NPC names three specific locations
Right: Failed PER check → NPC says 'Most travelers ask about
  safe routes, not sightseeing' and stops there

The player is always a blank-slate protagonist. Their past is ONLY what appears in the game log. Their knowledge is ONLY what they have discovered. Their relationships are ONLY what they have built.

WRONG: "You recognize your old mentor, Gareth."
WRONG: "As a former soldier, you know this tactic."
WRONG: "Elara has been gone a long time." (she is in NPCS PRESENT)
RIGHT: "An elderly man with winter-sky eyes watches you."
RIGHT: "Elara meets your gaze without expression."

C — NAMES ARE PERMANENT:

Every location, NPC, and object has an exact stored name. Use it verbatim.
- WRONG: "the inn" when the location is "Korven's Inn".  RIGHT: "Korven's Inn".
- WRONG: "the innkeeper" after introduction.  RIGHT: "Korven sets down his glass".

D — TIER 1 OBJECTS ONLY IN DESCRIPTIONS:

You will receive a TIER 1 OBJECTS list for the current location. These are the only named objects you should reference as specific interactable things.
- You MAY describe ambient atmosphere freely — smells, sounds, general environment, weather, light.
- You MAY NOT name specific objects as interactable unless they are in the Tier 1 list.
- If the player tries to interact with something not in the list, the game engine has already routed that to a Tier 2 template or to you with a TIER 3 AMBIENT INTERACTION instruction. Follow those rules — never invent a new tracked object on your own.

E — NPC INTRODUCTION RULE:

Every NPC has a real name from the moment they appear in the game. When introducing them for the first time, describe their appearance in 1 sentence, then name them in the very next sentence. Never use a placeholder description as their name after introduction.

EXAMPLE: "A broad-shouldered woman wipes down the bar with a rag. Mira Coldwater meets your gaze without expression."

When writing NPC dialogue responses:
- The NPC speaks based on their constitution + trust score.
- You do NOT write the player's reply.
- You do NOT put words in the player's mouth.
- You describe the NPC's reaction to what the player SAID (which is provided to you in the action context).

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

NPC NAMES — every NPC has a real name from birth:
When a CHARACTER appears in NPCS PRESENT or RESPONDING CHARACTER, their real name is locked. Use it. Never invent a placeholder description like "Hooded Figure" — the world bible already gave them a name.

For codex_entries, always use the NPC's exact stored name (from the world asset / npcs list). Description should be 2-3 sentences covering appearance and role.

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

DIALOGUE OPTIONS — leave the array empty:
The game engine builds the dialogue option list from each NPC's
constitution.knowledge[] (Architecture C). You no longer emit
options. Always set "dialogue_options": []. Anything you write
in this field is dropped before reaching the player.

TRUST CHANGES — populate when dialogue meaningfully shifts a relationship:
Populate trust_changes when this interaction notably affects how an NPC feels about the player. delta: +10 to +20 for very positive, -10 to -20 for hostile/deceptive, +5/-5 for mild shifts. Only include if something notable happened — not for every action. Use the NPC's npc_key (snake_case from the NPC registry or ESTABLISHED WORLD ASSETS).

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
  "codex_entries": [],
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

trust_changes entries MUST match this shape (only when a notable shift occurs):
{
  "npc_key": "snake_case NPC key from registry or world assets",
  "delta": -20,
  "reason": "friendly|hostile|helpful|deceptive"
}${VERBOSITY_BLOCKS[verbosity]}`;
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
  locationAssets?: WorldAsset[] | null,
  // Day 19A — WCD is consumed by buildNarratorSystemPrompt; accepted here
  // for symmetric plumbing through the route. Reserved for future use
  // (e.g. landmark hints in turn-specific prompts). Reference it via
  // void to silence unused-var lint without disabling the rule.
  wcd?: WorldConsistencyDocument
): string {
  void wcd;
  const { metadata, player_state, world_state, log_book } = state;

  // FIX 2 — detect when the player is inside a dungeon room so the narrator
  // receives room context (2A), no inventory hints (2B), and room-scoped
  // connected locations (2C).
  const _currentGraphNodeId = state.world_graph?.current_node_id ?? state.world_state.current_node_id ?? "";
  const _ds = state.dungeon_state;
  const isInsideDungeon = !!(
    _ds && _ds.node_id && _ds.node_id === _currentGraphNodeId
  );
  const dungeonRoomNode = isInsideDungeon
    ? (state.world_graph?.nodes[_ds!.node_id] ?? null)
    : null;
  const currentDungeonRoom = dungeonRoomNode && _ds
    ? ((dungeonRoomNode.dungeon_rooms ?? []).find((r) => r.id === _ds!.current_room_id) ?? null)
    : null;
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
  //
  // Issue A: for DIALOGUE actions, the ACTIVE NPC CONTEXT block (further
  // down) already names the single resolved NPC and gives their full
  // constitution. The roster-style NPCS PRESENT block is redundant and could
  // tempt the narrator to write dialogue for a different character — skip
  // it entirely on DIALOGUE actions.
  // Day 19E: tightened wording — the roster is the ONLY set of characters
  // the narrator may name at this location. Personality is included so the
  // narrator can voice the NPC consistently without re-fetching their full
  // constitution mid-paragraph.
  const npcPresentLines: string[] = [];
  const graph        = state.world_graph;
  const currentNode  = graph?.nodes[graph.current_node_id ?? state.world_state.current_node_id ?? ""];
  const isDialogueAction = action?.action_type === ActionType.DIALOGUE;
  if (currentNode && (locationAssets ?? []).length > 0 && !isDialogueAction) {
    const presentAssets = currentNode.npc_ids
      .map((id) => (locationAssets ?? []).find((a) => a.id === id))
      .filter((a): a is WorldAsset => !!a && a.category === AssetCategory.CHARACTER);
    if (presentAssets.length > 0) {
      npcPresentLines.push(
        "══════════════════════════════",
        "NPCS PRESENT AT THIS LOCATION:",
      );
      for (const npc of presentAssets) {
        const role        = typeof npc.constitution.role === "string" ? npc.constitution.role : "";
        const personality = typeof npc.constitution.personality === "string"
          ? npc.constitution.personality.split(/\.\s+/)[0].trim()
          : "";
        npcPresentLines.push(
          `- ${npc.name}${role ? ` (${role})` : ""}${personality ? `: ${personality}` : ""}`
        );
      }
      npcPresentLines.push(
        "These are the ONLY characters available for interaction here.",
        "Do NOT introduce or name any other characters at this location.",
        "══════════════════════════════",
      );
    } else {
      npcPresentLines.push(
        "══════════════════════════════",
        "NPCS PRESENT: None.",
        "If the player speaks using quotes, describe ambient sounds or environment only.",
        "Do not invent a character to respond.",
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

  // ── Day 19E — TIER 1 OBJECTS at the current location ───────────────────────
  // Pull the current location's world_asset and read its key_landmarks
  // (Tier 1 object names). These are the only objects the narrator may name
  // as specific interactable things. Tier 2 ambient objects and Tier 3
  // freeform interactions are handled by other code paths.
  //
  // Audit Issue F fix: switched from prohibitive wording ("don't name
  // anything else") to imperative ("USE THESE EXACT NAMES VERBATIM"). The
  // narrator was previously free to write "the cracked fountain" instead
  // of the locked "Cracked Memory Fountain" — the highlight matcher then
  // found nothing because it does exact whole-word matches only.
  const tier1Lines: string[] = [];
  {
    const all = locationAssets ?? [];
    const currentLocAsset = all.find(
      (a) =>
        a.category === AssetCategory.LOCATION &&
        (a.id === `location_${world_state.current_location_id}` ||
          a.first_seen_location === world_state.current_location_id)
    );
    const landmarks = (currentLocAsset?.constitution.key_landmarks ?? [])
      .filter((s) => typeof s === "string" && s.trim().length > 0);
    if (landmarks.length > 0) {
      tier1Lines.push(
        "══════════════════════════════",
        "TIER 1 OBJECTS — YOU MUST USE THESE EXACT NAMES VERBATIM:",
      );
      for (const name of landmarks) {
        tier1Lines.push(`- ${name}`);
      }
      tier1Lines.push(
        "",
        "MANDATORY NAMING RULES:",
        "- When describing or referencing any of the above objects, write the",
        "  EXACT name as listed. Every word, every capital letter.",
        "- Wrong: \"a cracked fountain\" or \"the memory fountain\".",
        "- Right: \"the Cracked Memory Fountain\".",
        "- The player's UI highlights ONLY exact name matches. If you write a",
        "  synonym, abbreviation, or paraphrase, the object becomes invisible",
        "  and uninteractable — the player cannot click it.",
        "- Also use the exact NPC names from NPCS PRESENT verbatim. Never",
        "  substitute a descriptor (\"the innkeeper\", \"the hooded man\") for",
        "  a real name once the NPC has been introduced.",
        "══════════════════════════════",
      );
    }
  }

  // ── FIX 2A — CURRENT ROOM block (dungeon only) ────────────────────────────
  // Gives the narrator the room's name, description, and objects instead of
  // the dungeon node's graph assets (which describe the dungeon exterior +
  // connections to the region zone). The standard ESTABLISHED WORLD ASSETS
  // block still follows — it provides genre/faction/lore context.
  const dungeonRoomLines: string[] = [];
  if (isInsideDungeon && currentDungeonRoom) {
    dungeonRoomLines.push(
      "══════════════════════════════",
      `CURRENT ROOM: ${currentDungeonRoom.name}`,
      currentDungeonRoom.description || "(no description recorded)",
    );
    const roomObjs = (currentDungeonRoom.objects ?? []) as Array<{ name?: string; description?: string }>;
    if (roomObjs.length > 0) {
      dungeonRoomLines.push("OBJECTS IN THIS ROOM:");
      for (const obj of roomObjs) {
        if (obj.name) {
          dungeonRoomLines.push(`- ${obj.name}${obj.description ? `: ${obj.description}` : ""}`);
        }
      }
    }
    dungeonRoomLines.push("══════════════════════════════");
  }

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
    // FIX 2A — room block before world assets so the narrator reads the
    // immediate room context first, then the broader world lore.
    ...(dungeonRoomLines.length > 0 ? ["", ...dungeonRoomLines] : []),
    ...(assetsBlock ? ["", assetsBlock] : []),
    ...(tier1Lines.length > 0 ? ["", ...tier1Lines] : []),
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
    // FIX 2B — strip EQUIPPED LOADOUT inside a dungeon room. Knowing the
    // player's gear lets the narrator hint "its markings match the sword
    // you carry" — that inference belongs to the player, not the narrator.
    ...(isInsideDungeon ? [] : [
      "",
      "EQUIPPED LOADOUT:",
      `- Weapon: ${weaponLine}`,
      `- Armor: ${armorLine}`,
    ]),
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

  // SELECTED_KNOWLEDGE — Architecture C, code-built dialogue options.
  // When the player clicks a knowledge button, useGameLoop grafts
  // {topic, content} onto narrative_context.selected_knowledge so we
  // can hand the narrator a closed context: this is the ONE fact in
  // play, decide whether to reveal or deflect based on the stat check.
  // Without this gate the AI sees the full NPC knowledge bank and can
  // free-associate; with it, the conversation stays scoped.
  const selectedKnow = result.narrative_context.selected_knowledge as
    | { topic?: string; content?: string }
    | undefined;
  if (
    selectedKnow &&
    typeof selectedKnow === "object" &&
    typeof selectedKnow.content === "string" &&
    selectedKnow.content.trim().length > 0
  ) {
    const topic   = String(selectedKnow.topic ?? "").trim() || "the matter at hand";
    const content = selectedKnow.content.trim();
    prompt +=
      `\n\nCLOSED CONTEXT — SELECTED KNOWLEDGE:\n` +
      `The player is asking about: ${topic}\n` +
      `What the NPC knows: ${content}\n` +
      `\nRespond in character. On a passed stat check, REVEAL the ` +
      `content (paraphrase naturally — do not copy the sentence verbatim). ` +
      `On a failed check, deflect, evade, or give a half-truth that ` +
      `doesn't disclose the content. Do NOT reference any other facts ` +
      `from this NPC's knowledge — only the one above is in play.`;
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

        // V8.67 — SITUATION block. When the NPC carries a quest_seed
        // (mirrored from NPCDefinition by apply-*-bible's npcToAsset),
        // hand the narrator the seed sentence and instruct them to
        // surface it naturally — as something weighing on the NPC, not
        // a mission briefing. Without this block, the narrator
        // free-associates from the NPC's personality + knowledge and
        // never mentions the situation that drives their side-quest.
        //
        // Pre-fix symptom: Kessian Thorne's quest fired when the
        // player talked to him about quicksilver sickness, but Kessian
        // never mentioned his missing daughter — because the narrator
        // didn't know about that thread.
        //
        // Only injects when quest_hook is true AND quest_seed has
        // content. Non-quest NPCs and quest NPCs without a seed
        // (legacy / partial data) get the normal ACTIVE NPC block
        // alone.
        const questHook = c.quest_hook === true;
        const questSeed = typeof c.quest_seed === "string" ? c.quest_seed.trim() : "";
        if (questHook && questSeed.length > 0) {
          const situationLines: string[] = [
            "",
            "═══ SITUATION (quest-hook NPC — surface naturally) ═══",
            `"${questSeed}"`,
            "",
            "This NPC is worried about or dealing with this situation.",
            "They may bring it up in conversation — not as a mission",
            "briefing, but as something weighing on them. Reference",
            "obliquely when the player's question is adjacent; reveal",
            "more directly only when the player asks about it or earns",
            "the NPC's trust. Never put the literal sentence above into",
            "the NPC's mouth — paraphrase it in their voice.",
            "═════════════════════════════════════════════════════",
          ];
          prompt += `\n${situationLines.join("\n")}`;
        }
      }
    }
  }

  // FIX 4 — When the player looks around / takes in their surroundings,
  // inject the NEARBY LOCATIONS + NPCS PRESENT block so the narrator
  // names the real WorldBible neighbours rather than inventing
  // exits / strangers. Triggers on EXAMINE actions plus any inferred
  // intent that mentions surroundings/look around/take in/scan.
  const lookIntent = (action?.inferred_intent ?? "").toLowerCase();
  const isLookAround =
    action?.action_type === ActionType.EXAMINE ||
    /\b(surroundings|look around|take in|scan|survey)\b/i.test(lookIntent);
  if (isLookAround && graph && currentNode) {
    const connectedLines: string[] = [];

    const isRegionZone =
      currentNode.type === "zone" &&
      currentNode.is_expandable === true &&
      currentNode.zone_id === currentNode.id;

    if (isRegionZone) {
      // At a geographic region zone: name the settlement hub as a whole unit
      // and list standalone region_locations (dungeons/wilderness).
      // Do NOT list individual sub-locations inside the settlement.
      //
      // Fix 10 — for each region_location, derive a rough compass
      // direction from its grid position relative to the settlement
      // hub. The narrator can then say "to the east, the Hollowborn
      // Breach waits..." rather than naming the place generically.
      const settlementHubNode = Object.values(graph.nodes).find(
        (n) => n.zone_id === currentNode.id && n.is_settlement_node === true
      ) ?? null;
      const hubX = settlementHubNode?.map_position?.x ?? 0;
      const hubY = settlementHubNode?.map_position?.y ?? 0;

      const compass = (n: { map_position?: { x: number; y: number } }): string => {
        const dx = (n.map_position?.x ?? 0) - hubX;
        const dy = (n.map_position?.y ?? 0) - hubY;
        if (dx === 0 && dy === 0) return "nearby";
        // y axis grows downward in our grid, so positive dy = south.
        const ns = Math.abs(dy) > 0.5 ? (dy > 0 ? "south" : "north") : "";
        const ew = Math.abs(dx) > 0.5 ? (dx > 0 ? "east"  : "west")  : "";
        return (ns + ew) || "nearby";
      };

      for (const node of Object.values(graph.nodes)) {
        if (node.id === currentNode.id) continue;
        if (node.zone_id !== currentNode.id) continue;
        if (node.is_settlement_node === true) {
          connectedLines.push(`- ${node.name} (settlement)`);
        } else if (
          node.type === "zone" &&
          node.is_expandable === false
        ) {
          const cat = (node.category ?? "location").toLowerCase();
          connectedLines.push(
            `- ${node.name} (${cat}, to the ${compass(node)})`
          );
        }
      }
    } else if (isInsideDungeon && currentDungeonRoom) {
      // FIX 2C — inside a dungeon room, connected locations are only the
      // adjacent rooms. Do NOT expose the graph connections (region zone,
      // settlement) — the narrator has no business naming the world above.
      for (const connId of currentDungeonRoom.connections) {
        const room = (dungeonRoomNode?.dungeon_rooms ?? []).find((r) => r.id === connId);
        if (room) connectedLines.push(`- ${room.name}`);
      }
    } else {
      for (const connId of currentNode.connections) {
        const node = graph.nodes[connId];
        if (!node) continue;
        connectedLines.push(`- ${node.name}`);
      }
    }

    if (connectedLines.length > 0) {
      prompt +=
        "\n\nCONNECTED LOCATIONS (use these EXACT names when describing what " +
        "the player can see or reach from here):\n" +
        connectedLines.join("\n") +
        "\nWhen the player looks around or asks what is nearby, reference " +
        "ONLY these named locations. Do not invent location names.";
    } else {
      prompt += "\n\nCONNECTED LOCATIONS: none in the graph yet — describe " +
        "the broader environment ambiently without naming specific exits.";
    }

    // NPC reminder for look/examine. Even when npc_ids is empty we want
    // the narrator to know it can't introduce someone new.
    const npcRosterAssets = currentNode.npc_ids
      .map((id) => (locationAssets ?? []).find((a) => a.id === id))
      .filter((a): a is WorldAsset => !!a && a.category === AssetCategory.CHARACTER);
    if (npcRosterAssets.length > 0) {
      prompt +=
        "\n\nNPCs at this location: " +
        npcRosterAssets.map((a) => a.name).join(", ") +
        ". Use these exact names if any are visible to the player.";
    } else {
      prompt += "\n\nNPCs at this location: None — describe ambient crowd " +
        "or solitude only. Do NOT introduce a named character.";
    }
  }

  // EXAMINE / INTERACT — also append the target pinning reminder at the bottom.
  // Day 19C: split the instruction by tier. If the target matches a Tier 1
  // LocationObject (its name appears in the current location asset's
  // key_landmarks), keep the original "object EXISTS, use this exact name"
  // pinning. If it doesn't match, the engine has already confirmed Tier 2
  // missed (the game loop short-circuits on Tier 2 before calling the
  // narrator) — so add the Tier 3 ambient instruction instead.
  if (
    action?.action_type === ActionType.EXAMINE ||
    action?.action_type === ActionType.INTERACT
  ) {
    const target = action.primary_target ?? action.secondary_target ?? "the target";
    const targetLower = target.toLowerCase();

    // Find the current location's world_asset, then its Tier 1 names.
    const currentLocAsset = (locationAssets ?? []).find(
      (a) =>
        a.category === AssetCategory.LOCATION &&
        (a.id === `location_${world_state.current_location_id}` ||
          a.first_seen_location === world_state.current_location_id)
    );
    const tier1Names = (currentLocAsset?.constitution.key_landmarks ?? [])
      .map((n) => n.toLowerCase())
      .filter((n) => n.length > 0);

    const isTier1 = tier1Names.some(
      (n) => targetLower.includes(n) || n.includes(targetLower)
    );

    if (isTier1) {
      prompt += `\n\nINTERACTION TARGET: '${target}'\nThis object EXISTS in the current scene. You described it. Use this exact name when referring to it in your response. Do NOT substitute a synonym, rename it, or question its existence.`;
    } else {
      prompt += `\n\nTIER 3 AMBIENT INTERACTION: The player tried to interact with "${target}". This is not a tracked game asset. Provide a brief atmospheric response of 1-2 sentences. Rules: Do not make this a game asset. Do not say it disappears or did not exist. Do not say the player cannot do this. Describe it as a mundane part of the environment. Keep it consistent with the location's atmosphere.`;
    }
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

  // BUG FIX 3: When the player attempts DIALOGUE at a node with no NPCs,
  // the narrator must NOT invent a respondent. This is the symmetric pair
  // of the NPCS PRESENT block — that one says "only these NPCs"; this one
  // says "no NPCs, so no character to speak".
  if (action?.action_type === ActionType.DIALOGUE && currentNode && currentNode.npc_ids.length === 0) {
    prompt += "\n\nIMPORTANT: There are no named characters at this location. " +
      "If the player speaks using quotes, describe ambient sounds or the " +
      "environment only. Do NOT create a character to respond. The player " +
      "may be talking to themselves, to no one, or to an inanimate object.";
  }

  // FIX 3 (UX 4) — the player named a specific NPC who isn't at this
  // location. The narrator MUST describe that NPC as not present
  // rather than minting a fresh character with that name. The asset
  // (if any) for the named NPC stays canonical somewhere else in the
  // world; we just acknowledge their absence here.
  const namedAbsent = ctx.named_npc_not_present;
  if (typeof namedAbsent === "string" && namedAbsent.trim().length > 0) {
    prompt += `\n\nNAMED NPC NOT PRESENT: The player asked to speak with "${namedAbsent}". ` +
      `That character is NOT at this location. Describe their absence in 1 sentence ` +
      `(e.g. "${namedAbsent} isn't here right now."). Do NOT invent dialogue for them. ` +
      `Do NOT introduce a new character of that name. After the brief absence note, ` +
      `the scene continues normally — describe what is actually around the player.`;
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
