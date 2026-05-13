import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Genre } from "@/types/game";
import type { AppearanceProfile } from "@/types/game";

/**
 * Day 23.5B — Appearance generator.
 *
 * Generates 3 distinct appearance profiles for a (genre, class, species,
 * gender) combo. Each profile is a small set of descriptors plus a one-
 * sentence summary. Gender informs physical descriptors so options feel
 * authentic, not generic.
 *
 * Failures are non-blocking: client falls back to a generic default.
 */

const MODEL      = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 400;

interface RequestBody {
  genre?:      Genre;
  class_id?:   string;
  species_id?: string;
  gender?:     "male" | "female";
}

const SYSTEM_PROMPT =
  "You generate appearance options for an RPG character creation flow. " +
  "Each option is a small set of physical descriptors plus a one-sentence " +
  "summary. Vary heavily between options — they should feel like different " +
  "people. Respond ONLY with valid JSON. No markdown, no code fences.";

function buildPrompt(
  genre:     Genre,
  classId:   string,
  speciesId: string,
  gender:    "male" | "female"
): string {
  return [
    `Generate exactly 3 appearance options for a ${gender} ${speciesId} ${classId} in a ${genre} world.`,
    "",
    "Each option must feel physically distinct from the others — different",
    "body type, features, demeanor. Use gender to inform physical descriptors:",
    "male and female options should feel authentic to the chosen gender,",
    "not generic or interchangeable.",
    "",
    "RULES:",
    "- descriptors: 3 short trait words/phrases (e.g. \"wiry build\", \"sharp eyes\",",
    "  \"close-cropped hair\"). 2-4 words each. NO long phrases.",
    "- summary: ONE sentence describing the overall physical impression.",
    "- No clothing/equipment details — pure physique and features.",
    "- No stat references. No backstory.",
    "",
    "Output JSON ONLY in this exact shape:",
    "{",
    '  "options": [',
    "    {",
    '      "descriptors": ["<trait>", "<trait>", "<trait>"],',
    '      "summary": "<one sentence physical description>"',
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

function normalizeOption(raw: unknown): AppearanceProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const descRaw = Array.isArray(o.descriptors) ? o.descriptors : [];
  const descriptors = descRaw
    .filter((d): d is string => typeof d === "string")
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
  const summary = typeof o.summary === "string" ? o.summary.trim() : "";
  if (descriptors.length === 0 || !summary) return null;
  return { descriptors, summary };
}

export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { genre, class_id, species_id, gender } = body;
  if (!genre || !class_id || !species_id || !gender) {
    return NextResponse.json(
      { error: "Missing required fields: genre, class_id, species_id, gender" },
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

  const t0 = Date.now();
  let rawText = "";
  try {
    const resp = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: buildPrompt(genre, class_id, species_id, gender) }],
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

  const options: AppearanceProfile[] = [];
  list.forEach((raw) => {
    const opt = normalizeOption(raw);
    if (opt) options.push(opt);
  });

  if (options.length === 0) {
    return NextResponse.json(
      { error: "No valid appearance options generated" },
      { status: 500 }
    );
  }

  console.log(
    `[generate-appearance-options] ${genre}/${species_id}/${gender}/${class_id} → ${options.length} options in ${Date.now() - t0}ms`
  );
  return NextResponse.json({ options });
}
