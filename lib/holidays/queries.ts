import { getServiceClient } from '@/lib/supabase/admin';
import { AppError, describeDbError } from '@/lib/errors';
import { expandHolidays, type HolidayRule } from '@/lib/holidays/rules';
import type { DateStr } from '@/lib/date/nepal';
import type { CalendarHoliday } from '@/types/attendance';

const COLUMNS =
  'id, title, note, recurrence, weekday, bs_day, start_date, end_date, is_active, created_at, updated_at';

/**
 * Holiday rules apply to everyone, so they are read with the service-role
 * client on behalf of staff, who are not Supabase Auth users.
 */
export async function getActiveHolidayRules(): Promise<HolidayRule[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('holidays')
    .select(COLUMNS)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) throw new AppError(describeDbError(error), 500);
  return (data ?? []) as HolidayRule[];
}

/** The holidays falling on a given set of dates. */
export async function getHolidaysForDates(dates: DateStr[]): Promise<Map<DateStr, CalendarHoliday>> {
  if (dates.length === 0) return new Map();
  const rules = await getActiveHolidayRules();
  const expanded = expandHolidays(rules, dates);

  const result = new Map<DateStr, CalendarHoliday>();
  for (const [date, holiday] of expanded) {
    result.set(date, { date, title: holiday.title });
  }
  return result;
}

/** Is this single date a holiday? Used before letting staff mark a day. */
export async function isHoliday(date: DateStr): Promise<CalendarHoliday | null> {
  const holidays = await getHolidaysForDates([date]);
  return holidays.get(date) ?? null;
}
