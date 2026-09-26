'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Download, Grid3x3 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { BsCalendarPicker } from '@/components/ui/BsCalendarPicker';
import { downloadResponse } from '@/lib/download';
import { todayInNepal } from '@/lib/date/nepal';
import { bsYearMonthOf, fromBs, toNepaliNumber } from '@/lib/date/bikram';
import { STAFF_TYPE_LABEL } from '@/lib/config';

/** Admin-side export: whole organisation, one department, or one employee. */
export function ExportPanel({ departments }: { departments: string[] }) {
  const thisBsMonth = bsYearMonthOf(todayInNepal());
  const [fromDate, setFromDate] = useState(() => fromBs({ ...thisBsMonth, day: 1 }));
  const [toDate, setToDate] = useState(() => todayInNepal());
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [department, setDepartment] = useState('');
  const [includeUnmarked, setIncludeUnmarked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gridBusy, setGridBusy] = useState(false);
  const [bsYear, setBsYear] = useState(() => bsYearMonthOf(todayInNepal()).year);
  const [gridFrom, setGridFrom] = useState('');
  const [gridTo, setGridTo] = useState('');
  const [useRange, setUseRange] = useState(false);

  async function handleExport() {
    if (busy) return;
    if (fromDate > toDate) {
      toast.error('The first day must not be after the last day.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/admin/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromMonth: fromDate.slice(0, 7),
          toMonth: toDate.slice(0, 7),
          fromDate,
          toDate,
          format,
          department: department || undefined,
          includeUnmarked,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(payload?.error ?? 'The export could not be generated.');
        return;
      }

      await downloadResponse(response, `attendance-export.${format}`);
      toast.success('Export downloaded.');
    } catch {
      toast.error('Unable to reach the server. Please check your connection.');
    } finally {
      setBusy(false);
    }
  }

  async function handleYearGrid() {
    if (gridBusy) return;
    setGridBusy(true);
    try {
      const response = await fetch('/api/admin/export/year-grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bsYear,
          department: department || undefined,
          fromDate: gridFrom || undefined,
          toDate: gridTo || undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(payload?.error ?? 'The year grid could not be generated.');
        return;
      }

      await downloadResponse(response, `attendance-${bsYear}-BS.xlsx`);
      toast.success('Year grid downloaded.');
    } catch {
      toast.error('Unable to reach the server. Please check your connection.');
    } finally {
      setGridBusy(false);
    }
  }

  const thisBsYear = bsYearMonthOf(todayInNepal()).year;

  return (
    <>
    <section className="card space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="font-semibold text-navy-900">Export Attendance</h2>
        <p className="mt-1 text-sm text-slate-600">
          An Excel export contains three sheets: Employees, Attendance and a per-employee Summary.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BsCalendarPicker
          label="From (देखि)"
          value={fromDate}
          today={todayInNepal()}
          disabled={busy}
          onChange={(value) => {
            setFromDate(value);
            if (value > toDate) setToDate(value);
          }}
        />
        <BsCalendarPicker
          label="To (सम्म)"
          value={toDate}
          today={todayInNepal()}
          min={fromDate}
          disabled={busy}
          onChange={setToDate}
        />
        <Select
          label={STAFF_TYPE_LABEL}
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          disabled={busy}
        >
          <option value="">All types</option>
          {departments.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <Select
          label="Format"
          value={format}
          onChange={(event) => setFormat(event.target.value as 'xlsx' | 'csv')}
          disabled={busy}
        >
          <option value="xlsx">Excel (.xlsx)</option>
          <option value="csv">CSV</option>
        </Select>
      </div>

      <label className="flex items-center gap-2.5 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={includeUnmarked}
          onChange={(event) => setIncludeUnmarked(event.target.checked)}
          disabled={busy}
          className="h-4 w-4 accent-navy-800"
        />
        Include days with no record (produces a much larger file)
      </label>

      <Button onClick={handleExport} loading={busy}>
        <Download aria-hidden className="h-4 w-4" />
        {busy ? 'Preparing…' : 'Export All Attendance'}
      </Button>
    </section>

    {/* The wide, one-row-per-person view of a whole Nepali year. */}
    <section className="card space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="font-semibold text-navy-900">Year Grid (Bikram Sambat)</h2>
        <p className="mt-1 text-sm text-slate-600">
          One row per staff member and one column per day, grouped under each Nepali month.
          P = Present, A = Absent, H = Holiday. Hover an H to see which holiday.
        </p>
      </div>

      <label className="flex items-center gap-2.5 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={useRange}
          onChange={(event) => {
            setUseRange(event.target.checked);
            if (!event.target.checked) {
              setGridFrom('');
              setGridTo('');
            } else {
              const first = fromBs({ year: bsYear, month: 1, day: 1 });
              setGridFrom(first);
              setGridTo(todayInNepal());
            }
          }}
          disabled={gridBusy}
          className="h-4 w-4 accent-navy-800"
        />
        Only part of the year
      </label>

      {useRange ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <BsCalendarPicker
            label="From (देखि)"
            value={gridFrom || todayInNepal()}
            today={todayInNepal()}
            disabled={gridBusy}
            onChange={(value) => {
              setGridFrom(value);
              if (gridTo && value > gridTo) setGridTo(value);
            }}
          />
          <BsCalendarPicker
            label="To (सम्म)"
            value={gridTo || todayInNepal()}
            today={todayInNepal()}
            min={gridFrom || undefined}
            disabled={gridBusy}
            onChange={setGridTo}
          />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Select
          label="Nepali year"
          value={String(bsYear)}
          onChange={(event) => setBsYear(Number(event.target.value))}
          disabled={gridBusy}
        >
          {[thisBsYear + 1, thisBsYear, thisBsYear - 1, thisBsYear - 2].map((year) => (
            <option key={year} value={year}>
              {toNepaliNumber(year)} ({year})
            </option>
          ))}
        </Select>
        <Select
          label={STAFF_TYPE_LABEL}
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          disabled={gridBusy}
        >
          <option value="">All types</option>
          {departments.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </div>

      <Button onClick={handleYearGrid} loading={gridBusy}>
        <Grid3x3 aria-hidden className="h-4 w-4" />
        {gridBusy ? 'Building…' : gridFrom || gridTo ? 'Download Selected Range' : 'Download Whole Year'}
      </Button>
    </section>
    </>
  );
}
