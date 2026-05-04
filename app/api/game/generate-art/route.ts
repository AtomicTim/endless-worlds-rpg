import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  buildArtSystemPrompt,
  buildArtUserPrompt,
  type SceneType,
} from "@/lib/game/art-generator";

interface RequestBody {
  location_id?:   string;
  location_name?: string;
  scene_type?:    SceneType;
  genre?:         string;
  description?:   string;
  session_id?:    string;
}

const ALLOWED_SCENE_TYPES: SceneType[] = [
  "TOP_DOWN_TOWN",
  "SIDE_VIEW_INTERIOR",
  "FRONT_PORTRAIT",
  "ISOMETRIC_WIDE",
];

/**
 * Defense-in-depth SVG sanitizer. The system prompt forbids dangerous tags,
 * but we strip them again here in case the model slips.
 */
function sanitizeSvg(raw: string): string {
  const match = raw.match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) return "";
  let cleaned = match[0];

  // Strip <script>, <foreignObject>, <text>, <image>
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, "");
  cleaned = cleaned.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
  cleaned = cleaned.replace(/<text[\s\S]*?<\/text>/gi, "");
  cleaned = cleaned.replace(/<image[^>]*\/?>/gi, "");

  // Strip any inline event handlers
  cleaned = cleaned.replace(/\s+on[a-zA-Z]+\s*=\s*"[^"]*"/g, "");
  cleaned = cleaned.replace(/\s+on[a-zA-Z]+\s*=\s*'[^']*'/g, "");

  // Strip javascript: URLs
  cleaned = cleaned.replace(/javascript:/gi, "");

  return cleaned;
}

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
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { location_id, location_name, scene_type, genre, description, session_id } = body;
  if (
    typeof location_id   !== "string" || !location_id.trim()   ||
    typeof location_name !== "string" || !location_name.trim() ||
    typeof scene_type    !== "string" || !ALLOWED_SCENE_TYPES.includes(scene_type as SceneType) ||
    typeof genre         !== "string" || !genre.trim()
  ) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  // ── 1. Cache lookup — scoped to this (location_id, session_id) pair ───────
  if (session_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cachedRow } = await (supabase.from("art_cache") as any)
      .select("svg_content")
      .eq("location_id", location_id)
      .eq("session_id", session_id)
      .maybeSingle();

    if (cachedRow?.svg_content) {
      return NextResponse.json({ svg: cachedRow.svg_content, cached: true });
    }
  }

  // ── 2. Generate fresh SVG via Claude ───────────────────────────────────────
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const systemPrompt = buildArtSystemPrompt();
  const userPrompt   = buildArtUserPrompt(
    scene_type as SceneType,
    location_name,
    genre,
    description ?? ""
  );

  let rawSvg = "";
  try {
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system:     systemPrompt,
      messages:   [{ role: "user", content: userPrompt }],
    });
    if (message.content[0]?.type === "text") {
      rawSvg = message.content[0].text;
    }
  } catch {
    return NextResponse.json({ error: "Generation failed" }, { status: 502 });
  }

  const svg = sanitizeSvg(rawSvg);
  if (!svg) {
    return NextResponse.json({ error: "Empty or invalid SVG" }, { status: 502 });
  }

  // ── 3. Cache (best-effort — failure to cache must not break the response) ──
  if (session_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("art_cache") as any).upsert(
      {
        location_id,
        session_id,
        genre,
        scene_type,
        svg_content: svg,
      },
      { onConflict: "location_id,session_id", ignoreDuplicates: true }
    );
  }

  return NextResponse.json({ svg, cached: false });
}
