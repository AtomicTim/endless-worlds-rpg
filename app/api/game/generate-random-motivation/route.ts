import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Genre } from "@/types/game";

/**
 * Day 23.5B hotfix — Random motivation generator.
 *
 * Returns a single-sentence forward-looking motivation for the
 * character — what they want or intend in this world. Specific to
 * species, class, origin, and world. NOT backstory.
 */

const MODEL      = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 100;

interface RequestBody {
  genre?:          Genre;
  wcd_world_name?: string;
  species_id?:     string;
  class_id?:       string;
  origin_label?:   string;
}

const SYSTEM_PROMPT =
  "You generate single-sentence character motivations for an RPG. " +
  "Respond ONLY with valid JSON. No markdown, no code fences, no explanation.";

function buildPrompt(
  genre:       Genre,
  worldName:   string,
  speciesId:   string,
  classId:     string,
  originLabel: string
): string {
  const originLine = originLabel
    ? `Origin: ${originLabel}.`
    : "";
  return [
    `Generate exactly 1 motivation sentence for a ${speciesId} ${classId} in ${worldName} (${genre} setting).`,
    originLine,
    "",
    "RULES:",
    "- Forward-looking. What this character WANTS or INTENDS in this world.",
    "- NOT backstory. NOT past events.",
    "- 1 sentence. Under 25 words.",
    "- Specific to the species, class, and world above — not generic.",
    "- Written in first person, but no \"I\" required.",
    "",
    "Maximum 100 characters. One sentence only.",
    "",
    'Output JSON ONLY: { "motivation": "<one sentence>" }',
  ]
    .filter((s) => s.length > 0)
    .join("\n");
}

function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { genre, wcd_world_name, species_id, class_id, origin_label } = body;
  if (!genre || !species_id || !class_id) {
    return NextResponse.json(
      { error: "Missing required fields: genre, species_id, class_id" },
      { status: 400 }
    );
  }
  if (!Object.values(Genre).includes(genre)) {
    return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
  }

  const worldName = (wcd_world_name ?? "").trim() || "this world";
  const originLabel = (origin_label ?? "").trim();

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let rawText = "";
  try {
    const resp = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildPrompt(genre, worldName, species_id, class_id, originLabel),
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

  const m = (parsed as { motivation?: unknown })?.motivation;
  // 23.5C+2 hotfix — hard-truncate to 120 chars to match the UI cap
  // on the motivation textarea (the haiku prompt asks for ≤100 chars
  // but the model occasionally overshoots).
  const motivation = typeof m === "string" ? m.trim().slice(0, 120).trim() : "";
  if (motivation.length < 4) {
    return NextResponse.json({ error: "Empty motivation" }, { status: 500 });
  }

  return NextResponse.json({ motivation });
}
