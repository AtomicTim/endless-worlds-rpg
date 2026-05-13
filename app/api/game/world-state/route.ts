import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { patchQuestThreads, patchWorldState, patchWorldGraph } from "@/lib/game/state-persistence";
import type { QuestThreads, WorldGraph, WorldState } from "@/types/game";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    sessionId?:    string;
    worldState?:   WorldState;
    worldGraph?:   WorldGraph;
    questThreads?: QuestThreads;
  };
  try {
    body = await request.json() as {
      sessionId?:    string;
      worldState?:   WorldState;
      worldGraph?:   WorldGraph;
      questThreads?: QuestThreads;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId, worldState, worldGraph, questThreads } = body;
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }
  if (!worldState && !worldGraph && !questThreads) {
    return NextResponse.json(
      { error: "At least one of worldState, worldGraph, or questThreads is required" },
      { status: 400 }
    );
  }

  // Audit Issue M fix: accept and persist worldGraph alongside worldState.
  // Day 23B pt2: questThreads added so breadcrumb-discovery / faction-
  // alignment mutations land immediately rather than waiting for the
  // 10-action auto-save.
  try {
    if (worldState) {
      await patchWorldState(supabase, sessionId, worldState);
    }
    if (worldGraph) {
      await patchWorldGraph(supabase, sessionId, worldGraph);
    }
    if (questThreads) {
      await patchQuestThreads(supabase, sessionId, questThreads);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Patch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
