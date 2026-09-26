import { compareDateStr, dayOfWeek, parseDateStr, type DateStr } from '@/lib/date/nepal';
import { toBs } from '@/lib/date/bikram';

/**
 * Turning holiday RULES into actual holiday days.
 *
 * Rules are stored once ("every Saturday, ongoing") and expanded on demand for
 * whatever window is being displayed. Nothing is written per-day, so a weekly
 * holiday costs one row rather than one row per week forever.
 */

export type HolidayRecurrence = 'once' | 'weekly' | 'monthly';

export interface HolidayRule {
  id: string;
  title: string;
  note: string | null;
  recurrence: HolidayRecurrence;
  weekday: number | null;
  bs_day: number | null;
  start_date: DateStr;
  end_date: DateStr | null;
  is_active: boolean;
}

/** A single day that a rule makes a holiday. */
export interface HolidayDay {
  date: DateStr;
  title: string;
  ruleId: string;
}

function withinWindow(rule: HolidayRule, date: DateStr): boolean {
  if (compareDateStr(date, rule.start_date) < 0) return false;
  // 'once' with no end date is a single day; weekly/monthly with no end date
  // run until an administrator stops them.
  const end = rule.end_date ?? (rule.recurrence === 'once' ? rule.start_date : null);
  if (end && compareDateStr(date, end) > 0) return false;
  return true;
}

/** Does this one rule make this one day a holiday? */
export function ruleCoversDate(rule: HolidayRule, date: DateStr): boolean {
  if (!rule.is_active) return false;
  if (!withinWindow(rule, date)) return false;

  switch (rule.recurrence) {
    case 'once':
      return true; // the window check above already limited it
    case 'weekly': {
      if (rule.weekday === null) return false;
      const { year, month, day } = parseDateStr(date);
      return dayOfWeek(year, month, day) === rule.weekday;
    }
    case 'monthly': {
      if (rule.bs_day === null) return false;
      // Matched against the Bikram Sambat day of month, because that is the
      // calendar staff are looking at.
      return toBs(date).day === rule.bs_day;
    }
    default:
      return false;
  }
}

/**
 * Every holiday day within `dates`, keyed by date.
 * When two rules land on the same day, the first active one wins — arbitrary
 * but stable, and the day is a holiday either way.
 */
export function expandHolidays(rules: HolidayRule[], dates: DateStr[]): Map<DateStr, HolidayDay> {
  const active = rules.filter((rule) => rule.is_active);
  const found = new Map<DateStr, HolidayDay>();

  for (const date of dates) {
    for (const rule of active) {
      if (ruleCoversDate(rule, date)) {
        found.set(date, { date, title: rule.title, ruleId: rule.id });
        break;
      }
    }
  }
  return found;
}

/** Plain-language description of a rule, for the admin list. */
export function describeRule(rule: HolidayRule): string {
  const WEEKDAYS = ['आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहिबार', 'शुक्रबार', 'शनिबार'];

  const until = rule.end_date ? ` until ${rule.end_date}` : ' — ongoing';

  switch (rule.recurrence) {
    case 'once':
      return rule.end_date && rule.end_date !== rule.start_date
        ? `${rule.start_date} to ${rule.end_date}`
        : `${rule.start_date} only`;
    case 'weekly':
      return `Every ${WEEKDAYS[rule.weekday ?? 0]}${until}`;
    case 'monthly':
      return `Day ${rule.bs_day} of every Nepali month${until}`;
    default:
      return '';
  }
}
