import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addMonths,
  buildMonthGrid,
  compareDateStr,
  datesBetweenMonths,
  dayName,
  dayOfWeek,
  daysInMonth,
  isValidDateStr,
  longDateLabel,
  monthBounds,
  monthLabel,
  todayInNepal,
  toDateStr,
  yearMonthFromInput,
  yearMonthToInput,
} from '@/lib/date/nepal';

describe('calendar arithmetic', () => {
  it('knows how many days each month has, including leap years', () => {
    assert.equal(daysInMonth(2026, 9), 30);
    assert.equal(daysInMonth(2026, 2), 28);
    assert.equal(daysInMonth(2024, 2), 29); // divisible by 4
    assert.equal(daysInMonth(2000, 2), 29); // divisible by 400
    assert.equal(daysInMonth(1900, 2), 28); // divisible by 100, not 400
  });

  it('computes weekdays independent of the machine timezone', () => {
    // 1 September 2026 is a Tuesday.
    assert.equal(dayOfWeek(2026, 9, 1), 2);
    assert.equal(dayName('2026-09-01'), 'Tuesday');
    assert.equal(dayName('2026-09-02'), 'Wednesday');
    assert.equal(dayName('2026-12-31'), 'Thursday');
  });

  it('rolls months over year boundaries in both directions', () => {
    assert.deepEqual(addMonths({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
    assert.deepEqual(addMonths({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
    assert.deepEqual(addMonths({ year: 2026, month: 9 }, -13), { year: 2025, month: 8 });
  });

  it('builds a Sunday-first grid with the right leading padding', () => {
    const grid = buildMonthGrid({ year: 2026, month: 9 });
    // September 2026 starts on a Tuesday, so two blank cells come first.
    assert.equal(grid[0], null);
    assert.equal(grid[1], null);
    assert.equal(grid[2], '2026-09-01');
    assert.equal(grid.filter(Boolean).length, 30);
    assert.equal(grid.length % 7, 0);
  });

  it('validates date strings strictly', () => {
    assert.ok(isValidDateStr('2026-09-25'));
    assert.ok(!isValidDateStr('2026-09-31')); // September has 30 days
    assert.ok(!isValidDateStr('2026-13-01'));
    assert.ok(!isValidDateStr('2026-9-1')); // must be zero padded
    assert.ok(!isValidDateStr('not-a-date'));
    assert.ok(!isValidDateStr(20260925));
  });

  it('formats and parses month inputs', () => {
    assert.equal(yearMonthToInput({ year: 2026, month: 9 }), '2026-09');
    assert.deepEqual(yearMonthFromInput('2026-09'), { year: 2026, month: 9 });
    assert.equal(yearMonthFromInput('2026-13'), null);
    assert.equal(monthLabel({ year: 2026, month: 9 }), 'September 2026');
    assert.equal(longDateLabel('2026-09-25'), 'September 25, 2026');
  });

  it('returns inclusive month bounds', () => {
    assert.deepEqual(monthBounds({ year: 2026, month: 2 }), {
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  it('expands a multi-month range day by day', () => {
    const dates = datesBetweenMonths({ year: 2026, month: 1 }, { year: 2026, month: 3 });
    assert.equal(dates.length, 31 + 28 + 31);
    assert.equal(dates[0], '2026-01-01');
    assert.equal(dates.at(-1), '2026-03-31');
  });

  it('sorts date strings chronologically as plain strings', () => {
    assert.equal(compareDateStr('2026-09-01', '2026-09-02'), -1);
    assert.equal(compareDateStr('2026-10-01', '2026-09-30'), 1);
    assert.equal(compareDateStr('2026-09-01', '2026-09-01'), 0);
  });
});

describe('Nepal timezone handling', () => {
  it("reports Kathmandu's date, not the server's", () => {
    const today = todayInNepal();
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(isValidDateStr(today));
  });

  it('does not shift the day across the UTC boundary', () => {
    // Kathmandu is UTC+05:45. At 20:00 UTC it is already the NEXT day there,
    // which is exactly the case a naive `toISOString().slice(0,10)` gets wrong.
    const instant = new Date('2026-09-25T20:00:00Z');
    const nepal = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kathmandu',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant);

    assert.equal(nepal, '2026-09-26');
    assert.equal(instant.toISOString().slice(0, 10), '2026-09-25');
  });

  it('round-trips a date through toDateStr without drifting', () => {
    for (const [year, month, day] of [
      [2026, 1, 1],
      [2026, 9, 25],
      [2026, 12, 31],
      [2024, 2, 29],
    ] as [number, number, number][]) {
      const value = toDateStr(year, month, day);
      assert.equal(value.length, 10);
      assert.equal(Number(value.slice(0, 4)), year);
      assert.equal(Number(value.slice(5, 7)), month);
      assert.equal(Number(value.slice(8, 10)), day);
    }
  });
});
