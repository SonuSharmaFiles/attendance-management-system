'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { compareDateStr, type DateStr } from '@/lib/date/nepal';
import {
  addBsMonths,
  BS_WEEKDAYS_NEPALI_SHORT,
  bsLongLabelNepali,
  bsMonthLabelNepali,
  bsYearMonthOf,
  buildBsMonthGrid,
  toBs,
  toNepaliNumber,
  type BsYearMonth,
} from '@/lib/date/bikram';

interface BsCalendarPickerProps {
  label: string;
  /** Stored as Gregorian YYYY-MM-DD. Bikram Sambat is only how it is shown. */
  value: DateStr;
  onChange: (value: DateStr) => void;
  today: DateStr;
  /** Days outside these bounds cannot be chosen. */
  min?: DateStr;
  max?: DateStr;
  disabled?: boolean;
}

/**
 * A Bikram Sambat calendar you click, rather than three dropdowns.
 *
 * The grid opens INLINE beneath the button instead of floating above the page.
 * These pickers live inside scrollable dialogs, where an absolutely positioned
 * popover gets clipped by the dialog's own overflow — pushing the content down
 * avoids that entirely and behaves the same on a phone.
 */
export function BsCalendarPicker({
  label,
  value,
  onChange,
  today,
  min,
  max,
  disabled,
}: BsCalendarPickerProps) {
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<BsYearMonth>(() => bsYearMonthOf(value));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const cells = buildBsMonthGrid(viewing);

  function outOfBounds(date: DateStr): boolean {
    if (min && compareDateStr(date, min) < 0) return true;
    if (max && compareDateStr(date, max) > 0) return true;
    return false;
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <span className="block text-sm font-medium text-slate-700">{label}</span>

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          // Opening should land on the month of the currently chosen date,
          // set here rather than synchronised by an effect.
          if (!open) setViewing(bsYearMonthOf(value));
          setOpen((isOpen) => !isOpen);
        }}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-left text-base text-slate-900 transition-colors hover:bg-slate-50 focus:border-navy-500 disabled:bg-slate-100"
      >
        <span className="font-medium">{bsLongLabelNepali(toBs(value))}</span>
        <CalendarDays aria-hidden className="h-4 w-4 shrink-0 text-slate-500" />
      </button>

      {open ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setViewing((current) => addBsMonths(current, -1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-navy-800 transition-colors hover:bg-slate-50"
            >
              <ChevronLeft aria-hidden className="h-4 w-4" />
            </button>

            <span aria-live="polite" className="text-sm font-bold text-navy-900">
              {bsMonthLabelNepali(viewing)}
            </span>

            <button
              type="button"
              aria-label="Next month"
              onClick={() => setViewing((current) => addBsMonths(current, 1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-navy-800 transition-colors hover:bg-slate-50"
            >
              <ChevronRight aria-hidden className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1" aria-hidden>
            {BS_WEEKDAYS_NEPALI_SHORT.map((day) => (
              <div key={day} className="pb-1 text-center text-[10px] font-semibold text-slate-500">
                {day}
              </div>
            ))}
          </div>

          <div role="grid" className="grid grid-cols-7 gap-1">
            {cells.map((cell, index) => {
              if (!cell) {
                return <div key={`pad-${index}`} role="presentation" className="h-9" />;
              }

              const selected = cell.date === value;
              const isToday = cell.date === today;
              const blocked = outOfBounds(cell.date);

              return (
                <button
                  key={cell.date}
                  type="button"
                  role="gridcell"
                  disabled={blocked}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={`${cell.bsDay} ${bsMonthLabelNepali(viewing)} (${cell.date})`}
                  onClick={() => {
                    onChange(cell.date);
                    setOpen(false);
                  }}
                  className={`h-9 rounded-lg text-sm transition-colors disabled:cursor-not-allowed disabled:text-slate-300 ${
                    selected
                      ? 'bg-navy-800 font-bold text-white'
                      : isToday
                        ? 'border border-navy-500 font-semibold text-navy-800 hover:bg-navy-50'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {toNepaliNumber(cell.bsDay)}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => {
                if (!outOfBounds(today)) {
                  onChange(today);
                  setOpen(false);
                }
              }}
              className="text-xs font-medium text-navy-700 hover:text-navy-900"
            >
              आज (today)
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {/* The English date, so the choice can always be cross-checked. */}
      <p className="text-xs text-slate-500">{value}</p>
    </div>
  );
}
