import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Genre } from "@/types/game";
import type { CombatEvent } from "@/types/game";

/**
 * Day 20 Combat — narrator endpoint (combat-spec §10).
 *
 * Receives a structured CombatEvent + small combat_context block
 * and returns 1-2 sentences of direct, physical prose. Only fires
 * for dramatic events: combat_start, crit, kill, victory, defeat,
 * successful flee. Routine events are templated client-side
 * (lib/game/combat-narration/templates.ts) and never reach this
 * route.
 *
 * Verbosity is locked at 1-2 sentences regardless of the
 * exploration verbosity setting — combat narration must keep
 * pace with the action loop.
 */

interface CombatContext {
  player_name:        string;
  player_class?:      string;
  enemies: Array<{
    name:             string;
    description?:     string;
    behavior_flavor?: string;
    alive?:           boolean;
  }>;
  /** Region / location atmosphere for tonal context. */
  region_atmosphere?: string;
}

interface RequestBody {
  event?:           CombatEvent;
  combat_context?:  CombatContext;
  genre?:           Genre | string;
}

const SYSTEM_PROMPT =
  "You are a combat narrator for a procedurally generated RPG. " +
  "The game engine has already resolved the combat math; you write " +
  "what the moment FELT LIKE in 1-2 sentences. " +
  "HARD RULES: " +
  "(1) Direct and physical — no interior monologue, no introspection. " +
  "(2) Never invent damage numbers, hit/miss outcomes, or kills. The " +
  "engine's resolved values are authoritative. " +
  "(3) No cliffhanger framing. State what happened. " +
  "(4) Match the genre's combat tone (Fantasy = blood-and-steel, " +
  "Cyber = servos-and-blood, Horror = dread-physical, Space = " +
  "vacuum-physics, Apoc = gritty-survival). " +
  "(5) 1 sentence default. 2-3 sentences only for crit, kill, " +
  "victory, defeat, or successful flee. " +
  "(6) Respond ONLY with the prose itself. No JSON, no quotes around " +
  "the response, no labels.";

/** Genre-specific tonal primer — composed into the user prompt. */
const TONE_PRIMER: Record<string, string> = {
  fantasy:             "Fantasy: blood-and-steel. Edged weapons, oaths, ancestral grit.",
  cyberpunk:           "Cyberpunk: servos-and-blood. Augments shrieking, blood under the neon.",
  horror_lovecraftian: "Horror: dread-physical. Wet and wrong, the wound noticed seconds late.",
  space_opera:         "Space Opera: vacuum-physics. Servo whine, ozone, the crackle of charged plasma.",
  post_apocalyptic:    "Post-Apocalyptic: gritty-survival. Rust, dust, ammo counted.",
};

function buildUserPrompt(
  event: CombatEvent,
  ctx:   CombatContext,
  genre: string
): string {
  const tone = TONE_PRIMER[genre] ?? TONE_PRIMER.fantasy;
  const enemyRoster = ctx.enemies
    .map((e) => `${e.name}${e.alive === false ? " (dead)" : ""}${e.behavior_flavor ? ` — ${e.behavior_flavor}` : ""}`)
    .join("; ");
  const damageNote = event.damage_dealt != null
    ? `damage: ${event.damage_dealt}`
    : "no damage";
  const hpNote = event.remaining_target_hp != null
    ? `target HP after: ${event.remaining_target_hp}`
    : "";
  const itemNote = event.weapon_or_item ? `weapon/item: ${event.weapon_or_item}` : "";
  const flavorNote = event.context_note ? `flavor: ${event.context_note}` : "";

  // Day 20.3 TASK 5 — Victory / Defeat / Successful Flee got a
  // dedicated banner-word line in the story feed. The LLM prose now
  // sits BELOW the banner as a single short flavor sentence, not a
  // wall of dramatic prose. Tighten the length cap accordingly.
  // Crits keep their 2-3 sentence latitude (banner above is just a
  // damage marker; the prose still earns the tier-3 budget).
  const isResolution =
    event.type === "victory" ||
    event.type === "defeat" ||
    (event.type === "flee_attempt" && event.outcome === "fled") ||
    event.type === "flee_success";
  const lengthHint = isResolution
    ? "Write ONE sentence, max 20 words. Punchy, not flowery."
    : event.outcome === "crit"
      || event.outcome === "kill"
      || event.type === "combat_start"
      ? "Write 2-3 sentences."
      : "Write 1 sentence.";

  return `${tone}

PLAYER: ${ctx.player_name}${ctx.player_class ? ` (${ctx.player_class})` : ""}
ENEMIES: ${enemyRoster || "(none)"}
${ctx.region_atmosphere ? `SCENE: ${ctx.region_atmosphere}\n` : ""}
EVENT (resolved by the engine — do not contradict):
  type:    ${event.type}
  actor:   ${event.actor}
  target:  ${event.target ?? "(none)"}
  outcome: ${event.outcome ?? "(none)"}
  ${damageNote}
  ${hpNote}
  ${itemNote}
  ${flavorNote}

${lengthHint} Match the genre tone. Direct and physical. No interior
monologue, no cliffhanger framing. Do NOT invent numbers — the
engine's values are final.`;
}

const FALLBACK_TEXT_BY_TYPE: Record<CombatEvent["type"], string> = {
  combat_start:      "Steel meets the air. Combat begins.",
  round_start:       "",
  // Day 20.1 — turn-boundary separators are templated client-side; the
  // narrate-combat route never sees them, but the Record must cover
  // every CombatEvent.type for type completeness.
  player_turn_start: "",
  enemy_phase_start: "",
  player_attack:     "You strike — and connect.",
  enemy_attack:      "The enemy lands a blow.",
  defend:            "You raise your guard.",
  use_item:          "You use an item.",
  flee_attempt:      "You move to disengage.",
  kill:              "The enemy collapses, lifeless.",
  victory:           "The last foe falls. The clearing is yours.",
  defeat:            "Darkness closes in. You fall.",
  flee_success:      "You break free into the open.",
};

export async function POST(request: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
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

  const { event, combat_context, genre } = body;
  if (!event || !combat_context || !genre) {
    return NextResponse.json(
      { error: "Missing required fields: event, combat_context, genre" },
      { status: 400 }
    );
  }

  const genreStr = typeof genre === "string" ? genre : String(genre);
  const userPrompt = buildUserPrompt(event, combat_context, genreStr);

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    // Day 20.3 TASK 5 — resolution events (victory/defeat/flee_success)
    // get a tighter token budget to nudge the model toward the locked
    // "ONE sentence, max 20 words" rule. Crits keep the wider budget
    // for tier-3 prose.
    const isResolutionEvent =
      event.type === "victory" ||
      event.type === "defeat" ||
      event.type === "flee_success" ||
      (event.type === "flee_attempt" && event.outcome === "fled");
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-5",
      max_tokens: isResolutionEvent ? 120 : 250,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: userPrompt }],
    });
    const text = message.content[0]?.type === "text"
      ? message.content[0].text.trim()
      : "";
    if (!text) {
      return NextResponse.json({ text: FALLBACK_TEXT_BY_TYPE[event.type] ?? "" });
    }
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[narrate-combat] anthropic call failed:", err);
    // Graceful degrade — combat must keep flowing even if the API blips.
    return NextResponse.json({ text: FALLBACK_TEXT_BY_TYPE[event.type] ?? "" });
  }
}
