'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  buildMonthGrid,
  compareDateStr,
  monthLabel,
  parseDateStr,
  WEEKDAY_SHORT,
  type DateStr,
  type YearMonth,
} from '@/lib/date/nepal';
import type { AttendanceDay } from '@/types/attendance';
import { CalendarSkeleton } from '@/components/LoadingState';

interface AttendanceCalendarProps {
  yearMonth: YearMonth;
  days: AttendanceDay[];
  today: DateStr;
  loading: boolean;
  allowFuture: boolean;
  onSelectDate: (date: DateStr) => void;
  onChangeMonth: (delta: number) => void;
}

const CELL_STYLES = {
  present: 'bg-present-soft border-green-400 text-present-ink hover:bg-green-200',
  absent: 'bg-absent-soft border-red-400 text-absent-ink hover:bg-red-200',
  unmarked: 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100',
  future: 'bg-slate-50 border-dashed border-slate-200 text-slate-400',
} as const;

export function AttendanceCalendar({
  yearMonth,
  days,
  today,
  loading,
  allowFuture,
  onSelectDate,
  onChangeMonth,
}: AttendanceCalendarProps) {
  const label = monthLabel(yearMonth);
  const cells = buildMonthGrid(yearMonth);
  const byDate = new Map(days.map((day) => [day.date, day]));

  return (
    <section className="card p-3 sm:p-5" aria-label={`Attendance calendar for ${label}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onChangeMonth(-1)}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-xl border border-slate-300 px-2 text-sm font-semibold text-navy-800 transition-colors hover:bg-slate-50 sm:px-3"
          aria-label="Go to previous month"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        <h2 aria-live="polite" className="text-center text-base font-bold text-navy-900 sm:text-lg">
          {label}
        </h2>

        <button
          type="button"
          onClick={() => onChangeMonth(1)}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-xl border border-slate-300 px-2 text-sm font-semibold text-navy-800 transition-colors hover:bg-slate-50 sm:px-3"
          aria-label="Go to next month"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight aria-hidden className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <CalendarSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2" aria-hidden>
            {WEEKDAY_SHORT.map((day) => (
              <div
                key={day}
                className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs"
              >
                <span className="sm:hidden">{day[0]}</span>
                <span className="hidden sm:inline">{day}</span>
              </div>
            ))}
          </div>

          <div role="grid" className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {cells.map((date, index) => {
              if (!date) {
                return <div key={`pad-${index}`} role="presentation" className="aspect-square" />;
              }

              const record = byDate.get(date);
              const isFuture = compareDateStr(date, today) > 0;
              const isToday = date === today;
              const disabled = isFuture && !allowFuture;
              const tone = record
                ? CELL_STYLES[record.status]
                : isFuture
                  ? CELL_STYLES.future
                  : CELL_STYLES.unmarked;

              const statusText = record
                ? record.status === 'present'
                  ? 'Present'
                  : 'Absent'
                : isFuture
                  ? 'Upcoming'
                  : 'Not marked';

              return (
                <button
                  key={date}
                  type="button"
                  role="gridcell"
                  disabled={disabled}
                  onClick={() => onSelectDate(date)}
                  aria-label={`${date}, ${statusText}${record?.remark ? `, remark: ${record.remark}` : ''}`}
                  aria-current={isToday ? 'date' : undefined}
                  className={`relative flex aspect-square min-h-[46px] flex-col items-center justify-center rounded-lg border p-0.5 transition-colors disabled:cursor-not-allowed ${tone} ${isToday ? 'ring-2 ring-navy-600 ring-offset-1' : ''}`}
                >
                  <span className="text-sm font-semibold tabular-nums sm:text-base">
                    {parseDateStr(date).day}
                  </span>

                  {/* Colour is never the only signal: every marked day also
                      carries a glyph, and the full word on larger screens. */}
                  {record ? (
                    <>
                      <span aria-hidden className="text-[11px] font-bold leading-none sm:hidden">
                        {record.status === 'present' ? '✓' : '✕'}
                      </span>
                      <span
                        aria-hidden
                        className="hidden text-[10px] font-semibold uppercase leading-tight sm:block"
                      >
                        {record.status === 'present' ? 'Present' : 'Absent'}
                      </span>
                    </>
                  ) : null}

                  {record?.remark ? (
                    <span
                      aria-hidden
                      title="Has a remark"
                      className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-current opacity-70"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-green-400 bg-present-soft" aria-hidden />
              Present (✓)
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-red-400 bg-absent-soft" aria-hidden />
              Absent (✕)
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-slate-300 bg-white" aria-hidden />
              Not marked
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" aria-hidden />
              Has a remark
            </li>
          </ul>
        </>
      )}
    </section>
  );
}
