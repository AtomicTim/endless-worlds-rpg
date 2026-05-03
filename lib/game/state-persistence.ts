import type { Database, Json } from "@/types/database";
import type { MasterState } from "@/types/game";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type DbClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type GameSessionRow = Database["public"]["Tables"]["game_sessions"]["Row"];
type GameSessionInsert = Database["public"]["Tables"]["game_sessions"]["Insert"];

export async function saveMasterState(
  client: DbClient,
  sessionId: string,
  state: MasterState
): Promise<void> {
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const now = new Date().toISOString();
  const values: GameSessionInsert = {
    id:             sessionId,
    user_id:        user.id,
    character_name: state.player_state.name,
    genre:          state.metadata.genre,
    master_state:   state as unknown as Json,
    last_played:    now,
    updated_at:     now,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("game_sessions") as any).upsert(values);
  if (error) throw error;
}

export async function loadMasterState(
  client: DbClient,
  sessionId: string
): Promise<MasterState | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from("game_sessions") as any)
    .select("master_state")
    .eq("id", sessionId)
    .single() as { data: { master_state: Json } | null; error: unknown };

  if (error || !data) return null;
  return data.master_state as unknown as MasterState;
}

export async function getActiveSessions(
  client: DbClient,
  userId: string
): Promise<GameSessionRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from("game_sessions") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("last_played", { ascending: false }) as { data: GameSessionRow[] | null; error: unknown };

  if (error) throw error;
  return data ?? [];
}
