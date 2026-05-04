-- Migration 005: Add svg_content column to world_assets
-- Run this in Supabase SQL Editor after deploying the app update.

ALTER TABLE public.world_assets
  ADD COLUMN IF NOT EXISTS svg_content text;

COMMENT ON COLUMN public.world_assets.svg_content
  IS 'Cached SVG pixel-art for this asset (populated by the art engine after first generation).';
