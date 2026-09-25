import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildReportRows, summariseMonth, totalsFromRows } from '@/lib/attendance/summary';
import { attendanceFilename, periodLabel } from '@/lib/excel/filenames';
import { rowsToCsv } from '@/lib/excel/export';
import type { AttendanceDay } from '@/types/attendance';

const SEPTEMBER = { year: 2026, month: 9 };

function day(date: string, status: 'present' | 'absent', remark: string | null = null): AttendanceDay {
  return { date, status, remark };
}

describe('monthly summary', () => {
  it('counts present, absent and unmarked days up to today', () => {
    const days = [
      day('2026-09-01', 'present'),
      day('2026-09-02', 'present'),
      day('2026-09-03', 'absent', 'Sick leave'),
      // 4th and 5th deliberately left unmarked
    ];

    const summary = summariseMonth(SEPTEMBER, days, '2026-09-05');

    assert.equal(summary.totalDays, 30);
    assert.equal(summary.present, 2);
    assert.equal(summary.absent, 1);
    assert.equal(summary.notMarked, 2);
    assert.equal(summary.elapsedDays, 5);
  });

  it('never counts future days as absent', () => {
    // Mid-month: the remaining 25 days must not inflate any total.
    const summary = summariseMonth(SEPTEMBER, [day('2026-09-01', 'present')], '2026-09-05');
    assert.equal(summary.present + summary.absent + summary.notMarked, 5);
  });

  it('computes the attendance rate from marked days only', () => {
    const days = [
      day('2026-09-01', 'present'),
      day('2026-09-02', 'present'),
      day('2026-09-03', 'present'),
      day('2026-09-04', 'absent'),
    ];
    const summary = summariseMonth(SEPTEMBER, days, '2026-09-04');
    assert.equal(summary.attendanceRate, 75);
  });

  it('reports a zero rate rather than NaN when nothing is marked', () => {
    const summary = summariseMonth(SEPTEMBER, [], '2026-09-10');
    assert.equal(summary.attendanceRate, 0);
    assert.equal(summary.present, 0);
    assert.equal(summary.notMarked, 10);
  });

  it('handles a month that has not started yet', () => {
    const summary = summariseMonth({ year: 2026, month: 12 }, [], '2026-09-25');
    assert.equal(summary.elapsedDays, 0);
    assert.equal(summary.notMarked, 0);
    assert.equal(summary.absent, 0);
  });
});

describe('report rows', () => {
  const employee = { computer_code: 'NP12345', full_name: 'Demo Person' };

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
