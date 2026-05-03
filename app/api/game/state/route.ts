import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadMasterState, saveMasterState } from "@/lib/game/state-persistence";
import type { MasterState } from "@/types/game";

async function getSessionOwner(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  sessionId: string
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("game_sessions") as any)
    .select("user_id")
    .eq("id", sessionId)
    .single() as { data: { user_id: string } | null };
  return data?.user_id ?? null;
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const ownerId = await getSessionOwner(supabase, sessionId);
  if (ownerId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const state = await loadMasterState(supabase, sessionId);
  if (!state) {
    return NextResponse.json({ error: "State not found" }, { status: 404 });
  }

  return NextResponse.json({ state });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { sessionId?: string; state?: MasterState };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId, state } = body;
  if (!sessionId || !state) {
    return NextResponse.json({ error: "Missing sessionId or state" }, { status: 400 });
  }

  const ownerId = await getSessionOwner(supabase, sessionId);
  if (ownerId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await saveMasterState(supabase, sessionId, state);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
