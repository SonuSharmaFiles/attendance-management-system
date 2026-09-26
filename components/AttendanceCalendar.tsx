'use client';

import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { compareDateStr, parseDateStr, type DateStr } from '@/lib/date/nepal';
import {
  BS_WEEKDAYS_NEPALI,
  BS_WEEKDAYS_NEPALI_SHORT,
  bsMonthLabel,
  bsMonthLabelNepali,
  buildBsMonthGrid,
  toNepaliNumber,
  type BsYearMonth,
} from '@/lib/date/bikram';
import type { AttendanceDay, CalendarHoliday } from '@/types/attendance';
import { CalendarSkeleton } from '@/components/LoadingState';

interface AttendanceCalendarProps {
  yearMonth: BsYearMonth;
  days: AttendanceDay[];
  holidays: Map<DateStr, CalendarHoliday>;
  today: DateStr;
  loading: boolean;
  allowFuture: boolean;
  onSelectDate: (date: DateStr) => void;
  onChangeMonth: (delta: number) => void;
}

const CELL = {
  present: 'bg-present-soft border-green-400 text-present-ink hover:bg-green-200',
  absent: 'bg-absent-soft border-red-400 text-absent-ink hover:bg-red-200',
  // Holidays use the same red family as Absent but are visibly not a choice:
  // dashed border, no hover, cursor unchanged.
  holiday: 'bg-absent-soft border-dashed border-red-400 text-absent-ink cursor-not-allowed',
  unmarked: 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100',
  future: 'bg-slate-50 border-dashed border-slate-200 text-slate-400',
} as const;

export function AttendanceCalendar({
  yearMonth,
  days,
  holidays,
  today,
  loading,
  allowFuture,
  onSelectDate,
  onChangeMonth,
}: AttendanceCalendarProps) {
  const label = bsMonthLabel(yearMonth);
  const cells = buildBsMonthGrid(yearMonth);
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

        <h2 aria-live="polite" className="text-center">
          <span className="block text-base font-bold text-navy-900 sm:text-lg">
            {bsMonthLabelNepali(yearMonth)}
          </span>
          <span className="block text-[11px] font-normal text-slate-500">{label}</span>
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
          <div className="mx-auto grid grid-cols-7 gap-1 sm:w-4/5 sm:gap-1.5" aria-hidden>
            {BS_WEEKDAYS_NEPALI.map((day, index) => (
              <div
                key={day}
                className="pb-1 text-center text-[11px] font-semibold tracking-wide text-slate-600 sm:text-xs"
              >
                <span className="sm:hidden">{BS_WEEKDAYS_NEPALI_SHORT[index]}</span>
                <span className="hidden sm:inline">{day}</span>
              </div>
            ))}
          </div>

          <div role="grid" className="mx-auto grid grid-cols-7 gap-1 sm:w-4/5 sm:gap-1.5">
            {cells.map((cell, index) => {
              if (!cell) {
                return (
                  <div key={`pad-${index}`} role="presentation" className="h-[30px] sm:h-[42px]" />
                );
              }

              const { date, bsDay } = cell;
              const record = byDate.get(date);
              const holiday = holidays.get(date);
              const isFuture = compareDateStr(date, today) > 0;
              const isToday = date === today;
              const locked = Boolean(record?.lockedByAdmin);

              // Holidays are never markable by staff; future days depend on config.
              const disabled = Boolean(holiday) || (isFuture && !allowFuture);

              const tone = holiday
                ? CELL.holiday
                : record
                  ? CELL[record.status]
                  : isFuture
                    ? CELL.future
                    : CELL.unmarked;

              const statusText = holiday
                ? `Holiday: ${holiday.title}`
                : record
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
                  aria-label={`${bsDay} ${bsMonthLabel(yearMonth)}, ${statusText}${locked ? ', set by administrator' : ''}`}
                  aria-current={isToday ? 'date' : undefined}
                  title={holiday ? holiday.title : undefined}
                  className={`relative flex h-[30px] flex-col items-center justify-center rounded-lg border px-0.5 transition-colors sm:h-[42px] ${tone} ${isToday ? 'ring-2 ring-navy-600 ring-offset-1' : ''}`}
                >
                  <span className="text-sm font-semibold leading-none sm:text-base">
                    {toNepaliNumber(bsDay)}
                  </span>

                  {/* Colour is never the only signal. */}
                  {holiday ? (
                    <span
                      aria-hidden
                      className="w-full truncate px-0.5 text-[7px] font-bold uppercase leading-tight sm:text-[9px]"
                    >
                      Holiday
                    </span>
                  ) : record ? (
                    <>
                      <span aria-hidden className="text-[9px] font-bold leading-none sm:hidden">
                        {record.status === 'present' ? '✓' : '✕'}
                      </span>
                      <span
                        aria-hidden
                        className="hidden text-[8px] font-semibold uppercase leading-tight sm:block"
                      >
                        {record.status === 'present' ? 'Present' : 'Absent'}
                      </span>
                    </>
                  ) : null}

                  {locked ? (
                    <Lock
                      aria-hidden
                      className="absolute left-0.5 top-0.5 h-2 w-2 opacity-70"
                    />
                  ) : null}

                  {record?.remark ? (
                    <span
                      aria-hidden
                      className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-current opacity-70"
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
              <span
                className="h-3 w-3 rounded border border-dashed border-red-400 bg-absent-soft"
                aria-hidden
              />
              Holiday
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-slate-300 bg-white" aria-hidden />
              Not marked
            </li>
            <li className="flex items-center gap-1.5">
              <Lock aria-hidden className="h-3 w-3" />
              Set by administrator
            </li>
          </ul>

          {/* The Gregorian range, so the Nepali month can be cross-checked. */}
          <p className="mt-2 text-[11px] text-slate-400">
            {label} covers{' '}
            {(() => {
              const real = cells.filter(Boolean) as { date: DateStr; bsDay: number }[];
              const first = parseDateStr(real[0].date);
              const last = parseDateStr(real[real.length - 1].date);
              return `${first.year}-${String(first.month).padStart(2, '0')}-${String(first.day).padStart(2, '0')} to ${last.year}-${String(last.month).padStart(2, '0')}-${String(last.day).padStart(2, '0')}`;
            })()}{' '}
            in the English calendar.
          </p>
        </>
      )}
    </section>
  );
}
