'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { currentYearMonth, yearMonthToInput } from '@/lib/date/nepal';

type Format = 'xlsx' | 'csv' | 'pdf';

const FORMATS: { value: Format; label: string; hint: string }[] = [
  { value: 'xlsx', label: 'Excel (.xlsx)', hint: 'Best for editing and printing' },
  { value: 'csv', label: 'CSV', hint: 'Opens in any spreadsheet app' },
  { value: 'pdf', label: 'PDF', hint: 'Formatted report for sharing' },
];

/** Triggers a browser download from a fetched Blob. */
async function downloadResponse(response: Response, fallbackName: string) {
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? fallbackName;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
}

export function DownloadAttendance({ computerCode }: { computerCode: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const thisMonth = yearMonthToInput(currentYearMonth());
  const [fromMonth, setFromMonth] = useState(thisMonth);
  const [toMonth, setToMonth] = useState(thisMonth);
  const [format, setFormat] = useState<Format>('xlsx');

  async function handleDownload() {
    if (busy) return;
    if (fromMonth > toMonth) {
      toast.error('The start month must not be after the end month.');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromMonth, toMonth, format }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(payload?.error ?? 'The report could not be generated. Please try again.');
        return;
      }

      await downloadResponse(response, `attendance-${computerCode}.${format}`);
      toast.success('Attendance report downloaded.');
      setOpen(false);
    } catch {
      toast.error('Unable to reach the server. Please check your connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Download aria-hidden className="h-4 w-4" />
        Download Attendance
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        busy={busy}
        title="Download Attendance"
        description="Choose a period and a file format."
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
                    name="export-format"
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

export { downloadResponse };
