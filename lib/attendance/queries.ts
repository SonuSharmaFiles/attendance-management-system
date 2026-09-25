import { getServiceClient } from '@/lib/supabase/admin';
import { AppError, describeDbError } from '@/lib/errors';
import { monthBounds, type DateStr, type YearMonth } from '@/lib/date/nepal';
import type { AttendanceDay, AttendanceStatus } from '@/types/attendance';

/**
 * All queries here are scoped to a single employee id that the caller has
 * already authenticated. Only the requested date window is fetched — the
 * calendar never pulls the whole attendance table.
 */

export async function getAttendanceRange(
  employeeId: string,
  from: DateStr,
  to: DateStr,
): Promise<AttendanceDay[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('attendance')
    .select('attendance_date, status, remark')
    .eq('employee_id', employeeId)
    .gte('attendance_date', from)
    .lte('attendance_date', to)
    .order('attendance_date', { ascending: true });

  if (error) throw new AppError(describeDbError(error), 500);

  return (data ?? []).map((row) => ({
    date: row.attendance_date as DateStr,
    status: row.status as AttendanceStatus,
    remark: (row.remark as string | null) ?? null,
  }));
}

export async function getMonthAttendance(
  employeeId: string,
  yearMonth: YearMonth,
): Promise<AttendanceDay[]> {
  const { start, end } = monthBounds(yearMonth);
  return getAttendanceRange(employeeId, start, end);
}

/**
 * Inserts or updates the single row for (employee, date).
 *
 * The unique index on (employee_id, attendance_date) plus onConflict makes this
 * idempotent: marking the same day twice updates in place instead of creating a
 * duplicate, no matter how many times the button is clicked.
 */
export async function upsertAttendance(params: {
  employeeId: string;
  date: DateStr;
  status: AttendanceStatus;
  remark: string | null;
}): Promise<AttendanceDay> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('attendance')
    .upsert(
      {
        employee_id: params.employeeId,
        attendance_date: params.date,
        status: params.status,
        // A present day never keeps a stale absence reason.
        remark: params.status === 'absent' ? params.remark : null,
      },
      { onConflict: 'employee_id,attendance_date' },
    )
    .select('attendance_date, status, remark')
    .single();

  if (error) throw new AppError(describeDbError(error), 400);

  return {
    date: data.attendance_date as DateStr,
    status: data.status as AttendanceStatus,
    remark: (data.remark as string | null) ?? null,
  };
}

export async function deleteAttendance(employeeId: string, date: DateStr): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('employee_id', employeeId)
    .eq('attendance_date', date);

  if (error) throw new AppError(describeDbError(error), 400);
}

export async function getAttendanceForDate(
  employeeId: string,
  date: DateStr,
): Promise<AttendanceDay | null> {
  const rows = await getAttendanceRange(employeeId, date, date);
  return rows[0] ?? null;
}
