-- Anonymous users use the authenticated role. Public posting must stay
-- real-account-only even if a client bypasses UI checks.

DROP POLICY IF EXISTS "Users can insert own clip submissions"
  ON public.clip_submissions;

CREATE POLICY "Users can insert own clip submissions"
  ON public.clip_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );
