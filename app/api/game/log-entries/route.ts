import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { patchLogEntries } from "@/lib/game/state-persistence";
import type { LogEntry } from "@/types/game";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { sessionId?: string; entries?: LogEntry[] };
  try {
    body = await request.json() as { sessionId?: string; entries?: LogEntry[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId, entries } = body;
  if (!sessionId || !Array.isArray(entries)) {
    return NextResponse.json({ error: "Missing sessionId or entries" }, { status: 400 });
  }

  try {
    await patchLogEntries(supabase, sessionId, entries);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Patch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
