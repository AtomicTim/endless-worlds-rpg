import type { Database, Json } from "@/types/database";
import type { MasterState, LogBook, WorldGraph, WorldState } from "@/types/game";
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

/**
 * Targeted patch: replaces the entire log_book (entries + recent_messages) in
 * the stored master_state. Uses a read-modify-write pattern — two DB calls but
 * avoids sending the full state blob from the client on every action.
 */
export async function patchLogEntries(
  client: DbClient,
  sessionId: string,
  logBook: LogBook
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: fetchErr } = await (client.from("game_sessions") as any)
    .select("master_state")
    .eq("id", sessionId)
    .single() as { data: { master_state: Json } | null; error: unknown };

  if (fetchErr || !data) return; // session not found — silently skip

  const current = data.master_state as unknown as MasterState;
  const patched: MasterState = {
    ...current,
    log_book: logBook,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("game_sessions") as any)
    .update({ master_state: patched as unknown as Json })
    .eq("id", sessionId);
}

/**
 * Targeted patch: replaces world_state in the stored master_state.
 * Used for immediate persistence after MOVE (current_location_id,
 * visited_locations) and any action that mutates world flags.
 */
export async function patchWorldState(
  client: DbClient,
  sessionId: string,
  worldState: WorldState
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: fetchErr } = await (client.from("game_sessions") as any)
    .select("master_state")
    .eq("id", sessionId)
    .single() as { data: { master_state: Json } | null; error: unknown };

  if (fetchErr || !data) return; // session not found — silently skip

  const current = data.master_state as unknown as MasterState;
  const patched: MasterState = {
    ...current,
    world_state: worldState,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("game_sessions") as any)
    .update({ master_state: patched as unknown as Json })
    .eq("id", sessionId);
}

/**
 * Audit Issue M fix — targeted patch for the World Graph.
 * Replaces world_graph in the stored master_state AND mirrors it to the
 * dedicated `world_graph` jsonb column. Used by saveWorldGraphAsync in
 * useGameLoop so graph mutations (ZONE_EXPAND, addNpcToCurrentNode,
 * RegionBible application) persist immediately rather than waiting for
 * the 10-action auto-save.
 */
export async function patchWorldGraph(
  client: DbClient,
  sessionId: string,
  worldGraph: WorldGraph
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: fetchErr } = await (client.from("game_sessions") as any)
    .select("master_state")
    .eq("id", sessionId)
    .single() as { data: { master_state: Json } | null; error: unknown };

  if (fetchErr || !data) return; // session not found — silently skip

  const current = data.master_state as unknown as MasterState;
  const patched: MasterState = {
    ...current,
    world_graph: worldGraph,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("game_sessions") as any)
    .update({
      master_state: patched     as unknown as Json,
      world_graph:  worldGraph  as unknown as Json,
    })
    .eq("id", sessionId);
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
