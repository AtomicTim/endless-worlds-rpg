import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type {
  AppearanceProfile,
  MasterState,
  OriginChoice,
  PlayerCharacterProfile,
  StartingBonus,
} from "@/types/game";

/**
 * Day 23.5B — Persist a PlayerCharacterProfile onto an existing session.
 *
 * Reads master_state, sets player_state.character_profile, writes back.
 * Follows the same load → patch → update pattern as apply-world-bible
 * (and apply-world-seed) for atomicity at the master_state level.
 */

interface RequestBody {
  session_id?: string;
  profile?:    PlayerCharacterProfile;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function validateBonus(b: unknown): StartingBonus | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>;
  if (o.type === "gold") {
    const amt = typeof o.gold_amount === "number" ? Math.round(o.gold_amount) : 0;
    if (amt <= 0) return null;
    return { type: "gold", gold_amount: amt };
  }
  if (o.type === "item") {
    const itemName = isString(o.item_name) ? o.item_name.trim() : "";
    if (!itemName) return null;
    const itemDesc = isString(o.item_description) ? o.item_description.trim() : "";
    return { type: "item", item_name: itemName, item_description: itemDesc };
  }
  return null;
}

function validateOrigin(raw: unknown): OriginChoice | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = isString(o.id) ? o.id.trim() : "";
  const label = isString(o.label) ? o.label.trim() : "";
  const description = isString(o.description) ? o.description.trim() : "";
  const bonus = validateBonus(o.starting_bonus);
  if (!id || !label || !bonus) return null;
  return { id, label, description, starting_bonus: bonus };
}

function validateAppearance(raw: unknown): AppearanceProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const descRaw = Array.isArray(o.descriptors) ? o.descriptors : [];
  const descriptors = descRaw
    .filter((d): d is string => typeof d === "string")
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
  const summary = isString(o.summary) ? o.summary.trim() : "";
  return { descriptors, summary };
}

function validateProfile(raw: unknown): PlayerCharacterProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const speciesId = isString(o.species_id) ? o.species_id.trim() : "";
  if (!speciesId) return null;
  const gender =
    o.gender === "male" || o.gender === "female" ? o.gender : null;
  if (!gender) return null;
  const origin = validateOrigin(o.origin);
  if (!origin) return null;
  const appearance = validateAppearance(o.appearance);
  if (!appearance) return null;
  const motivation = isString(o.motivation) ? o.motivation.trim() : "";
  return {
    species_id: speciesId,
    gender,
    origin,
    appearance,
    motivation,
  };
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

  const { session_id, profile } = body;
  if (!session_id || !profile) {
    return NextResponse.json(
      { error: "Missing required fields: session_id, profile" },
      { status: 400 }
    );
  }

  const validated = validateProfile(profile);
  if (!validated) {
    return NextResponse.json(
      { error: "Invalid character profile shape" },
      { status: 400 }
    );
  }

  // Load current master_state — same pattern as apply-world-bible.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error: fetchErr } = await (supabase.from("game_sessions") as any)
    .select("master_state")
    .eq("id", session_id)
    .eq("user_id", user.id)
    .single() as { data: { master_state: Json } | null; error: unknown };

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const current = row.master_state as unknown as MasterState;

  const patched: MasterState = {
    ...current,
    player_state: {
      ...current.player_state,
      character_profile: validated,
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (supabase.from("game_sessions") as any)
    .update({ master_state: patched as unknown as Json })
    .eq("id", session_id)
    .eq("user_id", user.id);

  if (updateErr) {
    return NextResponse.json(
      { error: "Failed to persist character profile" },
      { status: 500 }
    );
  }

  console.log(
    `[save-character-profile] Saved profile for session ${session_id}: ` +
    `species=${validated.species_id}, gender=${validated.gender}, ` +
    `origin=${validated.origin.id}`
  );
  return NextResponse.json({ success: true });
}
