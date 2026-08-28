-- Per-work media orientation for sideways YouTube imports.

ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS rotation_degrees smallint NOT NULL DEFAULT 0;

ALTER TABLE public.works
  DROP CONSTRAINT IF EXISTS works_rotation_degrees_check;

ALTER TABLE public.works
  ADD CONSTRAINT works_rotation_degrees_check
  CHECK (rotation_degrees IN (0, 90, 270));
