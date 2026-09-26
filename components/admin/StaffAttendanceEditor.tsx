'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Check, Lock, Trash2, X } from 'lucide-react';
import { StaffDownloadButton } from '@/components/admin/StaffDownloadButton';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AttendanceCalendar } from '@/components/AttendanceCalendar';
import { MonthlySummary } from '@/components/MonthlySummary';
import { summariseDates } from '@/lib/attendance/summary';
import { MAX_REMARK_LENGTH } from '@/lib/config';
import type { DateStr } from '@/lib/date/nepal';
import {
  addBsMonths,
  bsLongLabelNepali,
  bsMonthDates,
  bsMonthLabelNepali,
  bsYearMonthOf,
  toBs,
  type BsYearMonth,
} from '@/lib/date/bikram';
import type { AttendanceDay, AttendanceStatus, CalendarHoliday } from '@/types/attendance';
import type { Employee } from '@/types/employee';

interface StaffAttendanceEditorProps {
  employee: Employee;
  today: DateStr;
}

/**
 * The administrator's view of one staff member's calendar.
 *
 * Unlike the staff view, every day is editable — including holidays and dates
 * that have not arrived. Anything saved here is locked, so the staff member
 * cannot change it back.
 */
export function StaffAttendanceEditor({ employee, today }: StaffAttendanceEditorProps) {
  const [yearMonth, setYearMonth] = useState<BsYearMonth>(() => bsYearMonthOf(today));
  const [days, setDays] = useState<AttendanceDay[]>([]);
  const [holidays, setHolidays] = useState<CalendarHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<DateStr | null>(null);
  const [saving, setSaving] = useState(false);

  const holidayMap = useMemo(
    () => new Map(holidays.map((holiday) => [holiday.date, holiday])),
    [holidays],
  );
  const summary = useMemo(
    () => summariseDates(bsMonthDates(yearMonth), days, holidayMap, today),
    [yearMonth, days, holidayMap, today],
  );

  const load = useCallback(
    async (target: BsYearMonth) => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/admin/employees/${employee.id}/attendance?bsYear=${target.year}&bsMonth=${target.month}`,
          { cache: 'no-store' },
        );
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; data: { days: AttendanceDay[]; holidays: CalendarHoliday[] } }
          | { ok: false; error: string }
          | null;

        if (!response.ok || !payload?.ok) {
          toast.error(payload && 'error' in payload ? payload.error : 'Unable to load attendance.');
          return;
        }
        setDays(payload.data.days);
        setHolidays(payload.data.holidays);
      } catch {
        toast.error('Unable to reach the server.');
      } finally {
        setLoading(false);
      }
    },
    [employee.id],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(yearMonth), 0);
    return () => window.clearTimeout(timer);
  }, [load, yearMonth]);

  const existing = selectedDate ? (days.find((day) => day.date === selectedDate) ?? null) : null;
  const holidayOnDay = selectedDate ? (holidayMap.get(selectedDate) ?? null) : null;

  async function save(status: AttendanceStatus | 'clear', remark: string) {
    if (!selectedDate || saving) return;

    setSaving(true);
    try {
      const response = await fetch('/api/admin/attendance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          date: selectedDate,
          status,
          remark: status === 'absent' ? remark.trim() || null : null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        toast.error(payload && 'error' in payload ? payload.error : 'Could not save.');
        return;
      }

      toast.success(
        status === 'clear'
          ? 'Day cleared.'
          : `Marked ${status}. ${employee.full_name} cannot change this day.`,
      );
      setSelectedDate(null);
      await load(yearMonth);
    } catch {
      toast.error('Unable to reach the server.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/employees"
          className="inline-flex min-h-[38px] items-center gap-1.5 text-sm font-medium text-navy-700 hover:text-navy-900"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Back to staff list
        </Link>

        <StaffDownloadButton
          employeeId={employee.id}
          employeeName={employee.full_name}
          variant="button"
        />
      </div>

      <MonthlySummary summary={summary} monthLabel={bsMonthLabelNepali(yearMonth)} />

      <AttendanceCalendar
        yearMonth={yearMonth}
        days={days}
        holidays={holidayMap}
        today={today}
        loading={loading}
        allowFuture
        onSelectDate={setSelectedDate}
        onChangeMonth={(delta) => setYearMonth((current) => addBsMonths(current, delta))}
      />

      <Modal
        open={Boolean(selectedDate)}
        onClose={() => {
          if (!saving) setSelectedDate(null);
        }}
        busy={saving}
        title={selectedDate ? bsLongLabelNepali(toBs(selectedDate)) : ''}
        description={
          selectedDate
            ? `${employee.full_name} · ${selectedDate}${holidayOnDay ? ` · Holiday: ${holidayOnDay.title}` : ''}`
            : undefined
        }
      >
        {selectedDate ? (
          <DayEditor
            key={selectedDate}
            employeeName={employee.full_name}
            existing={existing}
            holiday={holidayOnDay}
            saving={saving}
            onCancel={() => setSelectedDate(null)}
            onSave={save}
          />
        ) : null}
      </Modal>
    </div>
  );
}


/**
 * The dialog body for one day. Mounted fresh for each date (see the `key`), so
 * the remark box starts from that day's saved value without an effect
 * resetting it mid-typing.
 */
function DayEditor({
  employeeName,
  existing,
  holiday,
  saving,
  onCancel,
  onSave,
}: {
  employeeName: string;
  existing: AttendanceDay | null;
  holiday: CalendarHoliday | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (status: AttendanceStatus | 'clear', remark: string) => void;
}) {
  const [remark, setRemark] = useState(existing?.remark ?? '');

  return (
    <div className="space-y-4">
      {existing ? (
        <p className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          <span className="font-medium">Currently:</span>
          <StatusBadge status={existing.status} />
          {existing.lockedByAdmin ? (
            <span className="inline-flex items-center gap-1 text-xs text-navy-700">
              <Lock aria-hidden className="h-3 w-3" />
              locked
            </span>
          ) : null}
        </p>
      ) : null}

      {holiday ? (
        <p className="rounded-xl bg-absent-soft px-3 py-2.5 text-xs text-absent-ink">
          This is a holiday ({holiday.title}). Marking {employeeName} present here records that
          they worked on a holiday.
        </p>
      ) : null}

      <Textarea
        label="Reason / Remark (only saved with Absent)"
        value={remark}
        maxLength={MAX_REMARK_LENGTH}
        onChange={(event) => setRemark(event.target.value)}
        disabled={saving}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="present" fullWidth loading={saving} onClick={() => onSave('present', remark)}>
          <Check aria-hidden className="h-4 w-4" />
          Present
        </Button>
        <Button variant="absent" fullWidth loading={saving} onClick={() => onSave('absent', remark)}>
          <X aria-hidden className="h-4 w-4" />
          Absent
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button variant="secondary" fullWidth onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        {existing ? (
          <Button variant="ghost" fullWidth loading={saving} onClick={() => onSave('clear', remark)}>
            <Trash2 aria-hidden className="h-4 w-4" />
            Clear this day
          </Button>
        ) : null}
      </div>
    </div>
  );
}
