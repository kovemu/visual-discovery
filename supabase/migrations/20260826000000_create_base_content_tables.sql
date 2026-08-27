-- Base content tables for visual-discovery (creators, works, work_picks).
-- Derived from application queries; required before product_events / clip_submissions.

CREATE TABLE IF NOT EXISTS public.creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  name text NOT NULL,
  username text,
  category text NOT NULL,
  tagline text,
  bio text,
  profile_image text,
  cover_image text,
  cover_position_x integer NOT NULL DEFAULT 50,
  cover_position_y integer NOT NULL DEFAULT 50,
  youtube_url text,
  instagram_url text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  is_curated boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creators_username_key UNIQUE (username)
);

CREATE UNIQUE INDEX IF NOT EXISTS creators_user_id_key
  ON public.creators (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS creators_category_idx
  ON public.creators (category);

CREATE INDEX IF NOT EXISTS creators_tags_gin_idx
  ON public.creators USING GIN (tags);

CREATE TABLE IF NOT EXISTS public.works (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  artist_id uuid NOT NULL REFERENCES public.creators (id) ON DELETE CASCADE,
  type text NOT NULL,
  source text NOT NULL,
  source_id text NOT NULL,
  source_url text NOT NULL,
  title text,
  description text,
  thumbnail_url text,
  published_at timestamptz,
  duration_seconds integer,
  featured boolean NOT NULL DEFAULT false,
  CONSTRAINT works_source_source_id_key UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS works_artist_id_idx
  ON public.works (artist_id);

CREATE INDEX IF NOT EXISTS works_published_at_idx
  ON public.works (published_at DESC);

CREATE INDEX IF NOT EXISTS works_featured_idx
  ON public.works (featured);

CREATE TABLE IF NOT EXISTS public.work_picks (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  work_id bigint NOT NULL REFERENCES public.works (id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.creators (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, work_id)
);

CREATE INDEX IF NOT EXISTS work_picks_user_id_created_at_idx
  ON public.work_picks (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS work_picks_work_id_idx
  ON public.work_picks (work_id);

ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read creators"
  ON public.creators
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users update own creator profile"
  ON public.creators
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Public read works"
  ON public.works
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users read own work picks"
  ON public.work_picks
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own work picks"
  ON public.work_picks
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own work picks"
  ON public.work_picks
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
