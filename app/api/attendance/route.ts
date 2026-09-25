import { getEmployeeSession } from '@/lib/auth/employee-session';
import { getMonthAttendance, upsertAttendance } from '@/lib/attendance/queries';
import { markAttendanceSchema, yearMonthSchema } from '@/lib/validation/schemas';
import { AppError, handleRouteError, jsonOk, readJson } from '@/lib/http';
import { getAppSettings } from '@/lib/config';
import { compareDateStr, longDateLabel, todayInNepal } from '@/lib/date/nepal';

export const runtime = 'nodejs';

/**
 * Employee attendance API.
 *
 * The employee id comes from the signed session cookie on every request. It is
 * never read from the URL, the query string or the JSON body, so a user cannot
 * reach another employee's records by editing what the browser sends.
 */

/** GET /api/attendance?year=2026&month=9 — one month for the signed-in employee. */
export async function GET(request: Request) {
  try {
    const session = await getEmployeeSession();
    if (!session) throw new AppError('Your session has expired. Please enter your code again.', 401);

    const url = new URL(request.url);
    const parsed = yearMonthSchema.safeParse({
      year: url.searchParams.get('year'),
      month: url.searchParams.get('month'),
    });
    if (!parsed.success) throw new AppError('Invalid month requested.', 422);

    const days = await getMonthAttendance(session.sub, parsed.data);
    return jsonOk({ days, today: todayInNepal() });
  } catch (error) {
    return handleRouteError(error, 'Unable to load attendance. Please try again.');
  }
}

/** POST /api/attendance — mark or change one day. */
export async function POST(request: Request) {
  try {
    const session = await getEmployeeSession();
    if (!session) throw new AppError('Your session has expired. Please enter your code again.', 401);

    const parsed = markAttendanceSchema.parse(await readJson(request));
    const settings = getAppSettings();
    const today = todayInNepal();

    if (!settings.allowFutureAttendance && compareDateStr(parsed.date, today) > 0) {
      throw new AppError(
        `${longDateLabel(parsed.date)} has not happened yet. Attendance can only be marked up to today.`,
        422,
      );
    }

    if (!settings.attendanceEditEnabled) {
      const { getAttendanceForDate } = await import('@/lib/attendance/queries');
      const existing = await getAttendanceForDate(session.sub, parsed.date);
      if (existing) {
        throw new AppError(
          'Attendance for this date has already been submitted and can no longer be changed. Please contact an administrator.',
          403,
        );
      }
    }

    const day = await upsertAttendance({
      employeeId: session.sub,
      date: parsed.date,
      status: parsed.status,
      remark: parsed.remark ?? null,
    });

    return jsonOk({ day });
  } catch (error) {
    return handleRouteError(error, 'Unable to save attendance. Please try again.');
  }
}
