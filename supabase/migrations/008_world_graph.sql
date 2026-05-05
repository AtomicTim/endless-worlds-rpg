-- Migration 008: World Graph (Day 18)
-- Run this in Supabase SQL Editor after deploying the app update.
--
-- Day 18 introduces a persistent connected location graph (WorldGraph):
-- nodes are zones and sub_locations, each with explicit connections,
-- npc_ids, and a map_position. The graph lives inside master_state at
-- runtime; this column mirrors it for direct querying / future analytics
-- without parsing the master_state jsonb path.
--
-- world_states.current_node_id is the in-graph location id, kept in sync
-- with current_location_id when a graph exists. Optional column — old
-- saves continue to read current_location_id only.

ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS world_graph jsonb;

ALTER TABLE public.world_states
  ADD COLUMN IF NOT EXISTS current_node_id text;

COMMENT ON COLUMN public.game_sessions.world_graph
  IS 'Persistent connected location graph (Day 18). Mirrors master_state.world_graph for direct queries. Built at world-seed application time.';

COMMENT ON COLUMN public.world_states.current_node_id
  IS 'World Graph node id (Day 18). Mirrors current_location_id when a graph exists; null on legacy saves.';
