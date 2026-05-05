-- Migration 009: World generation columns
-- Already applied manually to Supabase on 2026-05-05
-- Do NOT run again

ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS world_consistency jsonb;

ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS world_bible jsonb;
