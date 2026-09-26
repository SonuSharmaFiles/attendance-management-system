import { getEmployeeSession } from '@/lib/auth/employee-session';
import {
  getAttendanceForDate,
  getAttendanceRange,
  upsertAttendance,
} from '@/lib/attendance/queries';
import { getHolidaysForDates, isHoliday } from '@/lib/holidays/queries';
import { markAttendanceSchema } from '@/lib/validation/schemas';
import { AppError, handleRouteError, jsonOk, readJson } from '@/lib/http';
import { getAppSettings } from '@/lib/config';
import { compareDateStr, todayInNepal } from '@/lib/date/nepal';
import { bsMonthDates, bsLongLabel, bsYearMonthFromInput, toBs } from '@/lib/date/bikram';

export const runtime = 'nodejs';

/**
 * Employee attendance API.
 *
 * The employee id comes from the signed session cookie on every request, never
 * from the URL or body, so a user cannot reach another employee's records.
 *
 * The month here is a BIKRAM SAMBAT month. A BS month spans two Gregorian
 * months, so the server expands it to an explicit list of dates and works from
 * that.
 */

/** GET /api/attendance?bsYear=2083&bsMonth=6 */
export async function GET(request: Request) {
  try {
    const session = await getEmployeeSession();
    if (!session) throw new AppError('Your session has expired. Please enter your code again.', 401);

    const url = new URL(request.url);
    const yearMonth = bsYearMonthFromInput(
      `${url.searchParams.get('bsYear')}-${String(url.searchParams.get('bsMonth')).padStart(2, '0')}`,
    );
    if (!yearMonth) throw new AppError('Invalid month requested.', 422);

    const dates = bsMonthDates(yearMonth);
    const [days, holidays] = await Promise.all([
      getAttendanceRange(session.sub, dates[0], dates[dates.length - 1]),
      getHolidaysForDates(dates),
    ]);

    return jsonOk({
      days,
      holidays: [...holidays.values()],
      dates,
      today: todayInNepal(),
    });
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
        `${bsLongLabel(toBs(parsed.date))} has not happened yet. Attendance can only be marked up to today.`,
        422,
      );
    }

    const existing = await getAttendanceForDate(session.sub, parsed.date);

    // THE ADMIN LOCK, checked FIRST. An administrator may deliberately set a
    // day that is also a holiday — someone who worked through it. Checking the
    // holiday first would then report "this is a holiday" when the real reason
    // is that an administrator set it, which is both less accurate and less
    // useful to the person reading it.
    if (existing?.lockedByAdmin) {
      throw new AppError('Updated by administrator', 423);
    }

    // Otherwise a holiday is simply not a working day, so there is nothing for
    // staff to mark.
    const holiday = await isHoliday(parsed.date);
    if (holiday) {
      throw new AppError(
        `${bsLongLabel(toBs(parsed.date))} is a holiday (${holiday.title}). Contact an administrator if this is wrong.`,
        403,
      );
    }

    if (existing && !settings.attendanceEditEnabled) {
      throw new AppError(
        'Attendance for this date has already been submitted and can no longer be changed. Please contact an administrator.',
        403,
      );
    }

    const day = await upsertAttendance({
      employeeId: session.sub,
      date: parsed.date,
      status: parsed.status,
      remark: parsed.remark ?? null,
      lockedByAdmin: false,
    });

    return jsonOk({ day });
  } catch (error) {
    return handleRouteError(error, 'Unable to save attendance. Please try again.');
  }
}
