-- Person-to-group memberships for K-pop subject classification.
-- Used as matcher context only. Does not replace subjects/aliases.

CREATE TABLE IF NOT EXISTS public.subject_group_memberships (
  person_subject_id uuid NOT NULL REFERENCES public.subjects (id) ON DELETE CASCADE,
  group_subject_id uuid NOT NULL REFERENCES public.subjects (id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'current'
    CHECK (relation_type IN ('current', 'former')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_subject_id, group_subject_id)
);

CREATE INDEX IF NOT EXISTS subject_group_memberships_person_subject_id_idx
  ON public.subject_group_memberships (person_subject_id);

CREATE INDEX IF NOT EXISTS subject_group_memberships_group_subject_id_idx
  ON public.subject_group_memberships (group_subject_id);

ALTER TABLE public.subject_group_memberships ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.subject_group_memberships TO service_role;
