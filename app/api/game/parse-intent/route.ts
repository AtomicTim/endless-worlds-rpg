import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildIntentParserPrompt, buildIntentParserContext } from "@/lib/game/prompt-builder";
import { ActionType } from "@/types/game";
import type { MasterState, ParsedAction } from "@/types/game";
import { inferToneFromSpeech, type DialogueTone } from "@/lib/game/dialogue-tone";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DIALOGUE_TONES = new Set<string>([
  "friendly", "persuasive", "deceptive", "intimidating", "curious", "neutral",
]);

function makeFallback(input: string): ParsedAction {
  return {
    action_type: ActionType.CUSTOM,
    inferred_intent: input.slice(0, 200),
    confidence: 0.5,
  };
}

function parseAIResponse(text: string): ParsedAction | null {
  try {
    // Strip any accidental markdown fences the model may have added
    const cleaned = text.trim().replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const json = JSON.parse(cleaned) as Record<string, unknown>;

    if (typeof json.action_type !== "string") return null;
    if (!Object.values(ActionType).includes(json.action_type as ActionType)) return null;
    if (typeof json.inferred_intent !== "string") return null;
    if (typeof json.confidence !== "number") return null;

    const dialogueToneRaw =
      typeof json.dialogue_tone === "string" ? json.dialogue_tone.toLowerCase() : "";
    const dialogueTone =
      DIALOGUE_TONES.has(dialogueToneRaw) ? (dialogueToneRaw as DialogueTone) : undefined;

    return {
      action_type:      json.action_type as ActionType,
      primary_target:   typeof json.primary_target === "string" ? json.primary_target : undefined,
      secondary_target: typeof json.secondary_target === "string" ? json.secondary_target : undefined,
      item_used:        typeof json.item_used === "string" ? json.item_used : undefined,
      inferred_intent:  json.inferred_intent as string,
      confidence:       json.confidence as number,
      ...(dialogueTone ? { dialogue_tone: dialogueTone } : {}),
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { input?: string; masterState?: MasterState; dialogueMode?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { input, masterState, dialogueMode } = body;

  if (typeof input !== "string" || !input.trim()) {
    return NextResponse.json({ error: "Missing or empty input" }, { status: 400 });
  }
  if (!masterState) {
    return NextResponse.json({ error: "Missing masterState" }, { status: 400 });
  }

  const trimmed = input.trim();
  if (trimmed.length > 500) {
    return NextResponse.json({ error: "Input must be 500 characters or fewer" }, { status: 400 });
  }

  // ── Dialogue fast-path: quoted input becomes DIALOGUE without an AI call ─
  // We still classify the dialogue_tone via local heuristics so the resolver's
  // stat-check pipeline runs identically for typed quotes and AI-classified
  // dialogue. Every dialogue beat is treated the same way.
  if (dialogueMode === true) {
    return NextResponse.json({
      action_type:      ActionType.DIALOGUE,
      primary_target:   undefined,
      secondary_target: undefined,
      item_used:        undefined,
      inferred_intent:  `says: ${trimmed}`,
      confidence:       1.0,
      dialogue_tone:    inferToneFromSpeech(trimmed),
    } satisfies ParsedAction);
  }

  const systemPrompt   = buildIntentParserPrompt(masterState);
  const contextBlock   = buildIntentParserContext(masterState);

  try {
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 256,
      system:     systemPrompt,
      messages: [
        {
          role:    "user",
          content: `${contextBlock}\n\nPlayer input: "${trimmed}"`,
        },
      ],
    });

    const rawText =
      message.content[0]?.type === "text" ? message.content[0].text : "";

    const parsed = parseAIResponse(rawText);
    return NextResponse.json(parsed ?? makeFallback(trimmed));
  } catch {
    return NextResponse.json(makeFallback(trimmed));
  }
}
