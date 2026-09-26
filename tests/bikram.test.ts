import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addBsMonths,
  bsDaysInMonth,
  bsMonthDates,
  bsYearMonthOf,
  buildBsMonthGrid,
  fromBs,
  toBs,
} from '@/lib/date/bikram';
import { expandHolidays, ruleCoversDate, type HolidayRule } from '@/lib/holidays/rules';
import { dayOfWeek, parseDateStr } from '@/lib/date/nepal';

describe('Bikram Sambat conversion', () => {
  // Nepali New Year falls on 1 Baishakh. These are published, checkable dates.
  const NEW_YEARS: [string, number][] = [
    ['2023-04-14', 2080],
    ['2024-04-13', 2081],
    ['2025-04-14', 2082],
    ['2026-04-14', 2083],
  ];

  it('places Nepali New Year on 1 Baishakh', () => {
    for (const [ad, bsYear] of NEW_YEARS) {
      const bs = toBs(ad);
      assert.deepEqual(bs, { year: bsYear, month: 1, day: 1 }, `${ad} should be 1 Baishakh ${bsYear}`);
    }
  });

  it('converts back to the same Gregorian date', () => {
    for (const [ad, bsYear] of NEW_YEARS) {
      assert.equal(fromBs({ year: bsYear, month: 1, day: 1 }), ad);
    }
  });

  it('round-trips every day of a whole BS year without drift', () => {
    let checked = 0;
    for (let month = 1; month <= 12; month += 1) {
      const total = bsDaysInMonth({ year: 2083, month });
      for (let day = 1; day <= total; day += 1) {
        const ad = fromBs({ year: 2083, month, day });
        assert.deepEqual(toBs(ad), { year: 2083, month, day });
        checked += 1;
      }
    }
    // A BS year is 365 or 366 days, same as a Gregorian one.
    assert.ok(checked === 365 || checked === 366, `expected 365/366 days, got ${checked}`);
  });

  it('knows BS months are 29 to 32 days, not fixed', () => {
    const lengths = Array.from({ length: 12 }, (_, i) => bsDaysInMonth({ year: 2083, month: i + 1 }));
    for (const length of lengths) {
      assert.ok(length >= 29 && length <= 32, `month length ${length} out of range`);
    }
    // They genuinely vary — this is why the grid cannot be hard-coded.
    assert.ok(new Set(lengths).size > 1, 'month lengths should differ within a year');
  });

  it('spans two Gregorian months, which is why the grid is rebuilt', () => {
    const dates = bsMonthDates({ year: 2083, month: 6 });
    const gregorianMonths = new Set(dates.map((d) => parseDateStr(d).month));
    assert.ok(gregorianMonths.size >= 2, 'a BS month should cross a Gregorian boundary');
  });

  it('builds a Sunday-first grid with correct padding', () => {
    const grid = buildBsMonthGrid({ year: 2083, month: 6 });
    assert.equal(grid.length % 7, 0);

    const firstReal = grid.findIndex((cell) => cell !== null);
    const firstDate = grid[firstReal]!.date;
    const { year, month, day } = parseDateStr(firstDate);
    // The blanks before day 1 must equal its weekday.
    assert.equal(firstReal, dayOfWeek(year, month, day));
    assert.equal(grid[firstReal]!.bsDay, 1);
  });

  it('rolls BS months over the year boundary', () => {
    assert.deepEqual(addBsMonths({ year: 2083, month: 12 }, 1), { year: 2084, month: 1 });
    assert.deepEqual(addBsMonths({ year: 2083, month: 1 }, -1), { year: 2082, month: 12 });
  });

  it('finds the BS month containing a Gregorian date', () => {
    assert.deepEqual(bsYearMonthOf('2026-09-26'), { year: 2083, month: 6 });
  });
});

describe('holiday rules', () => {
  const saturday: HolidayRule = {
    id: 'sat', title: 'Shanibaar', note: null, recurrence: 'weekly',
    weekday: 6, bs_day: null, start_date: '2000-01-01', end_date: null, is_active: true,
  };

  it('marks every Saturday and nothing else', () => {
    assert.ok(ruleCoversDate(saturday, '2026-09-26'), '26 Sep 2026 is a Saturday');
    assert.ok(ruleCoversDate(saturday, '2026-10-03'));
    assert.ok(!ruleCoversDate(saturday, '2026-09-25'), 'Friday is not a Saturday');
    assert.ok(!ruleCoversDate(saturday, '2026-09-27'), 'Sunday is not a Saturday');
  });

  it('stops applying once switched off', () => {
    assert.ok(!ruleCoversDate({ ...saturday, is_active: false }, '2026-09-26'));
  });

  it('respects an end date', () => {
    const ended = { ...saturday, end_date: '2026-09-01' };
    assert.ok(!ruleCoversDate(ended, '2026-09-26'));
    assert.ok(ruleCoversDate(ended, '2026-08-29'));
  });

  it('respects a start date', () => {
    const later = { ...saturday, start_date: '2026-10-01' };
    assert.ok(!ruleCoversDate(later, '2026-09-26'));
    assert.ok(ruleCoversDate(later, '2026-10-03'));
  });

  it('handles a single-day holiday', () => {
    const single: HolidayRule = {
      id: 'x', title: 'Office closed', note: null, recurrence: 'once',
      weekday: null, bs_day: null, start_date: '2026-09-20', end_date: null, is_active: true,
    };
    assert.ok(ruleCoversDate(single, '2026-09-20'));
    assert.ok(!ruleCoversDate(single, '2026-09-21'));
  });

  it('handles a multi-day festival', () => {
    const dashain: HolidayRule = {
      id: 'd', title: 'Dashain', note: null, recurrence: 'once',
      weekday: null, bs_day: null, start_date: '2026-10-10', end_date: '2026-10-15', is_active: true,
    };
    for (const d of ['2026-10-10', '2026-10-12', '2026-10-15']) assert.ok(ruleCoversDate(dashain, d), d);
    assert.ok(!ruleCoversDate(dashain, '2026-10-16'));
  });

  it('handles a monthly holiday on a Nepali day-of-month', () => {
    const monthly: HolidayRule = {
      id: 'm', title: 'Monthly rest', note: null, recurrence: 'monthly',
      weekday: null, bs_day: 15, start_date: '2000-01-01', end_date: null, is_active: true,
    };
    const fifteenth = fromBs({ year: 2083, month: 6, day: 15 });
    const sixteenth = fromBs({ year: 2083, month: 6, day: 16 });
    assert.ok(ruleCoversDate(monthly, fifteenth));
    assert.ok(!ruleCoversDate(monthly, sixteenth));
    // And it repeats in the next Nepali month.
    assert.ok(ruleCoversDate(monthly, fromBs({ year: 2083, month: 7, day: 15 })));
  });

  it('expands rules across a month, Saturdays included', () => {
    const dates = bsMonthDates({ year: 2083, month: 6 });
    const found = expandHolidays([saturday], dates);
    assert.ok(found.size >= 4, 'a month should contain at least four Saturdays');
    for (const [date] of found) {
      const { year, month, day } = parseDateStr(date);
      assert.equal(dayOfWeek(year, month, day), 6);
    }
  });
});
