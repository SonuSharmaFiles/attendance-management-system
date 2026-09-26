'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plane } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { BsDatePicker } from '@/components/ui/BsDatePicker';
import { Modal } from '@/components/ui/Modal';
import { MAX_REMARK_LENGTH } from '@/lib/config';
import { todayInNepal } from '@/lib/date/nepal';

interface AssignLeaveButtonProps {
  employeeId: string;
  employeeName: string;
  /** Called after a successful change, so the calendar can reload. */
  onAssigned: () => void;
}

export function AssignLeaveButton({
  employeeId,
  employeeName,
  onAssigned,
}: AssignLeaveButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = todayInNepal();
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(clear: boolean) {
    if (busy) return;
    if (fromDate > toDate) {
      setError('The start date must not be after the end date.');
      return;
    }
    setError(null);
    setBusy(true);

    try {
      const response = await fetch(`/api/admin/employees/${employeeId}/leave`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fromDate, toDate, remark: remark.trim() || null, clear }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { assigned?: number; cleared?: boolean; days?: number; skippedHolidays: number } }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        const message = payload && 'error' in payload ? payload.error : 'The leave could not be saved.';
        setError(message);
        toast.error(message);
        return;
      }

      const skipped = payload.data.skippedHolidays;
      const count = payload.data.assigned ?? payload.data.days ?? 0;

      toast.success(
        clear
          ? `Leave cleared for ${count} day${count === 1 ? '' : 's'}.`
          : `${count} day${count === 1 ? '' : 's'} of leave assigned to ${employeeName}.`,
        skipped > 0
          ? { description: `${skipped} holiday${skipped === 1 ? '' : 's'} in that range were left as they were.` }
          : undefined,
      );

      setRemark('');
      setOpen(false);
      onAssigned();
    } catch {
      const message = 'Unable to reach the server.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plane aria-hidden className="h-4 w-4" />
        Assign Leave
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        busy={busy}
        title="Assign Leave"
        description={`${employeeName} — choose the first and last day of the leave.`}
      >
        <div className="space-y-4">
          <div className="space-y-4">
            <BsDatePicker
              label="First day (पहिलो दिन)"
              value={fromDate}
              today={today}
              disabled={busy}
              onChange={(value) => {
                setFromDate(value);
                // Keep the range valid rather than rejecting it later.
                if (value > toDate) setToDate(value);
              }}
            />
            <BsDatePicker
              label="Last day (अन्तिम दिन)"
              value={toDate}
              today={today}
              disabled={busy}
              onChange={(value) => {
                setToDate(value);
                if (value < fromDate) setFromDate(value);
              }}
            />
          </div>

          <Textarea
            label="Reason (optional)"
            placeholder="For example: घर बिदा"
            value={remark}
            maxLength={MAX_REMARK_LENGTH}
            onChange={(event) => setRemark(event.target.value)}
            disabled={busy}
            error={error ?? undefined}
          />

          <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            Those days turn yellow on {employeeName}&apos;s calendar and are never counted as
            absent. {employeeName} cannot change them. Any holiday inside the range is left alone.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button fullWidth loading={busy} onClick={() => submit(false)}>
              <Plane aria-hidden className="h-4 w-4" />
              Assign Leave
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
          </div>

          <button
            type="button"
            onClick={() => submit(true)}
            disabled={busy}
            className="w-full text-center text-xs text-slate-500 underline underline-offset-2 hover:text-absent disabled:opacity-50"
          >
            Or remove leave already set in this range
          </button>
        </div>
      </Modal>
    </>
  );
}
