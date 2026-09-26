-- ============================================================================
-- Leave as a third attendance state.
-- Run after 0005_backups.sql.
-- ============================================================================

-- Leave is stored as an attendance row, not in a separate table. It is a
-- per-day state exactly like present and absent, so it inherits everything
-- already built: the unique row-per-day rule, the administrator lock, the
-- summary, the exports and the calendar. A separate ranges table would mean
-- merging two sources in every one of those places.
alter table public.attendance
  drop constraint if exists attendance_status_check;

alter table public.attendance
  add constraint attendance_status_check
  check (status in ('present', 'absent', 'leave'));

comment on column public.attendance.status is
  'present | absent | leave. Leave is assigned by an administrator over a date range and is never counted as absent.';
