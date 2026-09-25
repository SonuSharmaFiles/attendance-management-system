import {
  compareDateStr,
  daysInMonth,
  dayName,
  toDateStr,
  type DateStr,
  type YearMonth,
} from '@/lib/date/nepal';
import type { AttendanceDay, AttendanceReportRow, MonthlySummary } from '@/types/attendance';
import type { Employee } from '@/types/employee';

/**
 * Monthly totals.
 *
 * Future days are counted separately from unmarked past days, so a month in
 * progress never reports the rest of the month as absent, and the attendance
 * rate stays meaningful from day one.
 */
export function summariseMonth(
  yearMonth: YearMonth,
  days: AttendanceDay[],
  today: DateStr,
): MonthlySummary {
  const totalDays = daysInMonth(yearMonth.year, yearMonth.month);
  const byDate = new Map(days.map((day) => [day.date, day]));

  let present = 0;
  let absent = 0;
  let notMarked = 0;
  let elapsedDays = 0;

  for (let day = 1; day <= totalDays; day += 1) {
    const date = toDateStr(yearMonth.year, yearMonth.month, day);
    const isFuture = compareDateStr(date, today) > 0;
    if (!isFuture) elapsedDays += 1;

    const record = byDate.get(date);
    if (record?.status === 'present') present += 1;
    else if (record?.status === 'absent') absent += 1;
    else if (!isFuture) notMarked += 1;
  }

  const marked = present + absent;
  const attendanceRate = marked === 0 ? 0 : Math.round((present / marked) * 10000) / 100;

  return { totalDays, present, absent, notMarked, elapsedDays, attendanceRate };
}

/** One row per calendar day in the range, including days with no record. */
export function buildReportRows(
  employee: Pick<Employee, 'computer_code' | 'full_name'>,
  dates: DateStr[],
  records: AttendanceDay[],
  options: { includeUnmarked?: boolean } = {},
): AttendanceReportRow[] {
  const { includeUnmarked = true } = options;
  const byDate = new Map(records.map((record) => [record.date, record]));

  const rows: AttendanceReportRow[] = [];
  for (const date of dates) {
    const record = byDate.get(date);
    if (!record && !includeUnmarked) continue;
    rows.push({
      computerCode: employee.computer_code,
      fullName: employee.full_name,
      date,
      day: dayName(date),
      status: record ? (record.status === 'present' ? 'Present' : 'Absent') : 'Not Marked',
      remark: record?.remark ?? '',
    });
  }
  return rows;
}

export function totalsFromRows(rows: AttendanceReportRow[]) {
  const present = rows.filter((row) => row.status === 'Present').length;
  const absent = rows.filter((row) => row.status === 'Absent').length;
  const marked = present + absent;
  return {
    present,
    absent,
    notMarked: rows.length - marked,
    attendanceRate: marked === 0 ? 0 : Math.round((present / marked) * 10000) / 100,
  };
}
