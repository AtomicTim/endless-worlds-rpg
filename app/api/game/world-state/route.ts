import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { patchWorldState, patchWorldGraph } from "@/lib/game/state-persistence";
import type { WorldGraph, WorldState } from "@/types/game";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { sessionId?: string; worldState?: WorldState; worldGraph?: WorldGraph };
  try {
    body = await request.json() as {
      sessionId?:  string;
      worldState?: WorldState;
      worldGraph?: WorldGraph;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId, worldState, worldGraph } = body;
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }
  if (!worldState && !worldGraph) {
    return NextResponse.json(
      { error: "At least one of worldState or worldGraph is required" },
      { status: 400 }
    );
  }

  // Audit Issue M fix: accept and persist worldGraph alongside worldState.
  // Graph mutations (sub_location creation, npc_ids updates) used to wait
  // for the 10-action auto-save before reaching the DB; with this route
  // every mutation can persist immediately via the saveWorldGraphAsync
  // helper in useGameLoop.
  try {
    if (worldState) {
      await patchWorldState(supabase, sessionId, worldState);
    }
    if (worldGraph) {
      await patchWorldGraph(supabase, sessionId, worldGraph);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Patch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
