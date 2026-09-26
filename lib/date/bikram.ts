import NepaliDate from 'nepali-datetime';
import { parseDateStr, toDateStr, type DateStr } from '@/lib/date/nepal';

/**
 * Bikram Sambat (Nepali calendar) helpers.
 *
 * IMPORTANT: Bikram Sambat is a PRESENTATION layer only. Every date in the
 * database — attendance, holidays, everything — stays in the Gregorian
 * calendar as a plain `YYYY-MM-DD` string. Converting stored dates would
 * invalidate existing records, break sorting, and make exports incomparable.
 *
 * BS month lengths vary between 29 and 32 days and cannot be calculated; they
 * come from published tables, which is why this wraps the `nepali-datetime`
 * package rather than hand-rolling the arithmetic. The conversions are checked
 * against known Nepali New Year dates in tests/bikram.test.ts.
 */

export interface BsDate {
  year: number;
  month: number; // 1-12
  day: number;
}

export interface BsYearMonth {
  year: number;
  month: number; // 1-12
}

/** Baishakh … Chaitra, romanised. */
export const BS_MONTHS = [
  'Baishakh',
  'Jestha',
  'Ashadh',
  'Shrawan',
  'Bhadra',
  'Ashwin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
] as const;

export const BS_MONTHS_NEPALI = [
  'बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज',
  'कार्तिक', 'मंसिर', 'पुष', 'माघ', 'फागुन', 'चैत',
] as const;

/** Sunday first, matching the calendar grid. */
export const BS_WEEKDAYS = [
  'Aaitabaar',
  'Sombaar',
  'Mangalbaar',
  'Budhabaar',
  'Bihibaar',
  'Shukrabaar',
  'Shanibaar',
] as const;

export const BS_WEEKDAYS_NEPALI = [
  'आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहिबार', 'शुक्रबार', 'शनिबार',
] as const;

/** Short forms for narrow screens. */
export const BS_WEEKDAYS_SHORT = ['Aai', 'Som', 'Man', 'Bud', 'Bih', 'Shu', 'Sha'] as const;

/** Gregorian `YYYY-MM-DD` -> Bikram Sambat. */
export function toBs(date: DateStr): BsDate {
  const { year, month, day } = parseDateStr(date);
  const nd = NepaliDate.fromEnglishDate(year, month - 1, day);
  return { year: nd.getYear(), month: nd.getMonth() + 1, day: nd.getDate() };
}

/** Bikram Sambat -> Gregorian `YYYY-MM-DD`. */
export function fromBs(bs: BsDate): DateStr {
  const nd = new NepaliDate(bs.year, bs.month - 1, bs.day);
  return toDateStr(nd.getEnglishYear(), nd.getEnglishMonth() + 1, nd.getEnglishDate());
}

/** How many days a given Bikram Sambat month has (29-32). */
export function bsDaysInMonth({ year, month }: BsYearMonth): number {
  return NepaliDate.getDaysOfMonth(year, month - 1);
}

/** 0 = Sunday … 6 = Saturday, for the 1st of a Bikram Sambat month. */
export function bsFirstWeekday({ year, month }: BsYearMonth): number {
  return new NepaliDate(year, month - 1, 1).getDay();
}

export function bsMonthLabel({ year, month }: BsYearMonth, nepali = false): string {
  const name = nepali ? BS_MONTHS_NEPALI[month - 1] : BS_MONTHS[month - 1];
  return `${name} ${year}`;
}

/** e.g. "10 Ashwin 2083" */
export function bsLongLabel(bs: BsDate, nepali = false): string {
  const name = nepali ? BS_MONTHS_NEPALI[bs.month - 1] : BS_MONTHS[bs.month - 1];
  return `${bs.day} ${name} ${bs.year}`;
}

export function addBsMonths({ year, month }: BsYearMonth, delta: number): BsYearMonth {
  const zeroBased = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

export function compareBsYearMonth(a: BsYearMonth, b: BsYearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

/** `2083-06` — used for month pickers and filenames. */
export function bsYearMonthToInput({ year, month }: BsYearMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function bsYearMonthFromInput(value: string): BsYearMonth | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/**
 * Every Gregorian date in a Bikram Sambat month, in order.
 * A BS month straddles two Gregorian months, which is exactly why the calendar
 * cannot simply be relabelled — the grid has to be built from BS.
 */
export function bsMonthDates(yearMonth: BsYearMonth): DateStr[] {
  const total = bsDaysInMonth(yearMonth);
  const dates: DateStr[] = [];
  for (let day = 1; day <= total; day += 1) {
    dates.push(fromBs({ ...yearMonth, day }));
  }
  return dates;
}

/**
 * Calendar grid for a Bikram Sambat month: leading blanks, then one entry per
 * day, padded to whole weeks. `null` marks a padding cell.
 */
export function buildBsMonthGrid(
  yearMonth: BsYearMonth,
): ({ date: DateStr; bsDay: number } | null)[] {
  const total = bsDaysInMonth(yearMonth);
  const leading = bsFirstWeekday(yearMonth);
  const cells: ({ date: DateStr; bsDay: number } | null)[] = [];

  for (let i = 0; i < leading; i += 1) cells.push(null);
  for (let day = 1; day <= total; day += 1) {
    cells.push({ date: fromBs({ ...yearMonth, day }), bsDay: day });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** The Bikram Sambat month containing a given Gregorian date. */
export function bsYearMonthOf(date: DateStr): BsYearMonth {
  const { year, month } = toBs(date);
  return { year, month };
}
