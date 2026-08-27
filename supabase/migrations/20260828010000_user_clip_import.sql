-- User YouTube imports: store as works immediately for My Picks,
-- but keep Discover gated until admin approval.

ALTER TABLE public.works
  ALTER COLUMN artist_id DROP NOT NULL;

ALTER TABLE public.work_picks
  ALTER COLUMN artist_id DROP NOT NULL;

ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS discover_eligible boolean NOT NULL DEFAULT true;

-- Existing admin-imported works stay Discover-visible.

CREATE INDEX IF NOT EXISTS works_discover_eligible_idx
  ON public.works (discover_eligible);

ALTER TABLE public.clip_submissions
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS work_id bigint REFERENCES public.works (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clip_submissions_work_id_idx
  ON public.clip_submissions (work_id);

DROP POLICY IF EXISTS "Public read works" ON public.works;

DROP POLICY IF EXISTS "Public read works"
  ON public.works;

DROP POLICY IF EXISTS "Public read discover eligible works"
  ON public.works;

CREATE POLICY "Public read discover eligible works"
  ON public.works
  FOR SELECT
  TO anon, authenticated
  USING (discover_eligible = true);

CREATE POLICY "Users read picked ineligible works"
  ON public.works
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.work_picks
      WHERE work_picks.work_id = works.id
        AND work_picks.user_id = auth.uid()
    )
  );
