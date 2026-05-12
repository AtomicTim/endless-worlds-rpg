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

function buildUserPrompt(body: Required<Omit<RequestBody, "creation_choices">> & { creation_choices?: string }): string {
  const ccLine = body.creation_choices
    ? `\nAdditional context: ${body.creation_choices}`
    : "";
  return [
    `Generate a World Consistency Document for a ${body.genre} RPG. Character: ${body.character_name}, a ${body.character_class}.${ccLine}`,
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
    // V8.52 — Theme diversity instruction. Earlier prompts (pre-V8.52)
    // produced a strong default toward oath / honor / covenant / vow
    // themes for Fantasy. The WorldBible-level fix (ad82300) addressed
    // the bible layer; this block addresses the WCD that seeds it.
    "THEME DIVERSITY REQUIREMENT",
    "",
    "Every world must have a distinctly different thematic foundation.",
    "Do NOT default to oath, honor, covenant, vow, or promise themes",
    "unless they emerge organically from a randomly selected concept.",
    "",
    "Before generating, internally select a primary theme from this list",
    "(rotate through them — do not repeat the same theme twice in a row):",
    "  - Elemental forces (volcanic, glacial, storm, tidal, earthquake)",
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
    "  - Seasonal extremes (eternal winter, endless summer, etc.)",
    "",
    "The world's name, region names, settlement names, NPC archetypes,",
    "and WCD rules should all reinforce the chosen theme. A volcanic",
    "world should feel like fire and survival. A trade world should",
    "feel like merchants and smugglers. Oath-breaking and honor are ONE",
    "theme on this list — do not let them bleed into other themes.",
    "",
    "Make it feel original and specific to this genre and character. Avoid generic clichés. Be creative and unexpected.",
  ].join("\n");
}

const VALID_LANDMARK_TYPES = new Set([
  "settlement", "stronghold", "wilderness", "dungeon", "ruin", "geographic",
]);
const VALID_KNOWN_BY = new Set(["everyone", "locals", "scholars"]);
const VALID_DISPOSITIONS = new Set(["allied", "neutral", "hostile", "unknown"]);

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

async function callClaude(client: Anthropic, userPrompt: string): Promise<string> {
  const message = await client.messages.create({
    model:      "claude-sonnet-4-5",
    max_tokens: 2000,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: "user", content: userPrompt }],
  });
  return message.content[0]?.type === "text" ? message.content[0].text : "";
}

export async function POST(request: NextRequest) {
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
  if (!genre || !character_name || !character_class) {
    return NextResponse.json(
      { error: "Missing required fields: genre, character_name, character_class" },
      { status: 400 }
    );
  }
  if (!Object.values(Genre).includes(genre)) {
    return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
  }

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

  console.log(`[WCD] Generated: ${validated.wcd.world_name}`);
  return NextResponse.json({ wcd: validated.wcd });
}
