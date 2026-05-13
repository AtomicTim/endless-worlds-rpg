import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Genre } from "@/types/game";
import type { WorldConsistencyDocument } from "@/types/game";

interface RequestBody {
  genre?:             Genre;
  character_name?:    string;
  character_class?:   string;
  creation_choices?:  string;
}

const SYSTEM_PROMPT =
  "You are a world-building engine for a procedurally generated RPG. " +
  "Your job is to generate a World Consistency Document — the absolute facts " +
  "of this world that never change. Every NPC, location, and narrator call " +
  "will be constrained by these facts. Respond ONLY with valid JSON matching " +
  "the schema exactly. No markdown, no code fences, no explanation. Pure JSON only.";

function buildUserPrompt(body: {
  genre:             Genre;
  character_name?:   string;
  character_class?:  string;
  creation_choices?: string;
}): string {
  const ccLine = body.creation_choices
    ? `\nAdditional context: ${body.creation_choices}`
    : "";
  // Day 23.5B — character_name / character_class are now optional. The
  // new wizard fires WCD on genre select (before name/class are chosen)
  // so the WCD generates world identity (species, atmosphere, factions)
  // from genre alone. The world_intro_template {name}/{class} placeholders
  // resolve later in apply-world-bible from the character profile.
  const hasName  = !!body.character_name  && body.character_name.trim().length  > 0;
  const hasClass = !!body.character_class && body.character_class.trim().length > 0;
  const characterLine =
    hasName && hasClass
      ? `Character: ${body.character_name}, a ${body.character_class}.`
      : hasName
        ? `Character: ${body.character_name}.`
        : hasClass
          ? `Character class: ${body.character_class}.`
          : "";
  const headerLine =
    `Generate a World Consistency Document for a ${body.genre} RPG.` +
    (characterLine ? ` ${characterLine}` : "") +
    ccLine;
  return [
    headerLine,
    "",
    "Requirements:",
    "- world_name: a unique evocative name for this world (not Earth)",
    "- world_tagline: one atmospheric sentence capturing the world's essence",
    "- atmosphere: 1-2 sentences of tonal and sensory truth about this world",
    "- world_description: 2-3 sentences describing this world AS A WHOLE — its core premise, what makes it unique, why a player would care. NOT atmospheric prose about one place; this is the world-level summary shown when the player opens the map's World tier. Distinct from atmosphere (sensory/tonal) and from any region's atmosphere.",
    "- landmarks: exactly 5 named landmarks the inhabitants know about. Include: 1 distant threat or evil (north or northeast, grid position 15-20 units from origin), 1 major geographic feature (mountain range, sea, desert, etc.), 1 famous settlement or trade hub (5-10 units from origin), 1 mysterious or legendary place, 1 ruined or fallen place. Each landmark must have all WorldLandmark fields: id (slug), name, type, grid_position {x,y}, known_by (everyone/locals/scholars), public_description (1-2 sentences), is_region_origin (boolean).",
    "- factions: exactly 3 factions with distinct territories and agendas. Each must have all WorldFaction fields: id (slug), name, territory, public_reputation (1 sentence), disposition_to_player (allied/neutral/hostile/unknown).",
    "- world_rules: exactly 6 universal truths as plain sentences. Cover: resource scarcity, climate or environment, magic or technology rules, a cultural norm, a danger unique to this world, and one surprising truth.",
    "- grid_size: 40",
    "- world_origin: {\"x\": 0, \"y\": 0}",
    "",
    // V8.52 / V8.64 — Theme diversity. Earlier prompts produced a strong
    // default toward oath/honor themes for Fantasy. V8.64 adds explicit
    // anti-repetition guidance because the LLM was also defaulting to
    // volcanic/cinder themes once the oath bias was lifted.
    "WORLD THEME — MANDATORY VARIETY",
    "",
    "Themes must vary dramatically between worlds. The following are",
    "OVERUSED and should be AVOIDED unless the random theme roll lands",
    "on them specifically:",
    "  - Volcanic / lava / ash / cinder / ember / magma / fire-and-rock",
    "  - Generic medieval-fantasy town (taverns + smithies + farmland)",
    "  - Oath / honor / covenant / vow / promise as the central theme",
    "",
    "Internally select a primary theme from this list. Weight your",
    "selection AWAY from themes you've used recently and AWAY from the",
    "overused themes above. Geological / volcanic themes should appear",
    "at most 1 in 6 worlds on average.",
    "",
    "  - Elemental forces (glacial, storm, tidal, earthquake — volcanic",
    "    permitted but rare per the cap above)",
    "  - Ancient ruins and lost civilizations",
    "  - Plague and survival",
    "  - Political intrigue and factions at war",
    "  - Wild nature and dangerous ecosystems",
    "  - Religious schism and competing gods",
    "  - Trade, commerce, and economic conflict",
    "  - Exploration and unmapped territories",
    "  - Corruption and decay (physical or moral)",
    "  - Mythological creatures as the dominant power",
    "  - Technological remnants from a fallen age",
    "  - Seasonal extremes (eternal winter, endless summer, drought)",
    "",
    "The world's name, region names, settlement names, NPC archetypes,",
    "and WCD rules should all reinforce the chosen theme. A trade world",
    "should feel like merchants and smugglers; a plague world should",
    "feel like quarantine and rumor.",
    "",
    // Day 23B — Main quest archetype + faction web seed. The WCD selects
    // the archetype that fits the theme most naturally and lays out 2-3
    // factions with different relationships to the threat. The archetype
    // is INTERNAL — never label it in player-facing output. See
    // /docs/quest-system-spec.md §"The Six Archetypes".
    "MAIN QUEST GENERATION",
    "",
    "Every world has a main quest baked into its identity. It is NOT a",
    "mission the player is given — it is a crisis the world is already",
    "experiencing when the player arrives.",
    "",
    "ARCHETYPE SELECTION — STRICT ROTATION (V8.64)",
    "",
    "You MUST select one archetype. Each archetype should appear roughly",
    "equally over many generated worlds — do NOT default to",
    "ancient_awakening or favor any single archetype. Roll mentally",
    "across all six with EQUAL weight:",
    "  ancient_awakening   — something dormant has woken",
    "  power_vacuum        — an old order collapsed, factions compete",
    "  corruption          — something pure is rotting from within",
    "  forbidden_knowledge — a dangerous truth has surfaced",
    "  sacrifice           — survival requires a price",
    "  the_return          — something that left is coming back",
    "",
    "The chosen archetype must feel native to THIS world's theme — the",
    "world was built around it, not the other way around. But do NOT",
    "let 'what fits' bias the selection toward the same archetype",
    "repeatedly. Force variety.",
    "",
    "Generate 2-3 factions with different relationships to the threat:",
    "  defenders  — trying to stop it the 'right' way",
    "  exploiters — see it as an opportunity for power",
    "  deniers    — refuse to acknowledge it or suppress knowledge of it",
    "",
    "Each faction needs id (slug), name, role, and a 1-2 sentence description.",
    "",
    "FINALE TYPE SELECTION (V8.64)",
    "",
    "Select one: confrontation / choice / discovery.",
    "",
    "Do NOT default to confrontation. All three should appear roughly",
    "equally over many worlds. Choose based on what would make the most",
    "surprising and satisfying ending for THIS specific world and threat,",
    "NOT based on archetype affinity. A power_vacuum world doesn't have",
    "to end in choice; an ancient_awakening world doesn't have to end in",
    "confrontation. Variety beats template fit.",
    "",
    "DO NOT label the archetype in any player-facing content. The threat",
    "should feel native to this world, not like a template. The world AS",
    "A WHOLE should read as if this archetype has always been true — its",
    "names, atmosphere, factions, and rules all reinforce the threat.",
    "",
    "Emit a main_quest object alongside the rest of the WCD:",
    '  "main_quest": {',
    '    "archetype": "ancient_awakening",',
    '    "threat_description": "1-2 sentences describing what is happening RIGHT NOW in this world.",',
    '    "factions": [',
    '      { "id": "faction_slug_a", "name": "...", "role": "defenders",  "description": "1-2 sentences" },',
    '      { "id": "faction_slug_b", "name": "...", "role": "exploiters", "description": "1-2 sentences" }',
    '    ],',
    '    "finale_type": "confrontation"',
    '  }',
    "",
    // ── Day 23.5A — Species + damage type aliases ─────────────────────────
    "SPECIES (generate 3-4 total):",
    "",
    "UNIQUENESS REQUIREMENT — critical:",
    "Every species must emerge directly from THIS WCD — specifically",
    "from world_name, atmosphere, world_rules, and the world's",
    "unique threats and history. Two different worlds must produce",
    "genuinely different species even within the same genre. A world",
    "built around metallic veins and resonance must produce species",
    "shaped by that, not by a different world's forests or ruins.",
    "",
    "FORBIDDEN archetypes for world-specific species (recurring",
    "over-generated types to avoid):",
    "- Fantasy: plant/nature-touched folk, shadow elf variants,",
    "  stone dwarf variants, fey-touched bloodlines, dragonborn,",
    "  chosen bloodline races",
    "- Cyberpunk: generic chrome humans, hive-mind corporate workers,",
    "  generic androids or synths",
    "- Horror: half-undead lineages, blessed/cursed bloodlines,",
    "  generic vampire-adjacent or werewolf-adjacent types",
    "- Space Opera: grey aliens, reptilian warrior races,",
    "  hive-mind insectoids",
    "- Post-Apoc: generic ghouls, standard super-mutants,",
    "  generic telepathic psychics",
    "",
    "ANCHOR SPECIES — generate these for every world:",
    "",
    "1. Human (id: \"human\", is_anchor: true, every genre):",
    "   stat_modifiers: {} (humans are the baseline — no modifiers)",
    "   passive_traits: exactly 1 entry, effect_type \"flavor_only\",",
    "     describing human adaptability in THIS world's social",
    "     context. The description must be specific to the WCD",
    "     above — not a generic \"humans are versatile\" template.",
    "   npc_disposition_seed: 0",
    "",
    "2. Genre-common second anchor (is_anchor: true):",
    "   FANTASY: Choose Elf (if WCD has ancient/mystical/arcane/",
    "     forest themes) OR Dwarf (if WCD has underground/craft/",
    "     durability/mining/industrial themes). Pick based on the",
    "     WCD — do not default to Elf every time.",
    "     Elf: stat_modifiers {\"agility\": 1, \"strength\": -1}",
    "     Dwarf: stat_modifiers {\"strength\": 1, \"agility\": -1}",
    "     1 passive trait max.",
    "   CYBERPUNK: Augmented (heavily modified human)",
    "     stat_modifiers {\"strength\": 1, \"agility\": 1, \"intelligence\": -1}",
    "     1 passive trait: effect_type \"combat_passive\" or",
    "     \"environmental\" — tech-interface or physical enhancement.",
    "   HORROR: NO second anchor. Horror requires human",
    "     vulnerability — adding powerful second species undermines",
    "     the genre. Generate 2 world-specific species instead.",
    "   SPACE OPERA: 1 alien type fitting THIS WCD's specific",
    "     stellar environment and world_rules.",
    "     Must have at least 1 negative modifier alongside any positive.",
    "     1 passive trait: environmental or biological adaptation.",
    "   POST-APOC: 1 Mutant type adapted to THIS WCD's specific",
    "     environmental hazard (read world_rules for the hazard).",
    "     stat_modifiers derived from the adaptation — radiation",
    "     world: {\"strength\": 1, \"intelligence\": -1}, toxic world:",
    "     {\"strength\": 1, \"perception\": -1}, heat world:",
    "     {\"strength\": 1, \"agility\": -1}. Match hazard to modifier.",
    "     1 passive trait: resistance or environmental matching hazard.",
    "",
    "WORLD-SPECIFIC SPECIES (1-2 additional; 2 for Horror):",
    "Ask: what long-term environmental or historical pressure",
    "UNIQUE TO THIS WCD would produce a distinct people?",
    "The answer must come from world_name, atmosphere, world_rules,",
    "and threats — not from genre conventions.",
    "",
    "GENRE AESTHETIC CONSTRAINTS for world-specific species",
    "(these are hard limits — violating them breaks genre):",
    "FANTASY:",
    "  Natural or magical origin only.",
    "  No technology, cybernetics, mutations, or corporate history.",
    "CYBERPUNK:",
    "  Technological or corporate-cultural origin only.",
    "  No magic, mystical powers, nature aesthetics, or",
    "  woodland/arcane references.",
    "HORROR:",
    "  Psychological or physical warping from THIS world's specific",
    "  horror source. Emphasize cost and vulnerability.",
    "  No heroic framing, no power fantasy, no chosen-one aesthetics.",
    "  Both world-specific species should feel like something went",
    "  wrong, not like something became stronger.",
    "SPACE OPERA:",
    "  Biological adaptation to THIS world's specific stellar or",
    "  environmental conditions. Scientifically plausible.",
    "  No magic, mysticism, or fantasy aesthetics.",
    "POST-APOC:",
    "  Survival adaptation to THIS world's specific documented hazard.",
    "  Adaptation must match the hazard type — do not apply",
    "  radiation adaptations to a toxin world or vice versa.",
    "",
    "Valid stat keys (use these EXACT strings — no abbreviations):",
    "  strength · agility · charisma · intelligence · perception",
    "",
    "Species JSON shape (ALL fields required):",
    "{",
    '  "id": "<world_slug_or_anchor_id>",',
    '  "name": "<name derived from WCD, not a generic archetype>",',
    '  "description": "<2-3 sentences from WCD atmosphere>",',
    '  "lore_notes": "<1 sentence: how others in this world see them>",',
    '  "is_anchor": <true|false>,',
    '  "stat_modifiers": {"<stat_key>": <integer>},',
    '  "skill_affinities": [],',
    '  "resistances": {},',
    '  "vulnerabilities": {},',
    '  "passive_traits": [',
    "    {",
    '      "id": "<species_id>_<trait_slug>",',
    '      "label": "<2-3 word trait name>",',
    '      "description": "<1 sentence, player-facing>",',
    '      "effect_type": "<TraitEffectType>",',
    '      "effect_data": {}',
    "    }",
    "  ],",
    '  "environmental_flags": [],',
    '  "npc_disposition_seed": <integer -15 to 15>',
    "}",
    "",
    "Constraints:",
    "- passive_traits: MAX 2 per species, MAX 1 for anchor species",
    "- npc_disposition_seed: 0 = neutral/common, +5 to +10 =",
    "  trusted or revered, -5 to -15 = feared or persecuted",
    "- stat_modifiers: world-specific species MUST include at least",
    "  1 negative — meaningful tradeoffs, not pure buffs",
    "- Human always has stat_modifiers: {}",
    "- Use effect_type \"flavor_only\" for traits whose mechanical",
    "  systems are not yet built",
    "",
    "DAMAGE TYPE ALIASES:",
    "",
    "Emit damage_type_aliases[]. Default to [] for most worlds.",
    "Only generate 1-2 aliases when the WCD's world_rules or",
    "atmosphere strongly imply a renamed damage type for this",
    "specific world (e.g. a world where corruption manifests as a",
    "spreading silver mold might alias \"poison\" → \"silver bloom\").",
    "",
    "Schema for each entry:",
    "{",
    '  "canonical_type": "<one of: physical|fire|cold|poison|arcane|',
    '                     holy|shadow|electric|thermal|toxic|emp|',
    '                     viral|psychic|corruption|void|plasma|',
    '                     radiation|sonic|acid>",',
    '  "world_name": "<world-specific display name>",',
    '  "description": "<1 sentence>"',
    "}",
    "",
    "Make it feel original and specific to this genre and character. Avoid generic clichés. Be creative and unexpected.",
  ].join("\n");
}

