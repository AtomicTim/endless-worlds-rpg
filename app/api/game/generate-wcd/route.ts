import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Genre } from "@/types/game";
import type { WorldConsistencyDocument } from "@/types/game";

/**
 * Day 19A — Generate the World Consistency Document.
 *
 * Layer 0 of the new generation architecture. A single Claude call produces
 * the world's absolute facts: name, atmosphere, landmarks, factions, and
 * universal rules. Stored in masterState.metadata.world_consistency and
 * injected into every subsequent AI prompt.
 *
 * One retry on parse failure. Validation enforces required fields and
 * exact array lengths (5 landmarks, 3 factions, 6 rules) per the
 * world-generation-architecture spec.
 */

interface RequestBody {
  genre?:             Genre;
  character_name?:    string;
  character_class?:   string;
  /** Optional extra context from the character creation wizard. */
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
    "- landmarks: exactly 5 named landmarks the inhabitants know about. Include: 1 distant threat or evil (north or northeast, grid position 15-20 units from origin), 1 major geographic feature (mountain range, sea, desert, etc.), 1 famous settlement or trade hub (5-10 units from origin), 1 mysterious or legendary place, 1 ruined or fallen place. Each landmark must have all WorldLandmark fields.",
    "- factions: exactly 3 factions with distinct territories and agendas. Each must have all WorldFaction fields.",
    "- world_rules: exactly 6 universal truths as plain sentences. Cover: resource scarcity, climate or environment, magic or technology rules, a cultural norm, a danger unique to this world, and one surprising truth.",
    "- grid_size: 40",
    "- world_origin: x 0, y 0",
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

  if (!Array.isArray(o.landmarks) || o.landmarks.length !== 5) {
    return { ok: false, error: `landmarks must be array of exactly 5 (got ${Array.isArray(o.landmarks) ? o.landmarks.length : "non-array"})` };
  }
  for (let i = 0; i < o.landmarks.length; i++) {
    const err = validateLandmark(o.landmarks[i]);
    if (err) return { ok: false, error: `landmarks[${i}]: ${err}` };
  }

  if (!Array.isArray(o.factions) || o.factions.length !== 3) {
    return { ok: false, error: `factions must be array of exactly 3 (got ${Array.isArray(o.factions) ? o.factions.length : "non-array"})` };
  }
  for (let i = 0; i < o.factions.length; i++) {
    const err = validateFaction(o.factions[i]);
    if (err) return { ok: false, error: `factions[${i}]: ${err}` };
  }

  if (!Array.isArray(o.world_rules) || o.world_rules.length !== 6) {
    return { ok: false, error: `world_rules must be array of exactly 6 (got ${Array.isArray(o.world_rules) ? o.world_rules.length : "non-array"})` };
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
    model:      "claude-sonnet-4-20250514",
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

  // Per-request client so the API key is read fresh from process.env.
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let parsed: unknown;
  let parseError = "";
  try {
    const rawText = await callClaude(anthropic, userPrompt);
    try {
      parsed = JSON.parse(stripJsonFences(rawText));
    } catch (err) {
      parseError = err instanceof Error ? err.message : "JSON parse failed";
      // One retry with stricter instruction.
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

  const validated = validateWcd(parsed);
  if (!validated.ok) {
    return NextResponse.json(
      { error: `WCD validation failed: ${validated.error}` },
      { status: 400 }
    );
  }

  console.log(`[WCD] Generated: ${validated.wcd.world_name}`);
  return NextResponse.json({ wcd: validated.wcd });
}
