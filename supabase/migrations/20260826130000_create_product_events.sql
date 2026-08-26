-- First-party MVP product analytics events.
-- Writes are performed server-side via /api/analytics/events (service role).

CREATE TABLE IF NOT EXISTS public.product_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_name text NOT NULL,
  session_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  artist_id uuid REFERENCES public.creators (id) ON DELETE SET NULL,
  work_id bigint REFERENCES public.works (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_events_event_name_created_at_idx
  ON public.product_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS product_events_session_id_created_at_idx
  ON public.product_events (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS product_events_user_id_created_at_idx
  ON public.product_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;
