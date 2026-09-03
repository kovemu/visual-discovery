create table if not exists public.ai_import_candidates (
  id bigint generated always as identity primary key,
  category text not null check (category in ('kpop', 'cheer')),
  source text not null default 'youtube' check (source = 'youtube'),
  source_id text not null,
  source_url text not null,
  title text not null,
  description text,
  thumbnail_url text,
  published_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  view_count bigint check (view_count is null or view_count >= 0),
  like_count bigint check (like_count is null or like_count >= 0),
  channel_id text,
  channel_title text,
  target_artist_id uuid references public.creators(id) on delete set null,
  ai_score smallint check (ai_score is null or ai_score between 0 and 100),
  ai_reason text,
  ai_content_type text,
  score_breakdown jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  batch_key text,
  imported_work_id bigint references public.works(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (source, source_id)
);

create index if not exists ai_import_candidates_status_category_created_idx
  on public.ai_import_candidates (status, category, created_at desc);
create index if not exists ai_import_candidates_target_artist_idx
  on public.ai_import_candidates (target_artist_id);
create index if not exists ai_import_candidates_imported_work_idx
  on public.ai_import_candidates (imported_work_id)
  where imported_work_id is not null;
create index if not exists ai_import_candidates_batch_key_idx
  on public.ai_import_candidates (batch_key)
  where batch_key is not null;

alter table public.ai_import_candidates enable row level security;
revoke all on table public.ai_import_candidates from anon, authenticated;
grant select, insert, update, delete on table public.ai_import_candidates to service_role;
grant usage, select on sequence public.ai_import_candidates_id_seq to service_role;
