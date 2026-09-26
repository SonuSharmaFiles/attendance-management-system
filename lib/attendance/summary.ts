import { compareDateStr, dayName, type DateStr } from '@/lib/date/nepal';
import type {
  AttendanceDay,
  AttendanceReportRow,
  CalendarHoliday,
  MonthlySummary,
} from '@/types/attendance';
import type { Employee } from '@/types/employee';

/**
 * Monthly totals.
 *
 * Works from an explicit list of dates rather than a Gregorian month, because
 * the calendar shown to staff is Bikram Sambat and a BS month straddles two
 * Gregorian ones.
 *
 * Three kinds of day are deliberately excluded from "Not Marked":
 *   - days that have not happened yet
 *   - holidays, which nobody is expected to mark
 *   - approved leave
 * Otherwise every Saturday, and every approved day off, would quietly count
 * against an employee.
 */
export function summariseDates(
  dates: DateStr[],
  days: AttendanceDay[],
  holidays: Map<DateStr, CalendarHoliday>,
  today: DateStr,
): MonthlySummary {
  const byDate = new Map(days.map((day) => [day.date, day]));

  let present = 0;
  let absent = 0;
  let notMarked = 0;
  let holidayCount = 0;
  let leaveCount = 0;
  let elapsedDays = 0;

  for (const date of dates) {
    const isFuture = compareDateStr(date, today) > 0;
    const isHoliday = holidays.has(date);

    if (isHoliday) {
      holidayCount += 1;
      // An administrator may still record someone as present on a holiday
      // (they worked), and that should count.
      const record = byDate.get(date);
      if (record?.status === 'present') present += 1;
      continue;
    }

    const record = byDate.get(date);

    // Approved leave is not a working day and is never held against anyone,
    // so it is excluded from the rate as well as from Not Marked.
    if (record?.status === 'leave') {
      leaveCount += 1;
      continue;
    }

    if (!isFuture) elapsedDays += 1;

    if (record?.status === 'present') present += 1;
    else if (record?.status === 'absent') absent += 1;
    else if (!isFuture) notMarked += 1;
  }

  const marked = present + absent;
  const attendanceRate = marked === 0 ? 0 : Math.round((present / marked) * 10000) / 100;

  return {
    totalDays: dates.length,
    present,
    absent,
    notMarked,
    holidays: holidayCount,
    leave: leaveCount,
    elapsedDays,
    attendanceRate,
  };
}

/** One row per calendar day in the range, including days with no record. */
export function buildReportRows(
  employee: Pick<Employee, 'computer_code' | 'full_name'>,
  dates: DateStr[],
  records: AttendanceDay[],
  options: { includeUnmarked?: boolean; holidays?: Map<DateStr, CalendarHoliday> } = {},
): AttendanceReportRow[] {
  const { includeUnmarked = true, holidays } = options;
  const byDate = new Map(records.map((record) => [record.date, record]));

  const rows: AttendanceReportRow[] = [];
  for (const date of dates) {
    const record = byDate.get(date);
    const holiday = holidays?.get(date);

    // A holiday with no attendance recorded reads as "Holiday", not a gap.
    if (!record && holiday) {
      rows.push({
        computerCode: employee.computer_code,
        fullName: employee.full_name,
        date,
        day: dayName(date),
        status: 'Holiday',
        remark: holiday.title,
      });
      continue;
    }

    if (!record && !includeUnmarked) continue;

    rows.push({
      computerCode: employee.computer_code,
      fullName: employee.full_name,
      date,
      day: dayName(date),
      status: record
        ? record.status === 'present'
          ? 'Present'
          : record.status === 'leave'
            ? 'Leave'
            : 'Absent'
        : 'Not Marked',
      remark: record?.remark ?? (holiday ? holiday.title : ''),
    });
  }
  return rows;
}

export function totalsFromRows(rows: AttendanceReportRow[]) {
  const present = rows.filter((row) => row.status === 'Present').length;
  const absent = rows.filter((row) => row.status === 'Absent').length;
  const holidays = rows.filter((row) => row.status === 'Holiday').length;
  const leave = rows.filter((row) => row.status === 'Leave').length;
  const marked = present + absent;
  return {
    present,
    absent,
    holidays,
    leave,
    notMarked: rows.length - marked - holidays - leave,
    attendanceRate: marked === 0 ? 0 : Math.round((present / marked) * 10000) / 100,
  };
}
