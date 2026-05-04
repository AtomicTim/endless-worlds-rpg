import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { patchWorldState } from "@/lib/game/state-persistence";
import type { WorldState } from "@/types/game";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { sessionId?: string; worldState?: WorldState };
  try {
    body = await request.json() as { sessionId?: string; worldState?: WorldState };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId, worldState } = body;
  if (!sessionId || !worldState) {
    return NextResponse.json({ error: "Missing sessionId or worldState" }, { status: 400 });
  }

  try {
    await patchWorldState(supabase, sessionId, worldState);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Patch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
