-- Independent thumbnail orientation, separate from player rotation_degrees.
-- Additive only. Existing rotation_degrees values are unchanged.
-- Existing rows keep thumbnail_rotation_degrees = 0 (column default).

ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS thumbnail_rotation_degrees smallint NOT NULL DEFAULT 0;

ALTER TABLE public.works
  DROP CONSTRAINT IF EXISTS works_thumbnail_rotation_degrees_check;

ALTER TABLE public.works
  ADD CONSTRAINT works_thumbnail_rotation_degrees_check
  CHECK (thumbnail_rotation_degrees IN (0, 90, 270));

CREATE OR REPLACE VIEW public.discover_works_effective
WITH (security_invoker = true)
AS
SELECT
  w.id,
  w.artist_id,
  w.type,
  w.source,
  w.source_id,
  w.source_url,
  w.title,
  w.description,
  w.thumbnail_url,
  w.published_at,
  w.duration_seconds,
  w.featured,
  w.discover_eligible,
  w.discover_category,
  w.rotation_degrees,
  
  c.name AS artist_name,
  c.username AS artist_username,
  c.category AS artist_category,
  c.tags AS artist_tags,
  COALESCE(w.discover_category, c.category) AS effective_category,
  w.thumbnail_rotation_degrees
FROM public.works AS w
LEFT JOIN public.creators AS c
  ON c.id = w.artist_id;

GRANT SELECT ON public.discover_works_effective TO anon;
GRANT SELECT ON public.discover_works_effective TO authenticated;
GRANT SELECT ON public.discover_works_effective TO service_role;
