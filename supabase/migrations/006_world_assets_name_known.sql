-- Migration 006: Add name_known column to world_assets
-- Run this in Supabase SQL Editor after deploying the app update.
--
-- name_known = false means the player hasn't learned the CHARACTER's real
-- identity yet. The display name is a descriptive placeholder until the
-- Day 15 NPC dialogue system calls updateAssetNameRevealed().

ALTER TABLE public.world_assets
  ADD COLUMN IF NOT EXISTS name_known boolean NOT NULL DEFAULT true;

-- Existing CHARACTER rows are backfilled to false — their names may be
-- placeholders from before this feature was added.
UPDATE public.world_assets
  SET name_known = false
  WHERE category = 'CHARACTER';

COMMENT ON COLUMN public.world_assets.name_known
  IS 'false = player has not learned this CHARACTER''s true identity. Always true for non-CHARACTER assets.';
