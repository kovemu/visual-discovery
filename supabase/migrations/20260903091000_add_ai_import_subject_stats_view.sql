create or replace view public.ai_import_subject_stats
with (security_invoker = true)
as
select
  s.id as subject_id,
  s.category,
  count(ws.work_id) filter (where coalesce(w.discover_eligible, false))::bigint as work_count,
  max(w.published_at) filter (where coalesce(w.discover_eligible, false)) as latest_published_at
from public.subjects s
left join public.work_subjects ws on ws.subject_id = s.id
left join public.works w on w.id = ws.work_id
group by s.id, s.category;

revoke all on table public.ai_import_subject_stats from anon, authenticated;
grant select on table public.ai_import_subject_stats to service_role;
