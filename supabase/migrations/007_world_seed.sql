-- Migration 007: Add world_seed column to game_sessions (Day 17).
-- Run this in Supabase SQL Editor after deploying the app update.
--
-- world_seed stores the pre-generated world skeleton (locations, NPCs, main
-- quest, factions) created at character creation time. The narrator reads
-- the seed via state.metadata.world_seed and treats every entry in it as
-- immutable game fact.
--
-- Stored as jsonb both at the column level (for indexing/querying) AND
-- nested inside master_state.metadata (for the runtime). This column is
-- redundant with the embedded copy but enables direct queries without
-- having to extract jsonb path expressions out of master_state.

ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS world_seed jsonb;

COMMENT ON COLUMN public.game_sessions.world_seed
  IS 'Pre-generated world skeleton (Day 17): starting + known locations, key NPCs, main quest, factions. Immutable for the session.';
