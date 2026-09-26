'use client';

import { useState } from 'react';
import { CalendarClock, Check, Lock, PartyPopper, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { type DateStr } from '@/lib/date/nepal';
import { bsLongLabel, bsLongLabelNepali, toBs } from '@/lib/date/bikram';
import { MAX_REMARK_LENGTH } from '@/lib/config';
import type { AttendanceDay, AttendanceStatus, CalendarHoliday } from '@/types/attendance';

interface AttendanceModalProps {
  date: DateStr | null;
  existing: AttendanceDay | null;
  holiday?: CalendarHoliday | null;
  /** True when the date has not arrived and advance marking is switched off. */
  isBlockedFuture?: boolean;
  saving: boolean;
  editEnabled: boolean;
  onClose: () => void;
  onSave: (status: AttendanceStatus, remark: string | null) => void;
}

const QUICK_REMARKS = ['Sick leave', 'Official duty', 'Personal leave', 'Emergency', 'Other'];

export function AttendanceModal(props: AttendanceModalProps) {
  if (!props.date) return null;

  // Keying by date remounts the dialog whenever a different day is opened, so
  // the step and remark reset themselves without a synchronising effect.
  return <AttendanceDialog key={props.date} {...props} date={props.date} />;
}

function AttendanceDialog({
  date,
  existing,
  holiday,
  isBlockedFuture,
  saving,
  editEnabled,
  onClose,
  onSave,
}: AttendanceModalProps & { date: DateStr }) {
  // `step` drives the two-stage absent flow: choose status, then add a remark.
  const [step, setStep] = useState<'choose' | 'absent'>('choose');
  const [remark, setRemark] = useState(() =>
    existing?.status === 'absent' ? (existing.remark ?? '') : '',
  );

  // Three separate reasons a day may be read-only, each with its own message.
  const adminLocked = Boolean(existing?.lockedByAdmin);
  const isHoliday = Boolean(holiday);
  const locked =
    adminLocked || isHoliday || Boolean(isBlockedFuture) || (Boolean(existing) && !editEnabled);

  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      title={`Attendance — ${bsLongLabelNepali(toBs(date))}`}
      description={
        isHoliday || isBlockedFuture
          ? `${bsLongLabel(toBs(date))} · ${date}`
          : adminLocked
            ? 'Updated by administrator'
            : locked
              ? 'This entry has been submitted and can no longer be changed.'
              : existing
                ? 'You can change this entry below.'
                : `${bsLongLabel(toBs(date))} · ${date}`
      }
    >
      {isBlockedFuture && !isHoliday ? (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-slate-100 px-3 py-3 text-sm text-slate-700">
          <CalendarClock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">This day has not arrived yet</span>
            <span className="mt-0.5 block text-xs">
              You can mark it on the day, or afterwards.
            </span>
          </span>
        </p>
      ) : null}

      {isHoliday ? (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-absent-soft px-3 py-3 text-sm text-absent-ink">
          <PartyPopper aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">Holiday — {holiday?.title}</span>
            <span className="mt-0.5 block text-xs">
              There is no attendance to mark on a holiday.
            </span>
          </span>
        </p>
      ) : adminLocked ? (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-navy-50 px-3 py-3 text-sm text-navy-900">
          <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">Updated by administrator</span>
            <span className="mt-0.5 block text-xs">
              An administrator set this day. Contact them if it needs changing.
            </span>
          </span>
        </p>
      ) : null}

      {existing ? (
        <p className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          <span className="font-medium">Current Status:</span>
          <StatusBadge status={existing.status} />
          {existing.remark ? (
            <span className="w-full text-xs text-slate-600">Remark: {existing.remark}</span>
          ) : null}
        </p>
      ) : null}

      {locked ? (
        <Button variant="secondary" fullWidth onClick={onClose}>
          Close
        </Button>
      ) : step === 'choose' ? (
        <div className="space-y-3">
          <Button
            variant="present"
            size="lg"
            fullWidth
            loading={saving}
            onClick={() => onSave('present', null)}
          >
            <Check aria-hidden className="h-5 w-5" />
            PRESENT
          </Button>

          <Button variant="absent" size="lg" fullWidth disabled={saving} onClick={() => setStep('absent')}>
            <X aria-hidden className="h-5 w-5" />
            ABSENT
          </Button>

          <Button variant="ghost" fullWidth onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-navy-900">Mark Attendance as Absent</h3>

          <div className="flex flex-wrap gap-2">
            {QUICK_REMARKS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRemark(preset)}
                className={`min-h-[38px] rounded-full border px-3 text-sm transition-colors ${
                  remark === preset
                    ? 'border-navy-700 bg-navy-800 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <Textarea
            label="Reason / Remark (Optional)"
            value={remark}
            maxLength={MAX_REMARK_LENGTH}
            placeholder="For example: Sick leave"
            hint={`${remark.length}/${MAX_REMARK_LENGTH} characters. You may leave this blank.`}
            onChange={(event) => setRemark(event.target.value)}
            disabled={saving}
          />

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button
              variant="absent"
              fullWidth
              loading={saving}
              onClick={() => onSave('absent', remark.trim() || null)}
            >
              Save Absent
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setStep('choose')} disabled={saving}>
              Back
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
