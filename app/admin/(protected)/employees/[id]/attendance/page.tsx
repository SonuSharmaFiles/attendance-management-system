import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAdminContext } from '@/lib/auth/admin';
import { StaffAttendanceEditor } from '@/components/admin/StaffAttendanceEditor';
import { todayInNepal } from '@/lib/date/nepal';
import type { Employee } from '@/types/employee';

export const metadata: Metadata = { title: 'Staff Attendance' };
export const dynamic = 'force-dynamic';

export default async function StaffAttendancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getAdminContext();
  // The layout has already redirected if this is null; narrow for TypeScript.
  if (!admin) return null;

  const { id } = await params;
  const { data } = await admin.supabase
    .from('employees')
    .select(
      'id, computer_code, full_name, rank, department, office, phone, email, profile_photo_url, is_active, created_at, updated_at',
    )
    .eq('id', id)
    .maybeSingle();

  if (!data) notFound();
  const employee = data as Employee;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">{employee.full_name}</h1>
        <p className="mt-1 text-sm text-slate-600">
          <span className="font-mono font-semibold text-navy-800">{employee.computer_code}</span>
          {employee.rank ? ` · ${employee.rank}` : ''}
          {employee.department ? ` · ${employee.department}` : ''}
        </p>
      </div>

      <StaffAttendanceEditor employee={employee} today={todayInNepal()} />
    </div>
  );
}
