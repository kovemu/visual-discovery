create schema if not exists private;

alter table public.works
  add column if not exists discover_added_at timestamptz;

alter table public.works
  alter column discover_added_at set default now();

create or replace function private.stamp_discover_added_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.discover_eligible is true and new.discover_added_at is null then
      new.discover_added_at := now();
    end if;
  elsif tg_op = 'UPDATE' then
    if new.discover_eligible is true
       and old.discover_eligible is distinct from true then
      new.discover_added_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists works_stamp_discover_added_at on public.works;
create trigger works_stamp_discover_added_at
before insert or update of discover_eligible on public.works
for each row
execute function private.stamp_discover_added_at();

create index if not exists works_discover_added_at_idx
on public.works (discover_added_at desc, id desc)
where discover_eligible = true and featured = false;

create or replace view public.discover_works_effective as
select
  w.id,
  w.artist_id,
  w.type,
  w.source,
  w.source_id,
  w.source_url,
  w.title,
  w.description,
  w.thumbnail_url,
  w.published_at,
  w.duration_seconds,
  w.featured,
  w.discover_eligible,
  w.discover_category,
  w.rotation_degrees,
  c.name as artist_name,
  c.username as artist_username,
  c.category as artist_category,
  c.tags as artist_tags,
  coalesce(w.discover_category, c.category) as effective_category,
  w.thumbnail_rotation_degrees,
  w.discover_added_at
from public.works w
left join public.creators c on c.id = w.artist_id;
