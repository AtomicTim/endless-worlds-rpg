import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Genre } from "@/types/game";

/**
 * Day 23.5B — Random name generator.
 *
 * Returns a single name appropriate for the (genre, species, gender)
 * combo. No titles, no epithets — just a name.
 */

const MODEL      = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 50;

interface RequestBody {
  genre?:      Genre;
  species_id?: string;
  gender?:     "male" | "female";
}

const SYSTEM_PROMPT =
  "You generate single character names for an RPG. Respond ONLY with " +
  "valid JSON. No markdown, no code fences, no explanation.";

function buildPrompt(genre: Genre, speciesId: string, gender: "male" | "female"): string {
  return [
    `Generate exactly 1 ${gender} name for a ${speciesId} character in a ${genre} world.`,
    "",
    "RULES:",
    "- Just the name. No titles (Sir, Lady, Captain, etc.).",
    "- No epithets (the Bold, the Wise, etc.).",
    "- No nicknames in quotes.",
    "- 2-24 characters. Letters, hyphens, or apostrophes only.",
    "- Must feel native to the genre and species.",
    "",
    'Output JSON ONLY: { "name": "<Name>" }',
  ].join("\n");
}

function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

function sanitizeName(raw: string): string {
  // Strip surrounding quotes and disallowed characters; cap at 24.
  const cleaned = raw.replace(/^["'\s]+|["'\s]+$/g, "");
  const filtered = cleaned.replace(/[^a-zA-Z0-9\-' ]/g, "").trim();
  return filtered.slice(0, 24);
}

export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { genre, species_id, gender } = body;
  if (!genre || !species_id || !gender) {
    return NextResponse.json(
      { error: "Missing required fields: genre, species_id, gender" },
      { status: 400 }
    );
  }
  if (!Object.values(Genre).includes(genre)) {
    return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
  }
  if (gender !== "male" && gender !== "female") {
    return NextResponse.json({ error: "Invalid gender" }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let rawText = "";
  try {
    const resp = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: buildPrompt(genre, species_id, gender) }],
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

  const nameRaw = (parsed as { name?: unknown })?.name;
  const name = typeof nameRaw === "string" ? sanitizeName(nameRaw) : "";
  if (name.length < 2) {
    return NextResponse.json({ error: "Empty or invalid name" }, { status: 500 });
  }

  return NextResponse.json({ name });
}
