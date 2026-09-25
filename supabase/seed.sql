-- ============================================================================
-- DEMO DATA — development only.
--
-- These are FICTIONAL people invented for testing. They do not represent real
-- individuals. Delete them before putting the system into real use:
--
--   delete from public.employees where computer_code like 'NP1000%';
--
-- (Attendance rows are removed automatically by the on-delete cascade.)
-- ============================================================================

insert into public.employees (computer_code, full_name, rank, department, office, phone, email)
values
  ('NP10001', 'Ram Sharma',    'Inspector',        'Demo Department', 'Demo Office', '9800000001', 'demo1@example.com'),
  ('NP10002', 'Sita Thapa',    'Sub-Inspector',    'Demo Department', 'Demo Office', '9800000002', 'demo2@example.com'),
  ('NP10003', 'Hari KC',       'Head Constable',   'Traffic Demo',    'Demo Office', '9800000003', 'demo3@example.com'),
  ('NP10004', 'Gita Gurung',   'Constable',        'Traffic Demo',    'Demo Office', '9800000004', 'demo4@example.com'),
  ('NP10005', 'Bikash Rai',    'Assistant Inspector', 'Admin Demo',   'Demo Office', '9800000005', 'demo5@example.com')
on conflict (computer_code) do nothing;

-- A fortnight of sample attendance for the first demo employee so the calendar
-- has something to show immediately.
insert into public.attendance (employee_id, attendance_date, status, remark)
select
  e.id,
  d::date,
  case when extract(dow from d) in (0, 6) then 'absent' else 'present' end,
  case when extract(dow from d) = 0 then 'Weekly rest (demo)' else null end
from public.employees e
cross join generate_series(
  (current_date - interval '14 days')::date,
  (current_date - interval '1 day')::date,
  interval '1 day'
) as d
where e.computer_code = 'NP10001'
on conflict (employee_id, attendance_date) do nothing;
