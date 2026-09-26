import { requireAdmin } from '@/lib/auth/admin';
import { getHolidaysForDates } from '@/lib/holidays/queries';
import { AppError, describeDbError, handleRouteError, jsonOk } from '@/lib/http';
import { todayInNepal, type DateStr } from '@/lib/date/nepal';
import { bsMonthDates, bsYearMonthFromInput } from '@/lib/date/bikram';
import type { AttendanceDay, AttendanceStatus } from '@/types/attendance';

export const runtime = 'nodejs';

/**
 * GET /api/admin/employees/:id/attendance?bsYear=2083&bsMonth=6
 *
 * One staff member's month, for the administrator's own calendar view. The
 * month is Bikram Sambat and spans two Gregorian months, so it is expanded to
 * an explicit list of dates first.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAdmin();
    const { id } = await params;

    const url = new URL(request.url);
    const yearMonth = bsYearMonthFromInput(
      `${url.searchParams.get('bsYear')}-${String(url.searchParams.get('bsMonth')).padStart(2, '0')}`,
    );
    if (!yearMonth) throw new AppError('Invalid month requested.', 422);

    const dates = bsMonthDates(yearMonth);

    const [employeeResult, attendanceResult, holidays] = await Promise.all([
      supabase
        .from('employees')
        .select('id, computer_code, full_name, rank, department, office, profile_photo_url, is_active')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('attendance')
        .select('attendance_date, status, remark, locked_by_admin')
        .eq('employee_id', id)
        .gte('attendance_date', dates[0])
        .lte('attendance_date', dates[dates.length - 1])
        .order('attendance_date', { ascending: true }),
      getHolidaysForDates(dates),
    ]);

    if (employeeResult.error) throw new AppError(describeDbError(employeeResult.error), 500);
    if (!employeeResult.data) throw new AppError('Staff member not found.', 404);
    if (attendanceResult.error) throw new AppError(describeDbError(attendanceResult.error), 500);

    const days: AttendanceDay[] = (attendanceResult.data ?? []).map((row) => ({
      date: row.attendance_date as DateStr,
      status: row.status as AttendanceStatus,
      remark: (row.remark as string | null) ?? null,
      lockedByAdmin: Boolean(row.locked_by_admin),
    }));

    return jsonOk({
      employee: employeeResult.data,
      days,
      holidays: [...holidays.values()],
      dates,
      today: todayInNepal(),
    });
  } catch (error) {
    return handleRouteError(error, 'Unable to load that attendance record.');
  }
}
