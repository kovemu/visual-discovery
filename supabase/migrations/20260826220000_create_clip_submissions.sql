-- User-submitted clip URLs for admin review (no auto-import to works).

CREATE TABLE IF NOT EXISTS public.clip_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  source_url text NOT NULL,
  source_type text NOT NULL,
  confirmed_18_plus boolean NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT clip_submissions_source_type_check
    CHECK (source_type IN ('youtube', 'tiktok')),
  CONSTRAINT clip_submissions_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS clip_submissions_status_idx
  ON public.clip_submissions (status);

CREATE INDEX IF NOT EXISTS clip_submissions_created_at_idx
  ON public.clip_submissions (created_at DESC);

CREATE INDEX IF NOT EXISTS clip_submissions_user_id_idx
  ON public.clip_submissions (user_id);

ALTER TABLE public.clip_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own clip submissions"
  ON public.clip_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own clip submissions"
  ON public.clip_submissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
