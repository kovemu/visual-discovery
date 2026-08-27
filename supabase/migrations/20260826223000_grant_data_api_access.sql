-- Explicit Data API privileges for MVP tables.
-- Required when Supabase "Automatically expose new tables" is disabled.
-- RLS policies remain unchanged; GRANTs only define role-level table access.

-- ---------------------------------------------------------------------------
-- public.creators
-- ---------------------------------------------------------------------------

GRANT SELECT ON TABLE public.creators TO anon;

GRANT SELECT, UPDATE ON TABLE public.creators TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.creators
  TO service_role;

-- ---------------------------------------------------------------------------
-- public.works
-- ---------------------------------------------------------------------------

GRANT SELECT ON TABLE public.works TO anon;

GRANT SELECT ON TABLE public.works TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.works
  TO service_role;

-- Identity column insert (admin importer / service role)
GRANT USAGE, SELECT ON SEQUENCE public.works_id_seq TO service_role;

-- ---------------------------------------------------------------------------
-- public.work_picks
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, DELETE
  ON TABLE public.work_picks
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.work_picks
  TO service_role;

-- ---------------------------------------------------------------------------
-- public.product_events
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.product_events
  TO service_role;

-- Identity column insert (analytics API / service role)
GRANT USAGE, SELECT ON SEQUENCE public.product_events_id_seq TO service_role;

-- ---------------------------------------------------------------------------
-- public.clip_submissions
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT
  ON TABLE public.clip_submissions
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.clip_submissions
  TO service_role;
