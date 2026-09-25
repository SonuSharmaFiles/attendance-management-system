import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getEmployeeSession } from '@/lib/auth/employee-session';
import { getEmployeeById, toPublicEmployee } from '@/lib/employees/queries';
import { getMonthAttendance } from '@/lib/attendance/queries';
import { currentYearMonth, todayInNepal } from '@/lib/date/nepal';
import { getAppSettings } from '@/lib/config';
import { EmployeeDashboard } from '@/components/EmployeeDashboard';

export const metadata: Metadata = {
  title: 'My Attendance',
  robots: { index: false, follow: false },
};

// Always rendered per request: attendance must never be served from a cache.
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ computerCode: string }>;
}

export default async function EmployeePage({ params }: PageProps) {
  const { computerCode } = await params;
  const session = await getEmployeeSession();

  // No valid session — send the visitor back to enter a code.
  if (!session) redirect('/');

  /*
   * THE URL IS NOT TRUSTED.
   *
   * The employee id used below comes from the signed cookie. The code in the
   * address bar is only compared against it: typing another person's code here
   * does not load their record, it bounces back to the landing page.
   */
  if (session.code.toUpperCase() !== decodeURIComponent(computerCode).trim().toUpperCase()) {
    redirect('/');
  }

  const employee = await getEmployeeById(session.sub);
  if (!employee || !employee.is_active) redirect('/');

  const yearMonth = currentYearMonth();
  const [days, settings] = await Promise.all([
    getMonthAttendance(employee.id, yearMonth),
    Promise.resolve(getAppSettings()),
  ]);

  return (
    <EmployeeDashboard
      employee={toPublicEmployee(employee)}
      initialMonth={yearMonth}
      initialDays={days}
      today={todayInNepal()}
      organisationName={settings.organisationName}
      settings={{
        attendanceEditEnabled: settings.attendanceEditEnabled,
        allowFutureAttendance: settings.allowFutureAttendance,
      }}
    />
  );
}
