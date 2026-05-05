import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AssetCategory, LocationStatus } from "@/types/game";
import type { Json } from "@/types/database";
import type {
  MasterState,
  SeedLocation,
  SeedNPC,
  WorldAsset,
  WorldSeed,
} from "@/types/game";

/**
 * Day 17 — applies a freshly-generated WorldSeed to a session.
 *
 * 1. Saves a world_assets row for every SeedLocation (LOCATION category)
 *    and SeedNPC (CHARACTER, name_known: true).
 * 2. Patches the session's master_state:
 *      metadata.world_seed                = seed
 *      world_state.current_location_id    = seed.starting_location.id
 *      visited_locations                  = [starting_location.id]
 * 3. Writes the seed to the dedicated game_sessions.world_seed column
 *    too (for direct querying).
 *
 * Server-side and atomic — the wizard calls this once after seed
 * generation and before redirecting to /game.
 */

interface RequestBody {
  sessionId?: string;
  worldSeed?: WorldSeed;
}

function locationToAsset(
  loc: SeedLocation,
  sessionId: string
): WorldAsset {
  return {
    id:                  `location_${loc.id}`,
    category:            AssetCategory.LOCATION,
    name:                loc.name,
    constitution: {
      physical_description: loc.description,
      ...(loc.faction_id ? { faction_affiliation: loc.faction_id } : {}),
      // Stash structural facts the narrator can read.
      notes: `type=${loc.type}; ${loc.connected_to ? `connected_to=${loc.connected_to.join(",")}; ` : ""}id=${loc.id}`,
    },
    significance:        "NOTABLE",
    first_seen_location: loc.id,
    session_id:          sessionId,
    name_known:          true,
    created_at:          new Date().toISOString(),
  };
}

function npcToAsset(
  npc: SeedNPC,
  sessionId: string
): WorldAsset {
  return {
    id:                  `character_${npc.id}`,
    category:            AssetCategory.CHARACTER,
    name:                npc.name,
    constitution: {
      personality:         npc.personality,
      role:                npc.role,
      notes: [
        `Found at: ${npc.location_id}`,
        npc.knows_about?.length ? `Knows about: ${npc.knows_about.join("; ")}` : "",
        npc.is_merchant ? "Is a merchant." : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
    significance:        "NOTABLE",
    first_seen_location: npc.location_id,
    session_id:          sessionId,
    // Day 17 NPCs have known names from start.
    name_known:          true,
    created_at:          new Date().toISOString(),
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

  const { sessionId, worldSeed } = body;
  if (!sessionId || !worldSeed) {
    return NextResponse.json({ error: "Missing sessionId or worldSeed" }, { status: 400 });
  }

  // ── 1. Load the session's current master_state ─────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error: fetchErr } = await (supabase.from("game_sessions") as any)
    .select("master_state")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single() as { data: { master_state: Json } | null; error: unknown };

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const current = row.master_state as unknown as MasterState;

  // ── 2. Build all world_assets rows (locations + NPCs) ──────────────────────
  const startingId = worldSeed.starting_location.id;
  const allLocations: SeedLocation[] = [
    worldSeed.starting_location,
    ...(worldSeed.known_locations ?? []),
  ];
  const locationAssets = allLocations.map((l) => locationToAsset(l, sessionId));
  const npcAssets      = (worldSeed.key_npcs ?? []).map((n) => npcToAsset(n, sessionId));
  const allAssets      = [...locationAssets, ...npcAssets];

  // ── 3. Upsert each asset (write-once via ignoreDuplicates) ─────────────────
  for (const asset of allAssets) {
    const insertRow: Record<string, unknown> = {
      session_id:          sessionId,
      asset_id:            asset.id,
      category:            asset.category,
      name:                asset.name,
      constitution:        asset.constitution,
      significance:        asset.significance,
      first_seen_location: asset.first_seen_location,
      name_known:          asset.name_known,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("world_assets") as any).upsert(
      insertRow,
      { onConflict: "session_id,asset_id", ignoreDuplicates: true }
    );
    if (error) {
      console.error("[apply-world-seed] saveWorldAsset failed for", asset.id, error);
    }
  }

  // ── 4. Patch master_state with seed metadata + starting location ───────────
  const patched: MasterState = {
    ...current,
    metadata: {
      ...current.metadata,
      world_seed: worldSeed,
    },
    world_state: {
      ...current.world_state,
      current_location_id: startingId,
      visited_locations:   Array.from(
        new Set([...(current.world_state.visited_locations ?? []), startingId])
      ),
      location_status:     LocationStatus.PRESENT,
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (supabase.from("game_sessions") as any)
    .update({
      master_state: patched as unknown as Json,
      world_seed:   worldSeed as unknown as Json,
    })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to apply world seed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, startingLocationId: startingId });
}
