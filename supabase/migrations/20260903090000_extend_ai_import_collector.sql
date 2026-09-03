alter table public.ai_import_candidates
  add column if not exists subject_id uuid references public.subjects(id) on delete set null,
  add column if not exists subject_name text,
  add column if not exists heuristic_score smallint check (heuristic_score is null or heuristic_score between 0 and 100);

create index if not exists ai_import_candidates_subject_idx
  on public.ai_import_candidates (subject_id)
  where subject_id is not null;

create table if not exists public.ai_import_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null check (trigger_type in ('manual', 'cron')),
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  error_message text
);

create index if not exists ai_import_runs_started_idx
  on public.ai_import_runs (started_at desc);

alter table public.ai_import_runs enable row level security;
revoke all on table public.ai_import_runs from anon, authenticated;
grant select, insert, update, delete on table public.ai_import_runs to service_role;
