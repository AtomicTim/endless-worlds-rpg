-- Endless Worlds RPG — World Assets (Day 13.5)
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query)
--
-- Stores the immutable constitution of every named entity the Narrator
-- introduces — locations, characters, factions, items, lore, creatures.
-- Each asset is keyed by (session_id, asset_id) so each save slot has its
-- own canonical world. Constitutions are write-once: the first introduction
-- is law, and the Narrator must remain consistent with it forever after.

CREATE TABLE IF NOT EXISTS public.world_assets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  asset_id            text NOT NULL,
  category            text NOT NULL,
  name                text NOT NULL,
  constitution        jsonb NOT NULL,
  significance        text NOT NULL DEFAULT 'NOTABLE',
  first_seen_location text,
  created_at          timestamptz NOT NULL DEFAULT NOW(),
  updated_at          timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT world_assets_session_asset_unique UNIQUE (session_id, asset_id)
);

CREATE INDEX IF NOT EXISTS world_assets_session_idx
  ON public.world_assets (session_id);
CREATE INDEX IF NOT EXISTS world_assets_category_idx
  ON public.world_assets (session_id, category);

ALTER TABLE public.world_assets ENABLE ROW LEVEL SECURITY;

-- Drop any prior versions of the policies so the migration is idempotent.
DROP POLICY IF EXISTS "Users can read own world assets"   ON public.world_assets;
DROP POLICY IF EXISTS "Users can insert own world assets" ON public.world_assets;
DROP POLICY IF EXISTS "Users can update own world assets" ON public.world_assets;

CREATE POLICY "Users can read own world assets"
  ON public.world_assets
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM public.game_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own world assets"
  ON public.world_assets
  FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.game_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own world assets"
  ON public.world_assets
  FOR UPDATE
  USING (
    session_id IN (
      SELECT id FROM public.game_sessions WHERE user_id = auth.uid()
    )
  );
