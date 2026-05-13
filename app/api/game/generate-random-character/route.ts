import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Genre } from "@/types/game";
import type {
  AppearanceProfile,
  OriginChoice,
  Species,
  StartingBonus,
} from "@/types/game";
import { BACKGROUND_CONFIGS } from "@/lib/game/starting-equipment";

/**
 * Day 23.5B — Random character generator (Random mode).
 *
 * Returns a complete, coherent PlayerCharacter shell: name, gender,
 * species, class, origin, appearance, motivation. All fields should
 * feel like the same person.
 *
 * On failure the client falls back to the GUIDED step-by-step flow.
 */

const MODEL      = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 700;

interface RequestBody {
  genre?:           Genre;
  wcd_world_name?:  string;
  species_options?: Species[];
}

interface GeneratedCharacter {
  name:       string;
  gender:     "male" | "female";
  species_id: string;
  class_id:   string;
  origin:     OriginChoice;
  appearance: AppearanceProfile;
  motivation: string;
}

const SYSTEM_PROMPT =
  "You generate a complete coherent RPG character — every field should " +
  "feel like the same person. Respond ONLY with valid JSON. No markdown, " +
  "no code fences, no explanation.";

function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

function sanitizeName(raw: string): string {
  const cleaned = raw.replace(/^["'\s]+|["'\s]+$/g, "");
  const filtered = cleaned.replace(/[^a-zA-Z0-9\-' ]/g, "").trim();
  return filtered.slice(0, 24);
}

function buildPrompt(
  genre:       Genre,
  worldName:   string,
  speciesList: Species[],
  classIds:    string[]
): string {
  const speciesBlock = speciesList
    .map((s) => `  - ${s.name} (id: ${s.id})`)
    .join("\n");
  const classBlock = classIds.map((c) => `  - ${c}`).join("\n");
  return [
    `Generate exactly 1 complete character for a ${genre} RPG set in the world of ${worldName}.`,
    "",
    "Pick one species from the available list, one class from the class list,",
    "then build a coherent person around those choices. Name, gender, origin,",
    "appearance, and motivation should all feel like the same character.",
    "",
    "Available species (pick exactly one — use its id as species_id):",
    speciesBlock,
    "",
    "Available classes (pick exactly one — use its id as class_id):",
    classBlock,
    "",
    "RULES:",
    "- name: 2-24 chars, letters/hyphens/apostrophes, no titles, no epithets.",
    "- gender: \"male\" or \"female\".",
    "- origin.starting_bonus: type \"item\" OR \"gold\" (NEVER stat bonuses).",
    "  item bonus: name + 1-sentence description (better gear than class default).",
    "  gold bonus: 15-25 gold.",
    "- appearance.descriptors: exactly 3 short trait phrases.",
    "- appearance.summary: 1 sentence.",
    "  IMPORTANT: appearance.summary must NEVER include the character's",
    "  name — even though `name` is in the same JSON object. Write it",
    "  as an objective physical description that works for any name:",
    "    GOOD: 'A lean woman with faint glowing marks along her collarbone.'",
    "    BAD:  'Kess is a lean woman with faint glowing marks...'",
    "  The summary must be name-agnostic — the player can change their",
    "  name independently of the appearance.",
    "- motivation: 1 sentence — why this character is here, what they want.",
    "- origin.description: 1-2 sentences.",
    "- origin.label: 2-3 words.",
    "",
    "Output JSON ONLY in this exact shape:",
    "{",
    '  "name": "<Name>",',
    '  "gender": "male" | "female",',
    '  "species_id": "<one of the provided species ids>",',
    '  "class_id": "<one of the provided class ids>",',
    '  "origin": {',
    '    "id": "<class_id>_random",',
    '    "label": "<2-3 word label>",',
    '    "description": "<1-2 sentences>",',
    '    "starting_bonus": {',
    '      "type": "item" | "gold",',
    '      "item_name": "<name if item>",',
    '      "item_description": "<1 sentence if item>",',
    '      "gold_amount": <number 15-25 if gold>',
    "    }",
    "  },",
    '  "appearance": {',
    '    "descriptors": ["<trait>", "<trait>", "<trait>"],',
    '    "summary": "<1 sentence>"',
    "  },",
    '  "motivation": "<1 sentence>"',
    "}",
  ].join("\n");
}

function normalizeBonus(raw: unknown): StartingBonus | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = o.type === "gold" ? "gold" : o.type === "item" ? "item" : null;
  if (!type) return null;
  if (type === "gold") {
    const amt = typeof o.gold_amount === "number" ? Math.round(o.gold_amount) : 0;
    if (amt <= 0) return null;
    return { type: "gold", gold_amount: amt };
  }
  const itemName = typeof o.item_name === "string" ? o.item_name.trim() : "";
  if (!itemName) return null;
  const itemDesc =
    typeof o.item_description === "string" ? o.item_description.trim() : "";
  return { type: "item", item_name: itemName, item_description: itemDesc };
}

function normalizeCharacter(
  raw:          unknown,
  classIds:     string[],
  speciesIds:   string[]
): GeneratedCharacter | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const name = typeof o.name === "string" ? sanitizeName(o.name) : "";
  if (name.length < 2) return null;

  const gender =
    o.gender === "male" || o.gender === "female" ? o.gender : null;
  if (!gender) return null;

  const speciesId = typeof o.species_id === "string" ? o.species_id.trim() : "";
  if (!speciesId || !speciesIds.includes(speciesId)) return null;

  const classId = typeof o.class_id === "string" ? o.class_id.trim() : "";
  if (!classId || !classIds.includes(classId)) return null;

  const originRaw = o.origin as Record<string, unknown> | undefined;
  if (!originRaw) return null;
  const originLabel = typeof originRaw.label === "string" ? originRaw.label.trim() : "";
  const originDesc = typeof originRaw.description === "string" ? originRaw.description.trim() : "";
  const bonus = normalizeBonus(originRaw.starting_bonus);
  if (!originLabel || !originDesc || !bonus) return null;
  const originId =
    typeof originRaw.id === "string" && originRaw.id.trim().length > 0
      ? originRaw.id.trim()
      : `${classId}_random`;

  const appearanceRaw = o.appearance as Record<string, unknown> | undefined;
  if (!appearanceRaw) return null;
  const descRaw = Array.isArray(appearanceRaw.descriptors)
    ? appearanceRaw.descriptors
    : [];
  const descriptors = descRaw
    .filter((d): d is string => typeof d === "string")
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
  let summary =
    typeof appearanceRaw.summary === "string" ? appearanceRaw.summary.trim() : "";
  // Defense-in-depth — even with the explicit prompt rule, the model can
  // slip the character's name into the summary when it generates name and
  // appearance in the same JSON. Strip a leading "<Name> is " / "<Name>, "
  // pattern when present so the saved summary stays name-agnostic.
  if (name && summary.toLowerCase().startsWith(name.toLowerCase())) {
    const rest = summary.slice(name.length).trimStart();
    summary = rest
      .replace(/^(is|was|appears|stands|stood|seems|seemed|looks|looked)\s+/i, "")
      .replace(/^[,–—-]\s*/, "")
      .replace(/^\s*[a-z]/, (m) => m.toUpperCase())
      .trim();
  }
  if (descriptors.length === 0 || !summary) return null;

  const motivation = typeof o.motivation === "string" ? o.motivation.trim() : "";
  if (!motivation) return null;

  return {
    name,
    gender,
    species_id: speciesId,
    class_id:   classId,
    origin: {
      id:             originId,
      label:          originLabel,
      description:    originDesc,
      starting_bonus: bonus,
    },
    appearance: { descriptors, summary },
    motivation,
  };
}

export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { genre, wcd_world_name, species_options } = body;
  if (!genre || !Array.isArray(species_options) || species_options.length === 0) {
    return NextResponse.json(
      { error: "Missing required fields: genre, species_options" },
      { status: 400 }
    );
  }
  if (!Object.values(Genre).includes(genre)) {
    return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
  }

  const worldName = (wcd_world_name ?? "").trim() || "this world";
  const classIds = Object.keys(BACKGROUND_CONFIGS[genre] ?? {});
  if (classIds.length === 0) {
    return NextResponse.json(
      { error: `No classes configured for genre ${genre}` },
      { status: 500 }
    );
  }
  const speciesIds = species_options
    .map((s) => (typeof s?.id === "string" ? s.id : ""))
    .filter((id) => id.length > 0);
  if (speciesIds.length === 0) {
    return NextResponse.json(
      { error: "No valid species ids in species_options" },
      { status: 400 }
    );
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const t0 = Date.now();
  let rawText = "";
  try {
    const resp = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildPrompt(genre, worldName, species_options, classIds),
        },
      ],
    });
    const block = resp.content.find((b) => b.type === "text");
    rawText = block?.type === "text" ? block.text : "";
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Anthropic call failed" },
      { status: 500 }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawText));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "JSON parse failed" },
      { status: 500 }
    );
  }

  const character = normalizeCharacter(parsed, classIds, speciesIds);
  if (!character) {
    return NextResponse.json(
      { error: "Generated character failed validation" },
      { status: 500 }
    );
  }

  console.log(
    `[generate-random-character] ${genre}/${character.species_id}/${character.class_id} → "${character.name}" in ${Date.now() - t0}ms`
  );
  return NextResponse.json({ character });
}
