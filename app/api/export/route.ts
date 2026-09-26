import { getEmployeeSession } from '@/lib/auth/employee-session';
import { getEmployeeById } from '@/lib/employees/queries';
import { getAttendanceRange } from '@/lib/attendance/queries';
import { buildReportRows } from '@/lib/attendance/summary';
import { getHolidaysForDates } from '@/lib/holidays/queries';
import { buildAttendanceWorkbook, rowsToCsv } from '@/lib/excel/export';
import { buildAttendancePdf } from '@/lib/pdf/report';
import {
  attendanceFilename,
  CONTENT_TYPES,
  periodLabel,
  type ExportFormat,
} from '@/lib/excel/filenames';
import { exportRequestSchema } from '@/lib/validation/schemas';
import { AppError, handleRouteError, readJson } from '@/lib/http';
import { getAppSettings, MAX_EXPORT_MONTHS } from '@/lib/config';
import {
  compareYearMonth,
  datesBetweenMonths,
  monthBounds,
  todayInNepal,
  yearMonthFromInput,
} from '@/lib/date/nepal';

export const runtime = 'nodejs';
// Building a workbook or PDF is CPU work; give it room on serverless platforms.
export const maxDuration = 60;

/**
 * POST /api/export — download the signed-in employee's own attendance.
 * Scoped to the session, so no employee id is accepted from the browser.
 */
export async function POST(request: Request) {
  try {
    const session = await getEmployeeSession();
    if (!session) throw new AppError('Your session has expired. Please enter your code again.', 401);

    const parsed = exportRequestSchema.parse(await readJson(request));
    const from = yearMonthFromInput(parsed.fromMonth);
    const to = yearMonthFromInput(parsed.toMonth);
    if (!from || !to) throw new AppError('Please choose a valid month range.', 422);

    const monthSpan = compareYearMonth(to, from) + 1;
    if (monthSpan > MAX_EXPORT_MONTHS) {
      throw new AppError(`Please choose a range of ${MAX_EXPORT_MONTHS} months or fewer.`, 422);
    }

    const employee = await getEmployeeById(session.sub);
    if (!employee) throw new AppError('Employee record not found.', 404);

    const start = monthBounds(from).start;
    const end = monthBounds(to).end;
    const records = await getAttendanceRange(employee.id, start, end);

    // Never list days that have not happened yet.
    const today = todayInNepal();
    const dates = datesBetweenMonths(from, to).filter((date) => date <= today);

    // Without this, every Saturday would read "Not Marked" in the report.
    const holidays = await getHolidaysForDates(dates);
    const rows = buildReportRows(employee, dates, records, { holidays });
    const label = periodLabel(from, to);
    const format = parsed.format as ExportFormat;
    const filename = attendanceFilename(employee.computer_code, from, to, format);

    let body: Buffer | string;
    if (format === 'csv') {
      body = rowsToCsv(rows);
    } else if (format === 'pdf') {
      body = buildAttendancePdf(rows, {
        organisationName: getAppSettings().organisationName,
        employeeName: employee.full_name,
        computerCode: employee.computer_code,
        rank: employee.rank,
        department: employee.department,
        periodLabel: label,
      });
    } else {
      body = await buildAttendanceWorkbook(rows, {
        employeeName: employee.full_name,
        computerCode: employee.computer_code,
        rank: employee.rank,
        department: employee.department,
        periodLabel: label,
      });
    }

    return new Response(body as BodyInit, {
      headers: {
        'Content-Type': CONTENT_TYPES[format],
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleRouteError(error, 'The report could not be generated. Please try again.');
  }
}
