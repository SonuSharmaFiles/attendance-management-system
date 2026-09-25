import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarCheck, Check, Minus, Upload, Users, X } from 'lucide-react';
import { getAdminContext } from '@/lib/auth/admin';
import { longDateLabel, todayInNepal } from '@/lib/date/nepal';

export const metadata: Metadata = { title: 'Admin Dashboard' };
export const dynamic = 'force-dynamic';

interface TileProps {
  label: string;
  value: number;
  Icon: typeof Users;
  tone: string;
}

function Tile({ label, value, Icon, tone }: TileProps) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <Icon aria-hidden className={`h-4 w-4 ${tone}`} />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums text-navy-900">{value}</p>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const admin = await getAdminContext();
  // The layout has already redirected if this is null; narrow for TypeScript.
  if (!admin) return null;

  const today = todayInNepal();
  const { supabase } = admin;

  const [employees, present, absent] = await Promise.all([
    supabase.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('attendance_date', today)
      .eq('status', 'present'),
    supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('attendance_date', today)
      .eq('status', 'absent'),
  ]);

  const failed = employees.error ?? present.error ?? absent.error;

  const totalEmployees = employees.count ?? 0;
  const presentCount = present.count ?? 0;
  const absentCount = absent.count ?? 0;
  const notMarked = Math.max(0, totalEmployees - presentCount - absentCount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Today is {longDateLabel(today)} (Nepal time).
        </p>
      </div>

      {failed ? (
        <p role="alert" className="card border-red-200 bg-red-50 p-4 text-sm text-absent-ink">
          The database could not be reached. Check your Supabase configuration and refresh.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Tile label="Total Employees" value={totalEmployees} Icon={Users} tone="text-navy-600" />
          <Tile label="Today's Present" value={presentCount} Icon={Check} tone="text-present" />
          <Tile label="Today's Absent" value={absentCount} Icon={X} tone="text-absent" />
          <Tile label="Today's Not Marked" value={notMarked} Icon={Minus} tone="text-unmarked" />
        </div>
      )}

      <section aria-label="Quick actions" className="grid gap-3 sm:grid-cols-3">
        {[
          {
            href: '/admin/employees',
            title: 'Manage Employees',
            description: 'Add, edit, search, photograph or deactivate staff records.',
            Icon: Users,
          },
          {
            href: '/admin/employees/import',
            title: 'Import from Excel',
            description: 'Upload your existing employee spreadsheet with a preview first.',
            Icon: Upload,
          },
          {
            href: '/admin/attendance',
            title: 'Attendance & Export',
            description: 'Review, correct and export attendance for any period.',
            Icon: CalendarCheck,
          },
        ].map(({ href, title, description, Icon }) => (
          <Link
            key={href}
            href={href}
            className="card group p-4 transition-colors hover:border-navy-300 hover:bg-navy-50"
          >
            <Icon aria-hidden className="h-5 w-5 text-navy-600" />
            <h2 className="mt-2 font-semibold text-navy-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
