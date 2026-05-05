import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  buildNarratorSystemPrompt,
  buildNarratorUserPrompt,
} from "@/lib/game/prompt-builder";
import type {
  MasterState,
  NarratorResponse,
  ParsedAction,
  ResolutionResult,
  WorldAsset,
} from "@/types/game";

const FALLBACK_RESPONSE: NarratorResponse = {
  response_tier:      2,
  narrative_text:     "The narrator falls silent for a moment, then continues. The moment passes without ceremony.",
  ascii_art:          null,
  new_npcs:           [],
  points_of_interest: [],
  codex_entries:      [],
};

export async function POST(request: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Body validation ────────────────────────────────────────────────────────
  let body: {
    resolutionResult?:  ResolutionResult;
    masterState?:       MasterState;
    lastNarrativeText?: string;
    action?:            ParsedAction;
    locationAssets?:    WorldAsset[];
    verbosity?:         "terse" | "standard" | "rich";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { resolutionResult, masterState, lastNarrativeText, action, locationAssets, verbosity } = body;
  if (!resolutionResult || !masterState) {
    return NextResponse.json(
      { error: "Missing resolutionResult or masterState" },
      { status: 400 }
    );
  }
  if (typeof resolutionResult.outcome_type !== "string") {
    return NextResponse.json(
      { error: "resolutionResult.outcome_type is required" },
      { status: 400 }
    );
  }

  const safeAssets = Array.isArray(locationAssets) ? locationAssets : null;

  // Day 18 — verbosity from the client store; defaults to "standard" so old
  // callers keep behaving identically.
  const validVerbosity: "terse" | "standard" | "rich" =
    verbosity === "terse" || verbosity === "rich" ? verbosity : "standard";
  const systemPrompt = buildNarratorSystemPrompt(masterState, validVerbosity);
  const userPrompt   = buildNarratorUserPrompt(
    resolutionResult,
    masterState,
    lastNarrativeText,
    action,
    safeAssets
  );

  // Instantiate per-request so the apiKey is read from process.env at call time
  // (avoids stale module-level binding across Next.js dev HMR cycles).
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // ── Streamed body ──────────────────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let receivedAnyText = false;

      try {
        const messageStream = await anthropic.messages.create({
          model:      "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system:     systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          stream:     true,
        });

        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
            receivedAnyText = true;
          }
        }

        controller.close();
      } catch {
        // If we never got any tokens, stream the fallback JSON object so the
        // client always has something parseable to display.
        if (!receivedAnyText) {
          controller.enqueue(encoder.encode(JSON.stringify(FALLBACK_RESPONSE)));
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