const VALID_LANDMARK_TYPES = new Set([
  "settlement", "stronghold", "wilderness", "dungeon", "ruin", "geographic",
]);
const VALID_KNOWN_BY = new Set(["everyone", "locals", "scholars"]);
const VALID_DISPOSITIONS = new Set(["allied", "neutral", "hostile", "unknown"]);

// Day 23B — main quest seed validation tables.
const VALID_ARCHETYPES = new Set([
  "ancient_awakening", "power_vacuum", "corruption",
  "forbidden_knowledge", "sacrifice", "the_return",
]);
const VALID_FACTION_ROLES = new Set(["defenders", "exploiters", "deniers"]);
const VALID_FINALE_TYPES = new Set(["confrontation", "choice", "discovery"]);

// Day 23.5A — species + damage-type normalization tables.
const VALID_STAT_KEYS = new Set([
  "strength", "agility", "charisma", "intelligence", "perception",
]);
const VALID_TRAIT_EFFECT_TYPES = new Set([
  "resistance", "skill_boost", "combat_passive",
  "environmental", "social", "regeneration", "flavor_only",
]);
const VALID_ENVIRONMENTAL_FLAGS = new Set([
  "water_breathing", "heat_adapted", "cold_adapted",
  "dark_vision", "toxin_immune", "radiation_resistant", "void_adapted",
]);
const VALID_DAMAGE_TYPES = new Set([
  "physical", "fire", "cold", "poison", "arcane", "holy", "shadow",
  "electric", "thermal", "toxic", "emp", "viral",
  "psychic", "corruption", "void",
  "plasma", "radiation", "sonic",
  "acid",
]);
/** Maps common abbreviations the model emits despite the prompt asking
 *  for full lowercase names. Keys are the abbreviations, values are the
 *  canonical StatKey. CON has no equivalent in the 5-stat system; we
 *  drop it (the species loses the CON modifier) rather than mapping it
 *  arbitrarily. */
