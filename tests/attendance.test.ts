import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildReportRows, summariseDates, totalsFromRows } from '@/lib/attendance/summary';
import { attendanceFilename, periodLabel } from '@/lib/excel/filenames';
import { rowsToCsv } from '@/lib/excel/export';
import type { AttendanceDay, CalendarHoliday } from '@/types/attendance';
import { datesBetweenMonths } from '@/lib/date/nepal';

const SEPTEMBER = { year: 2026, month: 9 };

function day(
  date: string,
  status: 'present' | 'absent' | 'leave',
  remark: string | null = null,
): AttendanceDay {
  return { date, status, remark, lockedByAdmin: status === 'leave' };
}

/** Every Gregorian date in September 2026, the month these tests use. */
const SEPT_DATES = datesBetweenMonths(SEPTEMBER, SEPTEMBER);
const NO_HOLIDAYS = new Map<string, CalendarHoliday>();

describe('monthly summary', () => {
  it('counts present, absent and unmarked days up to today', () => {
    const days = [
      day('2026-09-01', 'present'),
      day('2026-09-02', 'present'),
      day('2026-09-03', 'absent', 'Sick leave'),
      // 4th and 5th deliberately left unmarked
    ];

    const summary = summariseDates(SEPT_DATES, days, NO_HOLIDAYS, '2026-09-05');

    assert.equal(summary.totalDays, 30);
    assert.equal(summary.present, 2);
    assert.equal(summary.absent, 1);
    assert.equal(summary.notMarked, 2);
    assert.equal(summary.elapsedDays, 5);
  });

  it('never counts future days as absent', () => {
    // Mid-month: the remaining 25 days must not inflate any total.
    const summary = summariseDates(SEPT_DATES, [day('2026-09-01', 'present')], NO_HOLIDAYS, '2026-09-05');
    assert.equal(summary.present + summary.absent + summary.notMarked, 5);
  });

  it('computes the attendance rate from marked days only', () => {
    const days = [
      day('2026-09-01', 'present'),
      day('2026-09-02', 'present'),
      day('2026-09-03', 'present'),
      day('2026-09-04', 'absent'),
    ];
    const summary = summariseDates(SEPT_DATES, days, NO_HOLIDAYS, '2026-09-04');
    assert.equal(summary.attendanceRate, 75);
  });

  it('reports a zero rate rather than NaN when nothing is marked', () => {
    const summary = summariseDates(SEPT_DATES, [], NO_HOLIDAYS, '2026-09-10');
    assert.equal(summary.attendanceRate, 0);
    assert.equal(summary.present, 0);
    assert.equal(summary.notMarked, 10);
  });

  it('never counts a holiday as absent or unmarked', () => {
    const holidays = new Map<string, CalendarHoliday>([
      ['2026-09-02', { date: '2026-09-02', title: 'Shanibaar' }],
      ['2026-09-03', { date: '2026-09-03', title: 'Shanibaar' }],
    ]);
    const summary = summariseDates(
      SEPT_DATES,
      [day('2026-09-01', 'present')],
      holidays,
      '2026-09-05',
    );

    assert.equal(summary.holidays, 2);
    assert.equal(summary.present, 1);
    assert.equal(summary.absent, 0);
    // 5 days have passed, 2 were holidays, 1 was marked -> 2 genuinely unmarked.
    assert.equal(summary.notMarked, 2);
    assert.equal(summary.elapsedDays, 3, 'holidays are not working days');
  });

  it('still counts someone an administrator marked present on a holiday', () => {
    const holidays = new Map<string, CalendarHoliday>([
      ['2026-09-02', { date: '2026-09-02', title: 'Shanibaar' }],
    ]);
    const summary = summariseDates(SEPT_DATES, [day('2026-09-02', 'present')], holidays, '2026-09-05');
    assert.equal(summary.present, 1, 'worked on a holiday, so it counts');
    assert.equal(summary.holidays, 1);
  });

  it('never counts approved leave as absent or unmarked', () => {
    const summary = summariseDates(
      SEPT_DATES,
      [
        day('2026-09-01', 'present'),
        day('2026-09-02', 'leave', 'घर बिदा'),
        day('2026-09-03', 'leave', 'घर बिदा'),
        day('2026-09-04', 'absent'),
      ],
      NO_HOLIDAYS,
      '2026-09-05',
    );

    assert.equal(summary.leave, 2);
    assert.equal(summary.present, 1);
    assert.equal(summary.absent, 1);
    // 5 days passed, 2 were leave, so 3 were working days; 2 of those marked.
    assert.equal(summary.elapsedDays, 3);
    assert.equal(summary.notMarked, 1);
  });

  it('keeps leave out of the attendance rate entirely', () => {
    const allLeave = summariseDates(
      SEPT_DATES,
      [day('2026-09-01', 'present'), day('2026-09-02', 'leave'), day('2026-09-03', 'leave')],
      NO_HOLIDAYS,
      '2026-09-03',
    );
    // One present, nothing absent -> 100%, not penalised for the leave.
    assert.equal(allLeave.attendanceRate, 100);
  });

  it('handles a month that has not started yet', () => {
    const summary = summariseDates(datesBetweenMonths({ year: 2026, month: 12 }, { year: 2026, month: 12 }), [], NO_HOLIDAYS, '2026-09-25');
    assert.equal(summary.elapsedDays, 0);
    assert.equal(summary.notMarked, 0);
    assert.equal(summary.absent, 0);
  });
});

