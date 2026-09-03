create or replace function public.ai_import_skip_existing_work_candidate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source = 'youtube' and exists (
    select 1
    from public.works w
    where w.source = 'youtube'
      and w.source_id = new.source_id
  ) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists ai_import_skip_existing_work_candidate on public.ai_import_candidates;
create trigger ai_import_skip_existing_work_candidate
before insert on public.ai_import_candidates
for each row
execute function public.ai_import_skip_existing_work_candidate();

create or replace function public.ai_import_remove_pending_when_work_exists()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source = 'youtube' and new.source_id is not null then
    delete from public.ai_import_candidates c
    where c.status = 'pending'
      and c.source = 'youtube'
      and c.source_id = new.source_id;
  end if;

  return new;
end;
$$;

drop trigger if exists ai_import_remove_pending_when_work_exists on public.works;
create trigger ai_import_remove_pending_when_work_exists
after insert or update of source, source_id on public.works
for each row
execute function public.ai_import_remove_pending_when_work_exists();

delete from public.ai_import_candidates c
using public.works w
where c.status = 'pending'
  and c.source = 'youtube'
  and w.source = 'youtube'
  and c.source_id = w.source_id;