const STAT_ABBREVIATIONS: Record<string, string> = {
  STR: "strength", str: "strength",
  AGI: "agility",  agi: "agility",
  CHA: "charisma", cha: "charisma",
  INT: "intelligence", int: "intelligence",
  PER: "perception",   per: "perception",
};

function stripJsonFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

/**
 * Coerce a value that should be an array but might be a plain object
 * (keyed by index or by name) into an actual array.
 * e.g. { "0": {...}, "1": {...} } → [{...}, {...}]
 * e.g. { faction_a: {...}, faction_b: {...} } → [{...}, {...}]
 * A single non-array object is wrapped: { name: "..." } → [{ name: "..." }]
 */
function coerceToArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return null;
  const vals = Object.values(value as Record<string, unknown>);
  // If every value is an object, treat the values as the array items.
  if (vals.length > 0 && vals.every((v) => v !== null && typeof v === "object")) {
    return vals;
  }
  // Otherwise wrap the whole object as a single-element array.
  return [value];
}

/**
 * Pre-validation normalization: derives or defaults ALL mechanical fields
 * that the AI might omit. Creative content (names, descriptions) is never
 * invented here — only structural fields with clear safe defaults.
 */
function normalizeWcd(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const o = parsed as Record<string, unknown>;

  // ── Coerce array fields that the AI sometimes returns as objects ──────────
  // Must run BEFORE the per-item normalization loops below.
  if (!Array.isArray(o.landmarks)) {
    const coerced = coerceToArray(o.landmarks);
    if (coerced) {
      console.warn("[normalizeWcd] landmarks was non-array — coerced to array of", coerced.length);
      o.landmarks = coerced;
    }
  }
  if (!Array.isArray(o.factions)) {
    const coerced = coerceToArray(o.factions);
    if (coerced) {
      console.warn("[normalizeWcd] factions was non-array — coerced to array of", coerced.length);
      o.factions = coerced;
    }
  }
  if (!Array.isArray(o.world_rules)) {
    const coerced = coerceToArray(o.world_rules);
    if (coerced) {
      console.warn("[normalizeWcd] world_rules was non-array — coerced to array of", coerced.length);
      o.world_rules = coerced;
    }
  }

  // Normalize landmarks
  if (Array.isArray(o.landmarks)) {
    o.landmarks = o.landmarks.map((lm: unknown, idx: number) => {
      if (!lm || typeof lm !== "object") return lm;
      const l = { ...(lm as Record<string, unknown>) };

      // Ensure name exists before deriving anything from it
      if (!l.name || typeof l.name !== "string" || !(l.name as string).trim()) {
        l.name = `Unnamed Landmark ${idx + 1}`;
      }

      // Derive id from name if missing
      if (!l.id || typeof l.id !== "string" || !(l.id as string).trim()) {
        l.id = (l.name as string).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      }

      // Default public_description from name if missing
      if (!l.public_description || typeof l.public_description !== "string" || !(l.public_description as string).trim()) {
        // Try alternate field names the AI sometimes uses
        const alt = l.description || l.lore || l.notes;
        l.public_description = (typeof alt === "string" && alt.trim())
          ? alt.trim()
          : `A notable landmark known as ${l.name}.`;
      }

      // Default is_region_origin
      if (typeof l.is_region_origin !== "boolean") {
        l.is_region_origin = false;
      }

      // Default grid_position
      if (!l.grid_position || typeof l.grid_position !== "object") {
        l.grid_position = { x: 0, y: 0 };
      } else {
        const gp = l.grid_position as Record<string, unknown>;
        if (typeof gp.x !== "number") gp.x = 0;
        if (typeof gp.y !== "number") gp.y = 0;
      }

      // Default known_by
      if (!l.known_by || !VALID_KNOWN_BY.has(l.known_by as string)) {
        l.known_by = "everyone";
      }

      // Default type
      if (!l.type || !VALID_LANDMARK_TYPES.has(l.type as string)) {
        l.type = "geographic";
      }

      return l;
    });
  }

  // Normalize factions
  if (Array.isArray(o.factions)) {
    o.factions = o.factions.map((f: unknown, idx: number) => {
      if (!f || typeof f !== "object") return f;
      const faction = { ...(f as Record<string, unknown>) };

      if (!faction.name || typeof faction.name !== "string" || !(faction.name as string).trim()) {
        faction.name = `Unnamed Faction ${idx + 1}`;
      }

      if (!faction.id || typeof faction.id !== "string" || !(faction.id as string).trim()) {
        faction.id = (faction.name as string).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      }

      if (!faction.territory || typeof faction.territory !== "string" || !(faction.territory as string).trim()) {
        faction.territory = "Unknown territory";
      }

      if (!faction.public_reputation || typeof faction.public_reputation !== "string" || !(faction.public_reputation as string).trim()) {
        const alt = faction.reputation || faction.description || faction.notes;
        faction.public_reputation = (typeof alt === "string" && alt.trim())
          ? alt.trim()
          : `The ${faction.name} are a faction of unknown reputation.`;
      }

      if (!faction.disposition_to_player || !VALID_DISPOSITIONS.has(faction.disposition_to_player as string)) {
        faction.disposition_to_player = "neutral";
      }

      return faction;
    });
  }

  // Day 23B — main_quest seed normalization. The WCD prompt asks for
  // archetype + factions + finale_type. Missing pieces get safe defaults
  // (ancient_awakening / confrontation) so the WB still has something to
  // expand. Per-faction defaults mirror the landmark/faction loops above.
  if (o.main_quest && typeof o.main_quest === "object" && !Array.isArray(o.main_quest)) {
    const mq = o.main_quest as Record<string, unknown>;
    if (typeof mq.archetype !== "string" || !VALID_ARCHETYPES.has(mq.archetype as string)) {
      console.warn(`[normalizeWcd] main_quest.archetype invalid (${String(mq.archetype)}) — defaulting to "ancient_awakening".`);
      mq.archetype = "ancient_awakening";
    }
    if (typeof mq.threat_description !== "string" || !(mq.threat_description as string).trim()) {
      mq.threat_description = "Something is happening in this world that demands attention.";
    }
    if (typeof mq.finale_type !== "string" || !VALID_FINALE_TYPES.has(mq.finale_type as string)) {
      console.warn(`[normalizeWcd] main_quest.finale_type invalid (${String(mq.finale_type)}) — defaulting to "confrontation".`);
      mq.finale_type = "confrontation";
    }
    if (!Array.isArray(mq.factions)) {
      const coerced = coerceToArray(mq.factions);
      mq.factions = coerced ?? [];
    }
    mq.factions = (mq.factions as unknown[]).map((f, idx) => {
      if (!f || typeof f !== "object") return f;
      const faction = { ...(f as Record<string, unknown>) };
      if (typeof faction.name !== "string" || !(faction.name as string).trim()) {
        faction.name = `Quest Faction ${idx + 1}`;
      }
      if (typeof faction.id !== "string" || !(faction.id as string).trim()) {
        faction.id = (faction.name as string).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      }
      if (typeof faction.role !== "string" || !VALID_FACTION_ROLES.has(faction.role as string)) {
        // Cycle the default roles so 2-3 factions auto-cover the web when
        // the AI emits malformed entries.
        const roleCycle = ["defenders", "exploiters", "deniers"];
        faction.role = roleCycle[idx % roleCycle.length];
      }
      if (typeof faction.description !== "string" || !(faction.description as string).trim()) {
        faction.description = `The ${faction.name} have a stake in the world's crisis.`;
      }
      return faction;
    });
  }

  // Day 23.5A — species normalization. Coerce object-shaped inputs to
  // arrays, slug-default missing ids, fill required scalar fields with
  // safe defaults, and remap stat_modifier abbreviations to canonical
  // stat keys. Returned in canonical Species shape so the validator
  // below has a stable target.
  if (!Array.isArray(o.species)) {
    const coerced = coerceToArray(o.species);
    if (coerced) {
      o.species = coerced;
    } else {
      o.species = [];
    }
  }
  o.species = (o.species as unknown[]).map((s, idx) => {
    if (!s || typeof s !== "object") return s;
    const sp = { ...(s as Record<string, unknown>) };

    if (typeof sp.name !== "string" || !(sp.name as string).trim()) {
      sp.name = `Species ${idx + 1}`;
    }
    if (typeof sp.id !== "string" || !(sp.id as string).trim()) {
      sp.id = (sp.name as string).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    }
    if (typeof sp.description !== "string") sp.description = "";
    if (typeof sp.lore_notes  !== "string") sp.lore_notes  = "";
    if (typeof sp.is_anchor   !== "boolean") sp.is_anchor   = false;

    // stat_modifiers — remap abbreviations + drop unknown keys.
    const rawMods = (sp.stat_modifiers && typeof sp.stat_modifiers === "object")
      ? (sp.stat_modifiers as Record<string, unknown>)
      : {};
    const cleanedMods: Record<string, number> = {};
    for (const [rawKey, rawVal] of Object.entries(rawMods)) {
      const mapped = STAT_ABBREVIATIONS[rawKey] ?? rawKey.toLowerCase();
      if (!VALID_STAT_KEYS.has(mapped)) continue;
      if (typeof rawVal !== "number" || !Number.isFinite(rawVal)) continue;
      cleanedMods[mapped] = Math.trunc(rawVal);
    }
    sp.stat_modifiers = cleanedMods;

    if (!Array.isArray(sp.skill_affinities))   sp.skill_affinities   = [];
    if (!sp.resistances     || typeof sp.resistances     !== "object") sp.resistances     = {};
    if (!sp.vulnerabilities || typeof sp.vulnerabilities !== "object") sp.vulnerabilities = {};
    if (!Array.isArray(sp.passive_traits))     sp.passive_traits     = [];
    sp.passive_traits = (sp.passive_traits as unknown[]).map((t, tIdx) => {
      if (!t || typeof t !== "object") return t;
      const tr = { ...(t as Record<string, unknown>) };
      if (typeof tr.label === "string" && tr.label && (typeof tr.id !== "string" || !(tr.id as string).trim())) {
        tr.id = `${sp.id}_${(tr.label as string).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
      }
      if (typeof tr.id !== "string" || !(tr.id as string).trim()) {
        tr.id = `${sp.id}_trait_${tIdx + 1}`;
      }
      if (typeof tr.label       !== "string") tr.label       = "Trait";
      if (typeof tr.description !== "string") tr.description = "";
      if (typeof tr.effect_type !== "string" || !VALID_TRAIT_EFFECT_TYPES.has(tr.effect_type as string)) {
        tr.effect_type = "flavor_only";
      }
      if (!tr.effect_data || typeof tr.effect_data !== "object") tr.effect_data = {};
      return tr;
    });
    if (!Array.isArray(sp.environmental_flags)) sp.environmental_flags = [];
    sp.environmental_flags = (sp.environmental_flags as unknown[])
      .filter((f) => typeof f === "string" && VALID_ENVIRONMENTAL_FLAGS.has(f as string));
    if (typeof sp.npc_disposition_seed !== "number" || !Number.isFinite(sp.npc_disposition_seed)) {
      sp.npc_disposition_seed = 0;
    } else {
      const n = Math.trunc(sp.npc_disposition_seed as number);
      sp.npc_disposition_seed = Math.max(-15, Math.min(15, n));
    }

    return sp;
  });

  // damage_type_aliases normalization. Default to [] when missing; drop
  // entries whose canonical_type isn't in the canonical set.
  if (!Array.isArray(o.damage_type_aliases)) {
    o.damage_type_aliases = [];
  }
  o.damage_type_aliases = (o.damage_type_aliases as unknown[])
    .filter((a) => {
      if (!a || typeof a !== "object") return false;
      const al = a as Record<string, unknown>;
      return (
        typeof al.canonical_type === "string" &&
        VALID_DAMAGE_TYPES.has(al.canonical_type as string) &&
        typeof al.world_name === "string" &&
        (al.world_name as string).trim().length > 0
      );
    })
    .map((a) => {
      const al = { ...(a as Record<string, unknown>) };
      if (typeof al.description !== "string") al.description = "";
      return al;
    });

  // Ensure grid_size
  if (typeof o.grid_size !== "number") {
    o.grid_size = 40;
  }

  // Ensure world_origin
  if (!o.world_origin || typeof o.world_origin !== "object") {
    o.world_origin = { x: 0, y: 0 };
  } else {
    const wo = o.world_origin as Record<string, unknown>;
    if (typeof wo.x !== "number") wo.x = 0;
    if (typeof wo.y !== "number") wo.y = 0;
  }

  return o;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function validateLandmark(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return "landmark is not an object";
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return "landmark.id missing";
  if (typeof o.name !== "string" || !o.name.trim()) return "landmark.name missing";
  if (typeof o.type !== "string" || !VALID_LANDMARK_TYPES.has(o.type)) return `landmark.type invalid: ${String(o.type)}`;
  const gp = o.grid_position as Record<string, unknown> | undefined;
  if (!gp || !isFiniteNumber(gp.x) || !isFiniteNumber(gp.y)) return "landmark.grid_position invalid";
  if (typeof o.known_by !== "string" || !VALID_KNOWN_BY.has(o.known_by)) return `landmark.known_by invalid: ${String(o.known_by)}`;
  if (typeof o.public_description !== "string" || !o.public_description.trim()) return "landmark.public_description missing";
  if (typeof o.is_region_origin !== "boolean") return "landmark.is_region_origin missing";
  return null;
}

function validateFaction(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return "faction is not an object";
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return "faction.id missing";
  if (typeof o.name !== "string" || !o.name.trim()) return "faction.name missing";
  if (typeof o.territory !== "string" || !o.territory.trim()) return "faction.territory missing";
  if (typeof o.public_reputation !== "string" || !o.public_reputation.trim()) return "faction.public_reputation missing";
  if (typeof o.disposition_to_player !== "string" || !VALID_DISPOSITIONS.has(o.disposition_to_player)) {
    return `faction.disposition_to_player invalid: ${String(o.disposition_to_player)}`;
  }
  return null;
}

function validateWcd(parsed: unknown): { ok: true; wcd: WorldConsistencyDocument } | { ok: false; error: string } {
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "WCD is not an object" };
  const o = parsed as Record<string, unknown>;

  if (typeof o.world_name !== "string" || !o.world_name.trim()) return { ok: false, error: "world_name missing" };
  if (typeof o.world_tagline !== "string" || !o.world_tagline.trim()) return { ok: false, error: "world_tagline missing" };
  if (typeof o.atmosphere !== "string" || !o.atmosphere.trim()) return { ok: false, error: "atmosphere missing" };

  if (!Array.isArray(o.landmarks) || o.landmarks.length < 3) {
    return { ok: false, error: `landmarks must be array of at least 3 (got ${Array.isArray(o.landmarks) ? o.landmarks.length : "non-array"})` };
  }
  for (let i = 0; i < o.landmarks.length; i++) {
    const err = validateLandmark(o.landmarks[i]);
    if (err) return { ok: false, error: `landmarks[${i}]: ${err}` };
  }

  if (!Array.isArray(o.factions) || o.factions.length < 2) {
    return { ok: false, error: `factions must be array of at least 2 (got ${Array.isArray(o.factions) ? o.factions.length : "non-array"})` };
  }
  for (let i = 0; i < o.factions.length; i++) {
    const err = validateFaction(o.factions[i]);
    if (err) return { ok: false, error: `factions[${i}]: ${err}` };
  }

  if (!Array.isArray(o.world_rules) || o.world_rules.length < 3) {
    return { ok: false, error: `world_rules must be array of at least 3 (got ${Array.isArray(o.world_rules) ? o.world_rules.length : "non-array"})` };
  }
  for (let i = 0; i < o.world_rules.length; i++) {
    if (typeof o.world_rules[i] !== "string" || !(o.world_rules[i] as string).trim()) {
      return { ok: false, error: `world_rules[${i}] is not a non-empty string` };
    }
  }

  if (!isFiniteNumber(o.grid_size)) return { ok: false, error: "grid_size must be a number" };

  const wo = o.world_origin as Record<string, unknown> | undefined;
  if (!wo || !isFiniteNumber(wo.x) || !isFiniteNumber(wo.y)) {
    return { ok: false, error: "world_origin must have numeric x and y" };
  }

  return { ok: true, wcd: parsed as WorldConsistencyDocument };
}

// V8.69 — revert to sonnet + raise max_tokens to 4000.
// V8.68 switched the model to haiku and left max_tokens at 2000.
// Haiku truncated the WCD JSON before it finished emitting all
// required fields (factions[], main_quest seed, world_rules), so
// every new-game creation 500'd at the WCD layer.
//
// Sonnet handles the structured WCD output cleanly. 4000 tokens
// gives headroom for future schema additions (e.g. Day 23.5
// species generation) without hitting the cap again.
const WCD_MODEL      = "claude-sonnet-4-5";
const WCD_MAX_TOKENS = 4000;

async function callClaude(client: Anthropic, userPrompt: string): Promise<string> {
  const promptTokens = Math.ceil((SYSTEM_PROMPT.length + userPrompt.length) / 4);
  console.log(
    `[GEN_TIMING] generate-wcd start — model: ${WCD_MODEL}, prompt_tokens: ${promptTokens}`
  );
  const startedAt = Date.now();
  const message = await client.messages.create({
    model:      WCD_MODEL,
    max_tokens: WCD_MAX_TOKENS,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: "user", content: userPrompt }],
  });
  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  const outputTokens = message.usage?.output_tokens ?? Math.ceil(text.length / 4);
  const elapsed = Date.now() - startedAt;
  console.log(
    `[GEN_TIMING] generate-wcd complete — elapsed: ${elapsed}ms, output_tokens: ${outputTokens}`
  );
  return text;
}

export async function POST(request: NextRequest) {
  console.log("[GEN_TIMING] generate-wcd called");
  console.log("[GEN_TIMING] generate-wcd using sonnet model");
  console.log(`[GEN_TIMING] generate-wcd max_tokens: ${WCD_MAX_TOKENS}`);
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { genre, character_name, character_class, creation_choices } = body;
  if (!genre) {
    return NextResponse.json(
      { error: "Missing required field: genre" },
      { status: 400 }
    );
  }
  if (!Object.values(Genre).includes(genre)) {
    return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
  }

  // Day 23.5B — character_name / character_class are now optional. The
  // new wizard fires WCD on genre select. buildUserPrompt omits the
  // character line when neither field is provided.
  const userPrompt = buildUserPrompt({
    genre,
    character_name,
    character_class,
    creation_choices,
  });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let parsed: unknown;
  let parseError = "";
  try {
    const rawText = await callClaude(anthropic, userPrompt);
    try {
      parsed = JSON.parse(stripJsonFences(rawText));
    } catch (err) {
      parseError = err instanceof Error ? err.message : "JSON parse failed";
      const retryPrompt = userPrompt + "\n\nReturn ONLY the JSON object, nothing else. No markdown.";
      const retryRaw = await callClaude(anthropic, retryPrompt);
      try {
        parsed = JSON.parse(stripJsonFences(retryRaw));
      } catch (retryErr) {
        const retryParseErr = retryErr instanceof Error ? retryErr.message : "JSON parse failed (retry)";
        return NextResponse.json(
          { error: "Failed to parse WCD JSON after retry", first: parseError, retry: retryParseErr },
          { status: 500 }
        );
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Anthropic call failed" },
      { status: 500 }
    );
  }

  const normalized = normalizeWcd(parsed);
  const validated = validateWcd(normalized);
  if (!validated.ok) {
    return NextResponse.json(
      { error: `WCD validation failed: ${validated.error}` },
      { status: 400 }
    );
  }

  // Day 23B — surface the main quest seed in logs so a missing archetype or
  // empty faction array shows up at the WCD layer instead of waiting for
  // the WorldBible expansion to fail.
  const mqLog = validated.wcd.main_quest;
  if (mqLog) {
    console.log(
      `[WCD] Generated: ${validated.wcd.world_name} | main_quest: ${mqLog.archetype}, ` +
      `${mqLog.factions.length} factions, finale: ${mqLog.finale_type}`
    );
  } else {
    console.log(`[WCD] Generated: ${validated.wcd.world_name} | main_quest: <missing — WB will run with default>`);
  }
  // Day 23.5A — species + damage_type_aliases data point. Surfaces at the
  // WCD layer so a missing/empty species array is visible immediately
  // (the character creation UI in 23.5B reads from metadata.species and
  // breaks silently when empty).
  const speciesCount   = validated.wcd.species?.length ?? 0;
  const aliasCount     = validated.wcd.damage_type_aliases?.length ?? 0;
  const speciesNames   = (validated.wcd.species ?? []).map((s) => s.name).join(", ");
  console.log(
    `[WCD] Species count: ${speciesCount}, damage_type_aliases: ${aliasCount}` +
    (speciesCount > 0 ? ` | species: ${speciesNames}` : "")
  );
  return NextResponse.json({ wcd: validated.wcd });
}