describe('report rows', () => {
  const employee = { computer_code: 'NP12345', full_name: 'Demo Person' };

  it('labels leave in report rows and totals it separately', () => {
    const rows = buildReportRows(
      employee,
      ['2026-09-01', '2026-09-02', '2026-09-03'],
      [day('2026-09-01', 'present'), day('2026-09-02', 'leave', 'घर बिदा')],
    );

    assert.equal(rows[1].status, 'Leave');
    assert.equal(rows[1].remark, 'घर बिदा');

    const totals = totalsFromRows(rows);
    assert.equal(totals.leave, 1);
    assert.equal(totals.absent, 0);
    assert.equal(totals.notMarked, 1);
  });

  it('emits one row per date, filling gaps with Not Marked', () => {
    const rows = buildReportRows(
      employee,
      ['2026-09-01', '2026-09-02', '2026-09-03'],
      [day('2026-09-01', 'present'), day('2026-09-02', 'absent', 'Sick leave')],
    );

    assert.equal(rows.length, 3);
    assert.deepEqual(rows[0], {
      computerCode: 'NP12345',
      fullName: 'Demo Person',
      date: '2026-09-01',
      day: 'Tuesday',
      status: 'Present',
      remark: '',
    });
    assert.equal(rows[1].status, 'Absent');
    assert.equal(rows[1].remark, 'Sick leave');
    assert.equal(rows[2].status, 'Not Marked');
  });

  it('can omit unmarked days', () => {
    const rows = buildReportRows(
      employee,
      ['2026-09-01', '2026-09-02'],
      [day('2026-09-01', 'present')],
      { includeUnmarked: false },
    );
    assert.equal(rows.length, 1);
  });

  it('totals rows the same way the summary does', () => {
    const rows = buildReportRows(
      employee,
      ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'],
      [
        day('2026-09-01', 'present'),
        day('2026-09-02', 'present'),
        day('2026-09-03', 'absent'),
      ],
    );
    const totals = totalsFromRows(rows);
    assert.deepEqual(totals, {
      present: 2,
      absent: 1,
      holidays: 0,
      leave: 0,
      notMarked: 1,
      attendanceRate: 66.67,
    });
  });
});

describe('export filenames and CSV', () => {
  it('names a single-month file without a range suffix', () => {
    assert.equal(
      attendanceFilename('NP12345', { year: 2026, month: 9 }, { year: 2026, month: 9 }, 'xlsx'),
      'attendance-NP12345-2026-09.xlsx',
    );
  });

  it('names a multi-month file with a range suffix', () => {
    assert.equal(
      attendanceFilename('NP12345', { year: 2026, month: 1 }, { year: 2026, month: 9 }, 'xlsx'),
      'attendance-NP12345-2026-01-to-2026-09.xlsx',
    );
  });

  it('strips characters that would break a filename', () => {
    assert.equal(
      attendanceFilename('../../etc/passwd', { year: 2026, month: 9 }, { year: 2026, month: 9 }, 'csv'),
      'attendance-....etcpasswd-2026-09.csv',
    );
  });

  it('labels periods readably', () => {
    assert.equal(periodLabel({ year: 2026, month: 9 }, { year: 2026, month: 9 }), 'September 2026');
    assert.equal(
      periodLabel({ year: 2026, month: 1 }, { year: 2026, month: 9 }),
      'January 2026 — September 2026',
    );
  });

  it('quotes CSV fields and neutralises formula injection', () => {
    const csv = rowsToCsv([
      {
        computerCode: 'NP12345',
        fullName: 'Name, With Comma',
        date: '2026-09-01',
        day: 'Tuesday',
        status: 'Absent',
        remark: '=cmd|/c calc',
      },
    ]);

    assert.ok(csv.startsWith('﻿'), 'starts with a UTF-8 BOM for Excel');
    assert.ok(csv.includes('"Name, With Comma"'));
    // A leading "=" is prefixed with an apostrophe so Excel treats it as text.
    assert.ok(csv.includes(`"'=cmd|/c calc"`));
  });
});
