import type { Metadata } from 'next';
import { getAdminContext } from '@/lib/auth/admin';
import { AttendanceManager } from '@/components/admin/AttendanceManager';
import { ExportPanel } from '@/components/admin/ExportPanel';

export const metadata: Metadata = { title: 'Attendance' };
export const dynamic = 'force-dynamic';

export default async function AdminAttendancePage() {
  const admin = await getAdminContext();
  if (!admin) return null;

  // Distinct department names, for the filter and export dropdowns.
  const { data } = await admin.supabase
    .from('employees')
    .select('department')
    .not('department', 'is', null)
    .order('department', { ascending: true });

  const departments = Array.from(
    new Set((data ?? []).map((row) => row.department as string).filter(Boolean)),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">Attendance Management</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review, correct and export attendance records for any staff member or period.
        </p>
      </div>

      <ExportPanel departments={departments} />
      <AttendanceManager departments={departments} />
    </div>
  );
}
