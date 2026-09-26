'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BsCalendarPicker } from '@/components/ui/BsCalendarPicker';
import { Modal } from '@/components/ui/Modal';
import { downloadResponse } from '@/lib/download';
import { todayInNepal } from '@/lib/date/nepal';
import { bsYearMonthOf, fromBs } from '@/lib/date/bikram';

type Format = 'xlsx' | 'csv' | 'pdf';

const FORMATS: { value: Format; label: string; hint: string }[] = [
  { value: 'xlsx', label: 'Excel (.xlsx)', hint: 'Best for editing and printing' },
  { value: 'csv', label: 'CSV', hint: 'Opens in any spreadsheet app' },
  { value: 'pdf', label: 'PDF', hint: 'Formatted report for sharing' },
];

interface StaffDownloadButtonProps {
  employeeId: string;
  employeeName: string;
  /** 'icon' for the staff table, 'button' for the calendar page. */
  variant?: 'icon' | 'button';
}

/**
 * Downloads ONE staff member's attendance. Only administrators can do this —
 * staff no longer download their own record.
 */
export function StaffDownloadButton({
  employeeId,
  employeeName,
  variant = 'icon',
}: StaffDownloadButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = todayInNepal();
  // Defaults to the Nepali month containing today, but any two days can be
  // picked — the range is exact, not whole months.
  const thisBsMonth = bsYearMonthOf(today);
  const [fromDate, setFromDate] = useState(() => fromBs({ ...thisBsMonth, day: 1 }));
  const [toDate, setToDate] = useState(today);
  const [format, setFormat] = useState<Format>('xlsx');

  async function handleDownload() {
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
          // The months still bound the search; the dates trim it exactly.
          fromMonth: fromDate.slice(0, 7),
          toMonth: toDate.slice(0, 7),
          fromDate,
          toDate,
          format,
          employeeId,
          includeUnmarked: true,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(payload?.error ?? 'The report could not be generated.');
        return;
      }

      await downloadResponse(response, `attendance.${format}`);
      toast.success(`${employeeName}'s attendance downloaded.`);
      setOpen(false);
    } catch {
      toast.error('Unable to reach the server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Download attendance for ${employeeName}`}
          className="inline-flex min-h-[38px] items-center justify-center rounded-xl px-3 text-slate-600 transition-colors hover:bg-slate-100 hover:text-navy-800"
        >
          <Download aria-hidden className="h-4 w-4" />
        </button>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Download aria-hidden className="h-4 w-4" />
          Download Attendance
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        busy={busy}
        title="Download Attendance"
        description={`${employeeName} — choose a period and a file format.`}
      >
        <div className="space-y-4">
          <div className="space-y-4">
            <BsCalendarPicker
              label="From (देखि)"
              value={fromDate}
              today={today}
              disabled={busy}
              onChange={(value) => {
                setFromDate(value);
                if (value > toDate) setToDate(value);
              }}
            />
            <BsCalendarPicker
              label="To (सम्म)"
              value={toDate}
              today={today}
              min={fromDate}
              disabled={busy}
              onChange={setToDate}
            />
          </div>

          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-slate-700">Format</legend>
            <div className="space-y-2">
              {FORMATS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                    format === option.value
                      ? 'border-navy-600 bg-navy-50'
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`format-${employeeId}`}
                    value={option.value}
                    checked={format === option.value}
                    onChange={() => setFormat(option.value)}
                    disabled={busy}
                    className="mt-1 h-4 w-4 accent-navy-800"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-navy-900">{option.label}</span>
                    <span className="block text-xs text-slate-500">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button fullWidth loading={busy} onClick={handleDownload}>
              {busy ? 'Preparing…' : 'Download'}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
