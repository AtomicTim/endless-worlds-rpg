-- Endless Worlds RPG — Initial Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query)

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- profiles: extends auth.users with display name and avatar seed
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_seed  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- game_sessions: one row per save slot
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_name       TEXT        NOT NULL,
  genre                TEXT        NOT NULL,
  master_state         JSONB       NOT NULL DEFAULT '{}',
  last_played          TIMESTAMPTZ,
  time_played_seconds  INTEGER     NOT NULL DEFAULT 0,
  is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- characters: full stat block for a player character
CREATE TABLE IF NOT EXISTS public.characters (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   UUID        NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  genre        TEXT        NOT NULL,
  health       INTEGER     NOT NULL DEFAULT 100,
  max_health   INTEGER     NOT NULL DEFAULT 100,
  strength     INTEGER     NOT NULL DEFAULT 10,
  agility      INTEGER     NOT NULL DEFAULT 10,
  charisma     INTEGER     NOT NULL DEFAULT 10,
  intelligence INTEGER     NOT NULL DEFAULT 10,
  perception   INTEGER     NOT NULL DEFAULT 10,
  level        INTEGER     NOT NULL DEFAULT 1,
  xp           INTEGER     NOT NULL DEFAULT 0,
  currency     INTEGER     NOT NULL DEFAULT 0,
  background   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- world_states: persistent location and flag data per session
CREATE TABLE IF NOT EXISTS public.world_states (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id           UUID        NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  current_location_id  TEXT        NOT NULL DEFAULT 'start',
  visited_locations    TEXT[]      NOT NULL DEFAULT '{}',
  flags                JSONB       NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- log_books: chronological story log per session (entries stored as JSONB array)
CREATE TABLE IF NOT EXISTS public.log_books (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID        NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  entries    JSONB       NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- npcs: per-session NPC registry with trust scores and memory
CREATE TABLE IF NOT EXISTS public.npcs (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id          UUID        NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  npc_key             TEXT        NOT NULL,
  name                TEXT        NOT NULL,
  role                TEXT,
  relationship_status TEXT        NOT NULL DEFAULT 'neutral',
  trust_score         INTEGER     NOT NULL DEFAULT 50,
  memory_snippets     JSONB       NOT NULL DEFAULT '[]',
  faction_id          TEXT,
  last_interaction    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, npc_key)
);

-- subscriptions: Stripe subscription state per user
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  tier                   TEXT        NOT NULL DEFAULT 'free',
  status                 TEXT        NOT NULL DEFAULT 'active',
  current_period_end     TIMESTAMPTZ,
  daily_actions_used     INTEGER     NOT NULL DEFAULT 0,
  daily_reset_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- community_templates: shareable world configurations
CREATE TABLE IF NOT EXISTS public.community_templates (
  id                    UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id             UUID           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                 TEXT           NOT NULL,
  description           TEXT,
  genre                 TEXT           NOT NULL,
  master_state_template JSONB          NOT NULL DEFAULT '{}',
  rating_avg            NUMERIC(3, 2)  NOT NULL DEFAULT 0,
  play_count            INTEGER        NOT NULL DEFAULT 0,
  tags                  TEXT[]         NOT NULL DEFAULT '{}',
  is_featured           BOOLEAN        NOT NULL DEFAULT FALSE,
  is_approved           BOOLEAN        NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- user_preferences: per-user display and audio settings
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  font_size        TEXT           NOT NULL DEFAULT 'medium',
  font_choice      TEXT           NOT NULL DEFAULT 'mono',
  ascii_art_enabled BOOLEAN       NOT NULL DEFAULT TRUE,
  master_volume    NUMERIC(3, 2)  NOT NULL DEFAULT 0.8,
  ambient_volume   NUMERIC(3, 2)  NOT NULL DEFAULT 0.5,
  difficulty       TEXT           NOT NULL DEFAULT 'normal',
  high_contrast    BOOLEAN        NOT NULL DEFAULT FALSE,
  reduced_motion   BOOLEAN        NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id          ON public.game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_session_id          ON public.characters(session_id);
CREATE INDEX IF NOT EXISTS idx_npcs_session_id                ON public.npcs(session_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id          ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_community_templates_genre      ON public.community_templates(genre);
CREATE INDEX IF NOT EXISTS idx_community_templates_is_featured ON public.community_templates(is_featured);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_states        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_books           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npcs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences    ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles: owner select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: owner insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles: owner update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- game_sessions
CREATE POLICY "game_sessions: owner select" ON public.game_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "game_sessions: owner insert" ON public.game_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "game_sessions: owner update" ON public.game_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "game_sessions: owner delete" ON public.game_sessions FOR DELETE USING (auth.uid() = user_id);

-- characters
CREATE POLICY "characters: owner select" ON public.characters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "characters: owner insert" ON public.characters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "characters: owner update" ON public.characters FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "characters: owner delete" ON public.characters FOR DELETE USING (auth.uid() = user_id);

-- world_states (ownership inferred via game_sessions)
CREATE POLICY "world_states: owner select" ON public.world_states FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.game_sessions gs WHERE gs.id = world_states.session_id AND gs.user_id = auth.uid())
);
CREATE POLICY "world_states: owner insert" ON public.world_states FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.game_sessions gs WHERE gs.id = world_states.session_id AND gs.user_id = auth.uid())
);
CREATE POLICY "world_states: owner update" ON public.world_states FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.game_sessions gs WHERE gs.id = world_states.session_id AND gs.user_id = auth.uid())
);
CREATE POLICY "world_states: owner delete" ON public.world_states FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.game_sessions gs WHERE gs.id = world_states.session_id AND gs.user_id = auth.uid())
);

