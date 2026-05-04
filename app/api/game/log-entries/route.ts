import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { patchLogEntries } from "@/lib/game/state-persistence";
import type { LogBook } from "@/types/game";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { sessionId?: string; logBook?: LogBook };
  try {
    body = await request.json() as { sessionId?: string; logBook?: LogBook };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId, logBook } = body;
  if (!sessionId || !logBook) {
    return NextResponse.json({ error: "Missing sessionId or logBook" }, { status: 400 });
  }

  try {
    await patchLogEntries(supabase, sessionId, logBook);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Patch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
