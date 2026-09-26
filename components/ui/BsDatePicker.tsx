'use client';

import { useId } from 'react';
import type { DateStr } from '@/lib/date/nepal';
import {
  BS_MONTHS_NEPALI,
  bsDaysInMonth,
  bsYearMonthOf,
  fromBs,
  toBs,
  toNepaliNumber,
} from '@/lib/date/bikram';

const SELECT =
  'w-full rounded-xl border border-slate-300 bg-white px-2.5 py-3 text-base text-slate-900 transition-colors focus:border-navy-500 disabled:bg-slate-100 disabled:text-slate-500';

/** BS years offered, centred on the year containing `today`. */
function yearChoices(currentBsYear: number): number[] {
  const years: number[] = [];
  for (let year = currentBsYear - 3; year <= currentBsYear + 2; year += 1) years.push(year);
  return years;
}

interface BsDatePickerProps {
  label: string;
  /** Stored as a Gregorian YYYY-MM-DD; Bikram Sambat is only the display. */
  value: DateStr;
  onChange: (value: DateStr) => void;
  today: DateStr;
  disabled?: boolean;
  hint?: string;
  error?: string;
}

/**
 * A Bikram Sambat date picker: year, month and day as three lists.
 *
 * Three lists rather than a calendar grid because it is reliable on a phone,
 * needs no popup, and is keyboard- and screen-reader-friendly for free.
 *
 * The day list is rebuilt whenever the year or month changes, since BS months
 * run 29 to 32 days. If the chosen day no longer exists in the new month it is
 * pulled back to the last day rather than producing an impossible date.
 */
export function BsDatePicker({
  label,
  value,
  onChange,
  today,
  disabled,
  hint,
  error,
}: BsDatePickerProps) {
  const id = useId();
  const bs = toBs(value);
  const years = yearChoices(bsYearMonthOf(today).year);
  const daysInMonth = bsDaysInMonth({ year: bs.year, month: bs.month });

  function update(next: { year?: number; month?: number; day?: number }) {
    const year = next.year ?? bs.year;
    const month = next.month ?? bs.month;
    const total = bsDaysInMonth({ year, month });
    // Clamp, so moving from a 32-day month to a 29-day one cannot create
    // something like 32 Mangsir.
    const day = Math.min(next.day ?? bs.day, total);
    onChange(fromBs({ year, month, day }));
  }

  return (
    <div className="space-y-1.5">
      <span id={`${id}-label`} className="block text-sm font-medium text-slate-700">
        {label}
      </span>

      <div className="grid grid-cols-[1.1fr_1.4fr_0.9fr] gap-1.5" role="group" aria-labelledby={`${id}-label`}>
        <select
          className={SELECT}
          value={bs.year}
          disabled={disabled}
          aria-label={`${label} — year`}
          onChange={(event) => update({ year: Number(event.target.value) })}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {toNepaliNumber(year)}
            </option>
          ))}
        </select>

        <select
          className={SELECT}
          value={bs.month}
          disabled={disabled}
          aria-label={`${label} — month`}
          onChange={(event) => update({ month: Number(event.target.value) })}
        >
          {BS_MONTHS_NEPALI.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>

        <select
          className={SELECT}
          value={bs.day}
          disabled={disabled}
          aria-label={`${label} — day`}
          onChange={(event) => update({ day: Number(event.target.value) })}
        >
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
            <option key={day} value={day}>
              {toNepaliNumber(day)}
            </option>
          ))}
        </select>
      </div>

      {/* The English date, so it can always be cross-checked. */}
      <p className="text-xs text-slate-500">
        {error ? <span className="font-medium text-absent">{error}</span> : (hint ?? value)}
      </p>
    </div>
  );
}

interface BsMonthPickerProps {
  label: string;
  /** `2083-06` */
  value: string;
  onChange: (value: string) => void;
  today: DateStr;
  disabled?: boolean;
  hint?: string;
}

/** Year and month only, for reports that run whole months. */
export function BsMonthPicker({
  label,
  value,
  onChange,
  today,
  disabled,
  hint,
}: BsMonthPickerProps) {
  const id = useId();
  const [yearText, monthText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const years = yearChoices(bsYearMonthOf(today).year);

  const set = (nextYear: number, nextMonth: number) =>
    onChange(`${nextYear}-${String(nextMonth).padStart(2, '0')}`);

  return (
    <div className="space-y-1.5">
      <span id={`${id}-label`} className="block text-sm font-medium text-slate-700">
        {label}
      </span>

      <div className="grid grid-cols-[1fr_1.4fr] gap-1.5" role="group" aria-labelledby={`${id}-label`}>
        <select
          className={SELECT}
          value={year}
          disabled={disabled}
          aria-label={`${label} — year`}
          onChange={(event) => set(Number(event.target.value), month)}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {toNepaliNumber(y)}
            </option>
          ))}
        </select>

        <select
          className={SELECT}
          value={month}
          disabled={disabled}
          aria-label={`${label} — month`}
          onChange={(event) => set(year, Number(event.target.value))}
        >
          {BS_MONTHS_NEPALI.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
