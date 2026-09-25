-- ============================================================================
-- Attendance Management System — initial schema
-- Run this in the Supabase SQL Editor (or `supabase db push`).
-- Safe to re-run: every object is created with IF NOT EXISTS / OR REPLACE.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Profiles — one row per Supabase Auth user. Drives admin access.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'employee'
                check (role in ('admin', 'employee')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Application role for each authenticated user. Only role = admin may use the admin dashboard.';

-- Every new auth user starts as a non-admin. Promote deliberately (see README).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Employees
-- ---------------------------------------------------------------------------
create table if not exists public.employees (
  id                 uuid primary key default gen_random_uuid(),
  computer_code      text not null,
  full_name          text not null,
  rank               text,
  department         text,
  office             text,
  phone              text,
  email              text,
  profile_photo_url  text,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint employees_computer_code_format
    check (computer_code ~ '^[A-Z0-9][A-Z0-9._-]*$' and char_length(computer_code) between 3 and 32),
  constraint employees_full_name_not_blank
    check (char_length(btrim(full_name)) >= 2)
);

-- Computer codes are the login identifier, so they must be unique.
-- Codes are normalised to upper case by the application before insert.
create unique index if not exists employees_computer_code_key
  on public.employees (computer_code);

create index if not exists employees_department_idx on public.employees (department);
create index if not exists employees_is_active_idx  on public.employees (is_active);
create index if not exists employees_full_name_idx  on public.employees (lower(full_name));

-- ---------------------------------------------------------------------------
-- 3. Attendance
-- ---------------------------------------------------------------------------
create table if not exists public.attendance (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references public.employees (id) on delete cascade,
  attendance_date  date not null,
  status           text not null check (status in ('present', 'absent')),
  remark           text check (remark is null or char_length(remark) <= 300),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- THE critical constraint: one row per employee per calendar day.
-- The application upserts on this pair, so a status change updates in place.
create unique index if not exists attendance_employee_date_key
  on public.attendance (employee_id, attendance_date);

create index if not exists attendance_date_idx        on public.attendance (attendance_date);
create index if not exists attendance_employee_idx    on public.attendance (employee_id);
create index if not exists attendance_status_date_idx on public.attendance (status, attendance_date);

-- ---------------------------------------------------------------------------
-- 4. updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists employees_touch_updated_at on public.employees;
create trigger employees_touch_updated_at
  before update on public.employees
  for each row execute function public.touch_updated_at();

drop trigger if exists attendance_touch_updated_at on public.attendance;
create trigger attendance_touch_updated_at
  before update on public.attendance
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
--
-- Design: RLS is DENY BY DEFAULT. Enabling RLS with no matching policy blocks
-- every request, so the anon key alone can read nothing — anonymous visitors
-- cannot list employees or enumerate computer codes.
--
--   * Signed-in admins       -> full access, granted by the policies below.
--   * Signed-in non-admins   -> may read only their own profile row.
--   * Anonymous (anon key)   -> no policy matches, so no access at all.
--   * Employee self-service  -> goes through server routes that hold the
--                               service-role key and scope every query to the
--                               employee id in the signed session cookie.
-- ---------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.employees  enable row level security;
alter table public.attendance enable row level security;

-- Force RLS so even the table owner is subject to it (service role still bypasses).
alter table public.employees  force row level security;
alter table public.attendance force row level security;

-- SECURITY DEFINER so the lookup itself is not filtered by the profiles policy,
-- which would otherwise recurse.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Profiles ------------------------------------------------------------------
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "profiles: admins read all" on public.profiles;
create policy "profiles: admins read all"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

drop policy if exists "profiles: admins manage" on public.profiles;
create policy "profiles: admins manage"
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Employees -----------------------------------------------------------------
drop policy if exists "employees: admins read" on public.employees;
create policy "employees: admins read"
  on public.employees for select
  to authenticated
  using (public.is_admin());

drop policy if exists "employees: admins write" on public.employees;
create policy "employees: admins write"
  on public.employees for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Attendance ----------------------------------------------------------------
drop policy if exists "attendance: admins read" on public.attendance;
create policy "attendance: admins read"
  on public.attendance for select
  to authenticated
  using (public.is_admin());

drop policy if exists "attendance: admins write" on public.attendance;
create policy "attendance: admins write"
  on public.attendance for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Note: there is intentionally NO policy for the `anon` role on employees or
-- attendance. Do not add one — it would let anybody with the public anon key
-- download the whole staff list.
