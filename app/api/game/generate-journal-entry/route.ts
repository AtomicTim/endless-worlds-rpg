import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Day 23C — generate a short first-person diary entry for a discovered
 * quest breadcrumb. Reflective and personal: what the character felt or
 * noticed, NOT a literal restatement of the breadcrumb text.
 *
 * Model: haiku (same tier as RegionBible — quality is acceptable from
 * a smaller model since the breadcrumb content already locks the
 * narrative anchor; speed matters more for the post-discovery beat).
 *
 * Stored as a QuestEntry on MainQuest.journal_entries by the caller.
 * The journal Main Quest tab renders entries grouped by breadcrumb_id.
 */

interface RequestBody {
  session_id?:           string;
  quest_title?:          string;
  breadcrumb_content?:   string;
  world_name?:           string;
  player_name?:          string;
  player_class?:         string;
  archetype?:            string;
}

const SYSTEM_PROMPT =
  "You are the journaling voice of an RPG protagonist — Morrowind-style. " +
  "When called, you produce ONE short diary entry, first-person past tense, " +
  "reflective and personal. Never restate facts verbatim; the entry is what " +
  "the character felt, what they noticed, what crystallized for them. " +
  "Respond with ONLY the entry text. No headers, no markdown, no quotes.";

function buildUserPrompt(body: Required<Omit<RequestBody, "session_id">>): string {
  return [
    `World: ${body.world_name}`,
    `Character: ${body.player_name}, a ${body.player_class}`,
    `Main quest: "${body.quest_title}"`,
    `Quest archetype (internal — never mention by name): ${body.archetype}`,
    "",
    "Breadcrumb the character just realized:",
    `  "${body.breadcrumb_content}"`,
    "",
    "Write a 2-4 sentence diary entry capturing the character's INNER experience",
    "of this realization. First person, past tense (\"I noticed…\", \"I felt…\",",
    "\"It came to me as I…\"). Reference the breadcrumb obliquely — don't repeat",
    "the literal words, don't paraphrase them as a quest log would. Capture what",
    "the player-character notices, suspects, or fears in this moment.",
    "",
    "Tone matches the world's atmosphere and the archetype. A 'corruption' world",
    "diary reads grimmer than 'ancient_awakening'. Never name the archetype.",
    "",
    "Output: the entry text ONLY. No surrounding quotes, no header, no markdown.",
  ].join("\n");
}

async function callClaude(client: Anthropic, prompt: string): Promise<string> {
  // V8.65 — bumped 150 → 200. Playtest showed 4-sentence diary entries
  // hitting the cap mid-clause around 685 chars (~145 tokens for haiku).
  // 200 gives ~20% headroom so the model can land the final sentence
  // cleanly without inflating the average response length.
  const message = await client.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 200,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: "user", content: prompt }],
  });
  return message.content[0]?.type === "text" ? message.content[0].text.trim() : "";
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

  const { session_id, quest_title, breadcrumb_content, world_name, player_name, player_class, archetype } = body;
  if (!session_id || !quest_title || !breadcrumb_content || !world_name || !player_name || !player_class || !archetype) {
    return NextResponse.json(
      { error: "Missing required fields: session_id, quest_title, breadcrumb_content, world_name, player_name, player_class, archetype" },
      { status: 400 }
    );
  }

  const userPrompt = buildUserPrompt({
    quest_title, breadcrumb_content, world_name, player_name, player_class, archetype,
  });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let entryText = "";
  try {
    entryText = await callClaude(anthropic, userPrompt);
    // Strip surrounding quotes the model sometimes adds despite the
    // explicit instruction.
    // Strip a single pair of surrounding quotes (with or without
    // whitespace) if the model added them. Multi-line strings — match
    // is unanchored to "$" so the trailing quote can be the last char.
    const quoted = entryText.match(/^["'`]([\s\S]+)["'`]$/);
    if (quoted) entryText = quoted[1].trim();
  } catch (err) {
    console.error("[JournalEntry] Anthropic call failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Anthropic call failed" },
      { status: 500 }
    );
  }

  if (!entryText) {
    // Fallback: don't fail the discovery flow on an empty AI response.
    entryText = "I'm not sure what I noticed — only that something has shifted, and I am no longer the same as I was before.";
  }

  console.log(`[JournalEntry] Generated for "${quest_title}", ${entryText.length} chars.`);
  return NextResponse.json({ entry_text: entryText });
}
