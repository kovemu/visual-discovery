-- Discover candidate pool with effective category semantics:
-- COALESCE(works.discover_category, creators.category)
--
-- Additive view only; no data mutation.

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
  COALESCE(w.discover_category, c.category) AS effective_category
FROM public.works AS w
LEFT JOIN public.creators AS c
  ON c.id = w.artist_id;

GRANT SELECT ON public.discover_works_effective TO anon;
GRANT SELECT ON public.discover_works_effective TO authenticated;
GRANT SELECT ON public.discover_works_effective TO service_role;
