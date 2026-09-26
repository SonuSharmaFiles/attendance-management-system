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
import { summariseDates } from '@/lib/attendance/summary';
import type { DateStr } from '@/lib/date/nepal';
import {
  addBsMonths,
  bsMonthDates,
  bsMonthLabelNepali,
  type BsYearMonth,
} from '@/lib/date/bikram';
import type { AttendanceDay, AttendanceStatus, CalendarHoliday } from '@/types/attendance';
import type { EmployeePublic } from '@/types/employee';

interface EmployeeDashboardProps {
  employee: EmployeePublic;
  initialMonth: BsYearMonth;
  initialDays: AttendanceDay[];
  initialHolidays: CalendarHoliday[];
  today: DateStr;
  organisationName: string;
  settings: { attendanceEditEnabled: boolean; allowFutureAttendance: boolean };
}

export function EmployeeDashboard({
  employee,
  initialMonth,
  initialDays,
  initialHolidays,
  today,
  organisationName,
  settings,
}: EmployeeDashboardProps) {
  const router = useRouter();
  const [yearMonth, setYearMonth] = useState<BsYearMonth>(initialMonth);
  const [days, setDays] = useState<AttendanceDay[]>(initialDays);
  const [holidays, setHolidays] = useState<CalendarHoliday[]>(initialHolidays);
  const [loadingMonth, setLoadingMonth] = useState(false);
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
  const label = bsMonthLabelNepali(yearMonth);

  /** Loads exactly one month for this employee — never the whole history. */
  const loadMonth = useCallback(async (target: BsYearMonth) => {
    setLoadingMonth(true);
    try {
      const response = await fetch(
        `/api/attendance?bsYear=${target.year}&bsMonth=${target.month}`,
        { cache: 'no-store' },
      );
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { days: AttendanceDay[]; holidays: CalendarHoliday[] } }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        toast.error(
          payload && 'error' in payload ? payload.error : 'Unable to load attendance for that month.',
        );
        return false;
      }

      setDays(payload.data.days);
      setHolidays(payload.data.holidays);
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
    const target = addBsMonths(yearMonth, delta);
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
        if (response.status === 423) {
          // Locked by an administrator.
          toast.error('Updated by administrator', {
            description: 'This day was set by an administrator and cannot be changed here.',
          });
          setSelectedDate(null);
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
          photoUrl={employee.profile_photo_url}
          actions={<DownloadAttendance computerCode={employee.computer_code} />}
        />

        <MonthlySummary summary={summary} monthLabel={label} />

        <AttendanceCalendar
          yearMonth={yearMonth}
          days={days}
          holidays={holidayMap}
          today={today}
          loading={loadingMonth}
          allowFuture={settings.allowFutureAttendance}
          onSelectDate={setSelectedDate}
          onChangeMonth={handleChangeMonth}
          onBlockedClick={(message) =>
            toast(message, { id: 'blocked-day', duration: 2500, icon: '🔒' })
          }
        />

        {loadingMonth ? <LoadingRegion label={`Loading attendance for ${label}`} /> : null}

        <div className="flex justify-center pb-4 sm:hidden">
          <DownloadAttendance computerCode={employee.computer_code} />
        </div>
      </main>

      <AttendanceModal
        date={selectedDate}
        existing={existing}
        holiday={selectedDate ? (holidayMap.get(selectedDate) ?? null) : null}
        isBlockedFuture={
          Boolean(selectedDate) &&
          !settings.allowFutureAttendance &&
          (selectedDate as string) > today
        }
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
