'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LogOut } from 'lucide-react';
import { Header } from '@/components/Header';
import { EmployeeProfile } from '@/components/EmployeeProfile';
import { AttendanceCalendar } from '@/components/AttendanceCalendar';
import { AttendanceModal } from '@/components/AttendanceModal';
import { MonthlySummary } from '@/components/MonthlySummary';
import { DownloadAttendance } from '@/components/DownloadAttendance';
import { LoadingRegion } from '@/components/LoadingState';
import { summariseMonth } from '@/lib/attendance/summary';
import { addMonths, monthLabel, type DateStr, type YearMonth } from '@/lib/date/nepal';
import type { AttendanceDay, AttendanceStatus } from '@/types/attendance';
import type { EmployeePublic } from '@/types/employee';

interface EmployeeDashboardProps {
  employee: EmployeePublic;
  initialMonth: YearMonth;
  initialDays: AttendanceDay[];
  today: DateStr;
  organisationName: string;
  settings: { attendanceEditEnabled: boolean; allowFutureAttendance: boolean };
}

export function EmployeeDashboard({
  employee,
  initialMonth,
  initialDays,
  today,
  organisationName,
  settings,
}: EmployeeDashboardProps) {
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = useState(employee.profile_photo_url);
  const [yearMonth, setYearMonth] = useState<YearMonth>(initialMonth);
  const [days, setDays] = useState<AttendanceDay[]>(initialDays);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [selectedDate, setSelectedDate] = useState<DateStr | null>(null);
  const [saving, setSaving] = useState(false);

  const summary = useMemo(() => summariseMonth(yearMonth, days, today), [yearMonth, days, today]);
  const label = monthLabel(yearMonth);

  /** Loads exactly one month for this employee — never the whole history. */
  const loadMonth = useCallback(async (target: YearMonth) => {
    setLoadingMonth(true);
    try {
      const response = await fetch(`/api/attendance?year=${target.year}&month=${target.month}`, {
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { days: AttendanceDay[] } }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        toast.error(
          payload && 'error' in payload ? payload.error : 'Unable to load attendance for that month.',
        );
        return false;
      }

      setDays(payload.data.days);
      return true;
    } catch {
      toast.error('Unable to reach the server. Please check your connection.');
      return false;
    } finally {
      setLoadingMonth(false);
    }
  }, []);

  async function handleChangeMonth(delta: number) {
    if (loadingMonth) return;
    const target = addMonths(yearMonth, delta);
    setYearMonth(target);
    await loadMonth(target);
  }

  async function handleSave(status: AttendanceStatus, remark: string | null) {
    if (!selectedDate || saving) return;

    setSaving(true);
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, status, remark }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { day: AttendanceDay } }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        if (response.status === 401) {
          toast.error('Your session has expired. Please enter your code again.');
          router.push('/');
          return;
        }
        toast.error(
          payload && 'error' in payload ? payload.error : 'Unable to save attendance. Please try again.',
        );
        return;
      }

      // Replace the day in place so the calendar recolours immediately.
      const saved = payload.data.day;
      setDays((current) => {
        const others = current.filter((day) => day.date !== saved.date);
        return [...others, saved].sort((a, b) => a.date.localeCompare(b.date));
      });

      setSelectedDate(null);
      toast.success(
        saved.status === 'present' ? 'Attendance marked as Present.' : 'Attendance marked as Absent.',
      );
    } catch {
      toast.error('Unable to reach the server. Please check your connection.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await fetch('/api/session', { method: 'DELETE' }).catch(() => null);
    router.push('/');
    router.refresh();
  }

  const existing = selectedDate ? (days.find((day) => day.date === selectedDate) ?? null) : null;

  return (
    <div className="min-h-screen">
      <Header
        title="Attendance Management"
        subtitle={organisationName}
        action={
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-navy-100 transition-colors hover:bg-navy-700 hover:text-white"
          >
            <LogOut aria-hidden className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        }
      />

      <main id="main" className="mx-auto max-w-4xl space-y-5 px-3 py-5 sm:px-6 sm:py-8">
        <EmployeeProfile
          employee={employee}
          photoUrl={photoUrl}
          onPhotoUploaded={setPhotoUrl}
          actions={<DownloadAttendance computerCode={employee.computer_code} />}
        />

        <MonthlySummary summary={summary} monthLabel={label} />

        <AttendanceCalendar
          yearMonth={yearMonth}
          days={days}
          today={today}
          loading={loadingMonth}
          allowFuture={settings.allowFutureAttendance}
          onSelectDate={setSelectedDate}
          onChangeMonth={handleChangeMonth}
        />

        {loadingMonth ? <LoadingRegion label={`Loading attendance for ${label}`} /> : null}

        <div className="flex justify-center pb-4 sm:hidden">
          <DownloadAttendance computerCode={employee.computer_code} />
        </div>
      </main>

      <AttendanceModal
        date={selectedDate}
        existing={existing}
        saving={saving}
        editEnabled={settings.attendanceEditEnabled}
        onClose={() => {
          if (!saving) setSelectedDate(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}
