'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Download, Grid3x3 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { downloadResponse } from '@/components/DownloadAttendance';
import { currentYearMonth, todayInNepal, yearMonthToInput } from '@/lib/date/nepal';
import { bsYearMonthOf, toNepaliNumber } from '@/lib/date/bikram';
import { STAFF_TYPE_LABEL } from '@/lib/config';

/** Admin-side export: whole organisation, one department, or one employee. */
export function ExportPanel({ departments }: { departments: string[] }) {
  const thisMonth = yearMonthToInput(currentYearMonth());
  const [fromMonth, setFromMonth] = useState(thisMonth);
  const [toMonth, setToMonth] = useState(thisMonth);
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [department, setDepartment] = useState('');
  const [includeUnmarked, setIncludeUnmarked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gridBusy, setGridBusy] = useState(false);
  const [bsYear, setBsYear] = useState(() => bsYearMonthOf(todayInNepal()).year);

  async function handleExport() {
    if (busy) return;
    if (fromMonth > toMonth) {
      toast.error('The start month must not be after the end month.');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/admin/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromMonth,
          toMonth,
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
        body: JSON.stringify({ bsYear, department: department || undefined }),
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
        <Input
          label="From Month"
          type="month"
          value={fromMonth}
          max={toMonth}
          onChange={(event) => setFromMonth(event.target.value)}
          disabled={busy}
        />
        <Input
          label="To Month"
          type="month"
          value={toMonth}
          min={fromMonth}
          onChange={(event) => setToMonth(event.target.value)}
          disabled={busy}
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
        {gridBusy ? 'Building…' : 'Download Year Grid'}
      </Button>
    </section>
    </>
  );
}
