-- ============================================================================
-- Holidays, and administrator locks on attendance.
-- Run after 0003_harden_functions.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Holidays
--
-- Stored as RULES, not as one row per day. "Every Saturday, forever" is a
-- single record — not 50,000 rows that would need topping up each year.
--
-- Dates stay in the Gregorian calendar here, exactly like `attendance`. The
-- Bikram Sambat calendar is a presentation layer: converting stored dates
-- would break every existing record, export and query for no benefit.
-- ---------------------------------------------------------------------------
create table if not exists public.holidays (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  note        text,

  -- 'once'    : start_date .. coalesce(end_date, start_date)
  -- 'weekly'  : every `weekday`, from start_date until end_date (null = ongoing)
  -- 'monthly' : day `bs_day` of every Bikram Sambat month, same window
  recurrence  text not null check (recurrence in ('once', 'weekly', 'monthly')),
  weekday     smallint check (weekday between 0 and 6),   -- 0 = Sunday (Aaitabaar)
  bs_day      smallint check (bs_day between 1 and 32),   -- BS months run 29-32 days

  start_date  date not null,
  end_date    date,
  is_active   boolean not null default true,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint holidays_title_not_blank
    check (char_length(btrim(title)) >= 2),
  -- Each recurrence type uses exactly the fields it needs, and no others.
  constraint holidays_shape check (
       (recurrence = 'once'    and weekday is null     and bs_day is null)
    or (recurrence = 'weekly'  and weekday is not null and bs_day is null)
    or (recurrence = 'monthly' and weekday is null     and bs_day is not null)
  ),
  constraint holidays_dates_ordered
    check (end_date is null or end_date >= start_date)
);

create index if not exists holidays_active_idx on public.holidays (is_active);
create index if not exists holidays_window_idx on public.holidays (start_date, end_date);

drop trigger if exists holidays_touch_updated_at on public.holidays;
create trigger holidays_touch_updated_at
  before update on public.holidays
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Administrator locks on attendance
--
-- When an administrator sets or corrects a day, staff must not be able to
-- change it back. The flag records who last wrote the row.
-- ---------------------------------------------------------------------------
alter table public.attendance
  add column if not exists locked_by_admin boolean not null default false;

comment on column public.attendance.locked_by_admin is
  'True when an administrator set this row. Staff receive "Updated by administrator" and cannot change it.';

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
--
-- Same shape as the other tables: admins manage, anonymous gets nothing, and
-- staff reach holidays only through server routes using the service role.
-- ---------------------------------------------------------------------------
alter table public.holidays enable row level security;
alter table public.holidays force row level security;

drop policy if exists "holidays: admins read" on public.holidays;
create policy "holidays: admins read"
  on public.holidays for select
  to authenticated
  using (public.is_admin());

drop policy if exists "holidays: admins write" on public.holidays;
create policy "holidays: admins write"
  on public.holidays for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. Saturday, pre-loaded
--
-- Seeded as an ordinary rule rather than hard-coded, so an administrator can
-- rename it, end it, or switch it off like any other holiday.
-- ---------------------------------------------------------------------------
insert into public.holidays (title, note, recurrence, weekday, start_date)
select 'Shanibaar (Saturday)', 'Weekly holiday. Added automatically — edit or remove it like any other.', 'weekly', 6, date '2000-01-01'
where not exists (
  select 1 from public.holidays where recurrence = 'weekly' and weekday = 6
);
