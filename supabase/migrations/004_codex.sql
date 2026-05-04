-- Endless Worlds RPG — Codex (Day 13.5)
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query)
--
-- Stores the player-facing encyclopedia of everything they have discovered
-- in this campaign. Codex entries are write-once per (session_id, entry_id)
-- — once a thing is recorded, it stays. The /game/codex page reads from
-- this table and renders categorized cards.

CREATE TABLE IF NOT EXISTS public.codex (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  entry_id            text NOT NULL,
  category            text NOT NULL,
  name                text NOT NULL,
  description         text NOT NULL,
  first_seen_location text,
  significance        text NOT NULL DEFAULT 'NOTABLE',
  created_at          timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT codex_session_entry_unique UNIQUE (session_id, entry_id)
);

CREATE INDEX IF NOT EXISTS codex_session_idx  ON public.codex (session_id);
CREATE INDEX IF NOT EXISTS codex_category_idx ON public.codex (session_id, category);

ALTER TABLE public.codex ENABLE ROW LEVEL SECURITY;

-- Drop any prior versions of the policies so the migration is idempotent.
DROP POLICY IF EXISTS "Users can read own codex"   ON public.codex;
DROP POLICY IF EXISTS "Users can insert own codex" ON public.codex;

CREATE POLICY "Users can read own codex"
  ON public.codex
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM public.game_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own codex"
  ON public.codex
  FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.game_sessions WHERE user_id = auth.uid()
    )
  );
