import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Genre } from "@/types/game";
import type { OriginChoice, StartingBonus } from "@/types/game";

/**
 * Day 23.5B — Origin generator.
 *
 * Generates 3 distinct origin options for a given (genre, class, world)
 * combo. Each option grants either a small item upgrade or a modest
 * gold bonus — NO stat bonuses. The character creation UI shows these
 * as tap cards after the class step.
 *
 * Failures are non-blocking: client falls back to the class default
 * starting item when this route returns { error }.
 */

const MODEL       = "claude-haiku-4-5-20251001";
const MAX_TOKENS  = 600;

interface RequestBody {
  genre?:           Genre;
  class_id?:        string;
  wcd_world_name?:  string;
}

const SYSTEM_PROMPT =
  "You generate origin options for an RPG character creation flow. " +
  "Each option is a short biographical hook plus a small starting bonus " +
  "(either an item upgrade or a modest amount of gold — NEVER stat bonuses). " +
  "Respond ONLY with valid JSON. No markdown, no code fences, no explanation.";

function buildPrompt(genre: Genre, classId: string, worldName: string): string {
  return [
    `Generate exactly 3 origin options for a ${genre} ${classId} in the world of ${worldName}.`,
    "",
    "Each option must feel like a different kind of person — not three",
    "variations on the same archetype. Vary background, motivation,",
    "and life path.",
    "",
    "CRITICAL RULES:",
    "- NO stat bonuses ever. starting_bonus is item OR gold only.",
    "- Item bonus: a small upgrade from the class default — a better",
    "  weapon tier, a useful tool, a consumable pack. Must be something",
    "  THIS class would plausibly carry.",
    "- Gold bonus: +15 to +25 gold. Suits mercantile or opportunist origins.",
    "- Descriptions are 1-2 sentences max.",
    "- Labels are 2-3 words.",
    "",
    "Output JSON ONLY in this exact shape (no preamble, no markdown):",
    "{",
    '  "options": [',
    "    {",
    `      "id": "${classId}_<origin_slug>",`,
    '      "label": "<2-3 word label>",',
    '      "description": "<1-2 sentences>",',
    '      "starting_bonus": {',
    '        "type": "item" | "gold",',
    '        "item_name": "<name if type=item>",',
    '        "item_description": "<1 sentence if type=item>",',
    '        "gold_amount": <number 15-25 if type=gold>',
    "      }",
    "    }",
    "  ]",
    "}",
    "",
    "Return exactly 3 options. No more, no fewer.",
  ].join("\n");
}

function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
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

function normalizeOption(raw: unknown, classId: string, index: number): OriginChoice | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === "string" ? o.label.trim() : "";
  const description = typeof o.description === "string" ? o.description.trim() : "";
  if (!label || !description) return null;
  const bonus = normalizeBonus(o.starting_bonus);
  if (!bonus) return null;
  const rawId = typeof o.id === "string" ? o.id.trim() : "";
  const id = rawId.length > 0
    ? rawId
    : `${classId}_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}_${index}`;
  return { id, label, description, starting_bonus: bonus };
}

export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { genre, class_id, wcd_world_name } = body;
  if (!genre || !class_id) {
    return NextResponse.json(
      { error: "Missing required fields: genre, class_id" },
      { status: 400 }
    );
  }
  if (!Object.values(Genre).includes(genre)) {
    return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
  }

  const worldName = (wcd_world_name ?? "").trim() || "this world";

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const t0 = Date.now();
  let rawText = "";
  try {
    const resp = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: buildPrompt(genre, class_id, worldName) }],
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

  const list = (parsed as { options?: unknown[] })?.options;
  if (!Array.isArray(list)) {
    return NextResponse.json({ error: "Missing options[] in response" }, { status: 500 });
  }

  const options: OriginChoice[] = [];
  list.forEach((raw, i) => {
    const opt = normalizeOption(raw, class_id, i + 1);
    if (opt) options.push(opt);
  });

  if (options.length === 0) {
    return NextResponse.json(
      { error: "No valid origin options generated" },
      { status: 500 }
    );
  }

  console.log(
    `[generate-origin-options] ${genre}/${class_id} → ${options.length} options in ${Date.now() - t0}ms`
  );
  return NextResponse.json({ options });
}
