-- Custom Saved order for work_picks.
-- Existing rows remain valid with NULL sort_order; clients fall back to created_at DESC.

ALTER TABLE public.work_picks
  ADD COLUMN IF NOT EXISTS sort_order bigint;

CREATE INDEX IF NOT EXISTS work_picks_user_id_sort_order_idx
  ON public.work_picks (user_id, sort_order ASC NULLS LAST);

  DROP POLICY IF EXISTS "Users update own work picks"
  ON public.work_picks;

CREATE POLICY "Users update own work picks"
  ON public.work_picks
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT UPDATE
  ON TABLE public.work_picks
  TO authenticated;
