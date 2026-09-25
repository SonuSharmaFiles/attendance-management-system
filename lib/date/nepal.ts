/**
 * Timezone-safe date helpers for Nepal (Asia/Kathmandu, UTC+05:45).
 *
 * Attendance dates are calendar days, not instants. Everything here works on
 * plain "YYYY-MM-DD" strings and {year, month, day} parts so that a Date object
 * is never implicitly converted between UTC and local time. Day-of-week is the
 * one place a Date is needed, and it is built with Date.UTC so the result is
 * identical on every machine regardless of the server's TZ setting.
 */

export const NEPAL_TZ = 'Asia/Kathmandu';

/** A calendar date in `YYYY-MM-DD` form. */
export type DateStr = string;

export interface YearMonth {
  year: number;
  month: number; // 1-12
}

const nepalFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: NEPAL_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's calendar date as seen in Kathmandu. */
export function todayInNepal(): DateStr {
  // en-CA formats as YYYY-MM-DD.
  return nepalFormatter.format(new Date());
}

/** The current year/month in Kathmandu. */
export function currentYearMonth(): YearMonth {
  const { year, month } = parseDateStr(todayInNepal());
  return { year, month };
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDateStr(year: number, month: number, day: number): DateStr {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function isValidDateStr(value: unknown): value is DateStr {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  return true;
}

export function parseDateStr(value: DateStr): { year: number; month: number; day: number } {
  return {
    year: Number(value.slice(0, 4)),
    month: Number(value.slice(5, 7)),
    day: Number(value.slice(8, 10)),
  };
}

export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
export const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function dayName(date: DateStr): string {
  const { year, month, day } = parseDateStr(date);
  return WEEKDAY_LONG[dayOfWeek(year, month, day)];
}

export function monthLabel({ year, month }: YearMonth): string {
  return `${MONTH_LONG[month - 1]} ${year}`;
}

/** e.g. "September 25, 2026" */
export function longDateLabel(date: DateStr): string {
  const { year, month, day } = parseDateStr(date);
  return `${MONTH_LONG[month - 1]} ${day}, ${year}`;
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const zeroBased = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

/** Inclusive first/last day of a month as date strings. */
export function monthBounds({ year, month }: YearMonth): { start: DateStr; end: DateStr } {
  return {
    start: toDateStr(year, month, 1),
    end: toDateStr(year, month, daysInMonth(year, month)),
  };
}

export function compareDateStr(a: DateStr, b: DateStr): number {
  // Zero-padded ISO dates sort correctly as plain strings.
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  const av = a.year * 12 + a.month;
  const bv = b.year * 12 + b.month;
  return av - bv;
}

/** Every calendar date from the first day of `from` to the last day of `to`. */
export function datesBetweenMonths(from: YearMonth, to: YearMonth): DateStr[] {
  const out: DateStr[] = [];
  let cursor = { ...from };
  while (compareYearMonth(cursor, to) <= 0) {
    const total = daysInMonth(cursor.year, cursor.month);
    for (let day = 1; day <= total; day += 1) {
      out.push(toDateStr(cursor.year, cursor.month, day));
    }
    cursor = addMonths(cursor, 1);
  }
  return out;
}

/** `2026-09` — used for filenames and <input type="month"> values. */
export function yearMonthToInput({ year, month }: YearMonth): string {
  return `${year}-${pad2(month)}`;
}

export function yearMonthFromInput(value: string): YearMonth | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/**
 * Calendar grid for a month: 6 rows x 7 columns, with `null` for padding cells.
 * Weeks start on Sunday, matching the requested SUN..SAT header.
 */
export function buildMonthGrid({ year, month }: YearMonth): (DateStr | null)[] {
  const total = daysInMonth(year, month);
  const leading = dayOfWeek(year, month, 1);
  const cells: (DateStr | null)[] = [];
  for (let i = 0; i < leading; i += 1) cells.push(null);
  for (let day = 1; day <= total; day += 1) cells.push(toDateStr(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
