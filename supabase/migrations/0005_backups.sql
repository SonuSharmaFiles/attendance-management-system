-- ============================================================================
-- Automatic Excel backups.
-- Run after 0004_holidays_and_locks.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Settings
--
-- A tiny key/value table so an administrator can change when the backup runs
-- from inside the app. The schedule itself cannot live in the workflow file:
-- editing YAML is not something an administrator should have to do.
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

drop trigger if exists app_settings_touch_updated_at on public.app_settings;
create trigger app_settings_touch_updated_at
  before update on public.app_settings
  for each row execute function public.touch_updated_at();

insert into public.app_settings (key, value)
values ('backup_day_of_month', '1')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Backup history
-- ---------------------------------------------------------------------------
create table if not exists public.backups (
  id           uuid primary key default gen_random_uuid(),
  bs_year      integer not null,
  file_path    text not null unique,
  file_size    bigint not null default 0,
  staff_count  integer not null default 0,
  record_count integer not null default 0,
  -- 'scheduled' when the robot made it, 'manual' when an administrator did.
  source       text not null default 'scheduled'
                 check (source in ('scheduled', 'manual')),
  created_at   timestamptz not null default now()
);

create index if not exists backups_created_idx on public.backups (created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Storage
--
-- PRIVATE, unlike the photo bucket. These workbooks contain the attendance of
-- every member of staff, so they must never be readable by URL alone. The
-- admin page hands out short-lived signed links instead.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('attendance-backups', 'attendance-backups', false, 52428800)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

-- No anon policy at all, and no authenticated policy either: every read and
-- write goes through the server with the service-role key.
drop policy if exists "backups: admin read" on storage.objects;
create policy "backups: admin read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'attendance-backups' and public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.app_settings enable row level security;
alter table public.backups      enable row level security;
alter table public.app_settings force row level security;
alter table public.backups      force row level security;

drop policy if exists "app_settings: admins" on public.app_settings;
create policy "app_settings: admins"
  on public.app_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "backups: admins" on public.backups;
create policy "backups: admins"
  on public.backups for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