-- log_books (ownership inferred via game_sessions)
CREATE POLICY "log_books: owner select" ON public.log_books FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.game_sessions gs WHERE gs.id = log_books.session_id AND gs.user_id = auth.uid())
);
CREATE POLICY "log_books: owner insert" ON public.log_books FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.game_sessions gs WHERE gs.id = log_books.session_id AND gs.user_id = auth.uid())
);
CREATE POLICY "log_books: owner update" ON public.log_books FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.game_sessions gs WHERE gs.id = log_books.session_id AND gs.user_id = auth.uid())
);

-- npcs (ownership inferred via game_sessions)
CREATE POLICY "npcs: owner select" ON public.npcs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.game_sessions gs WHERE gs.id = npcs.session_id AND gs.user_id = auth.uid())
);
CREATE POLICY "npcs: owner insert" ON public.npcs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.game_sessions gs WHERE gs.id = npcs.session_id AND gs.user_id = auth.uid())
);
CREATE POLICY "npcs: owner update" ON public.npcs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.game_sessions gs WHERE gs.id = npcs.session_id AND gs.user_id = auth.uid())
);
CREATE POLICY "npcs: owner delete" ON public.npcs FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.game_sessions gs WHERE gs.id = npcs.session_id AND gs.user_id = auth.uid())
);

-- subscriptions (only service-role should insert; user can read/update their own)
CREATE POLICY "subscriptions: owner select" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "subscriptions: owner update" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- community_templates: approved templates readable by all authenticated users; writes by author only
CREATE POLICY "community_templates: approved read" ON public.community_templates
  FOR SELECT USING (auth.uid() IS NOT NULL AND (is_approved = TRUE OR author_id = auth.uid()));
CREATE POLICY "community_templates: author insert" ON public.community_templates FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "community_templates: author update" ON public.community_templates FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "community_templates: author delete" ON public.community_templates FOR DELETE USING (auth.uid() = author_id);

-- user_preferences
CREATE POLICY "user_preferences: owner select" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_preferences: owner insert" ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_preferences: owner update" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Trigger: auto-create profile + free subscription on signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_seed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    md5(NEW.id::text)
  );

  INSERT INTO public.subscriptions (user_id, tier, status, daily_reset_at)
  VALUES (NEW.id, 'free', 'active', NOW());

  RETURN NEW;
END;
$$;

-- Drop before (re)create so this migration is idempotent
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
