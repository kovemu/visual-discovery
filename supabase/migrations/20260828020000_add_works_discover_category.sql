-- Discover category for user-imported works without an artist.
-- Admin-imported works keep NULL and continue using creators.category.

ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS discover_category text;

ALTER TABLE public.works
  DROP CONSTRAINT IF EXISTS works_discover_category_check;

ALTER TABLE public.works
  ADD CONSTRAINT works_discover_category_check
  CHECK (
    discover_category IS NULL
    OR discover_category IN ('kpop', 'cheer', 'look')
  );

CREATE INDEX IF NOT EXISTS works_discover_category_idx
  ON public.works (discover_category);
