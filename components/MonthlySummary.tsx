import { CalendarDays, Check, Minus, TrendingUp, X } from 'lucide-react';
import type { MonthlySummary as Summary } from '@/types/attendance';

interface TileProps {
  label: string;
  value: string | number;
  Icon: typeof Check;
  tone: string;
}

function Tile({ label, value, Icon, tone }: TileProps) {
  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon aria-hidden className={`h-4 w-4 ${tone}`} />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-navy-900">{value}</p>
    </div>
  );
}

export function MonthlySummary({ summary, monthLabel }: { summary: Summary; monthLabel: string }) {
  return (
    <section aria-label={`Attendance summary for ${monthLabel}`}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile label="Total Days" value={summary.totalDays} Icon={CalendarDays} tone="text-navy-600" />
        <Tile label="Present" value={summary.present} Icon={Check} tone="text-present" />
        <Tile label="Absent" value={summary.absent} Icon={X} tone="text-absent" />
        <Tile label="Not Marked" value={summary.notMarked} Icon={Minus} tone="text-unmarked" />
        <Tile
          label="Attendance Rate"
          value={`${summary.attendanceRate}%`}
          Icon={TrendingUp}
          tone="text-navy-600"
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Not Marked counts days up to today only — the rest of {monthLabel} is not counted as absent.
      </p>
    </section>
  );
}
