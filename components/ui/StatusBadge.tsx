import { Check, Minus, Plane, X } from 'lucide-react';
import type { AttendanceStatus } from '@/types/attendance';

export type DisplayStatus = AttendanceStatus | 'unmarked';

/**
 * Status is always shown as colour + icon + text, never colour alone, so it
 * still reads correctly for colour-blind users and in black-and-white print.
 */
const STYLES: Record<DisplayStatus, { label: string; className: string; Icon: typeof Check }> = {
  present: {
    label: 'Present',
    className: 'bg-present-soft text-present-ink border-green-300',
    Icon: Check,
  },
  absent: {
    label: 'Absent',
    className: 'bg-absent-soft text-absent-ink border-red-300',
    Icon: X,
  },
  leave: {
    label: 'Leave',
    className: 'bg-leave-soft text-leave-ink border-amber-300',
    Icon: Plane,
  },
  unmarked: {
    label: 'Not Marked',
    className: 'bg-unmarked-soft text-slate-600 border-slate-300',
    Icon: Minus,
  },
};

export function StatusBadge({ status, className = '' }: { status: DisplayStatus; className?: string }) {
  const { label, className: tone, Icon } = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone} ${className}`}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export function statusLabel(status: DisplayStatus): string {
  return STYLES[status].label;
}
