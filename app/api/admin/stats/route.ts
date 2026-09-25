import { requireAdmin } from '@/lib/auth/admin';
import { AppError, describeDbError, handleRouteError, jsonOk } from '@/lib/http';
import { todayInNepal } from '@/lib/date/nepal';

export const runtime = 'nodejs';

/** GET /api/admin/stats — dashboard tiles for today (Nepal time). */
export async function GET() {
  try {
    const { supabase } = await requireAdmin();
    const today = todayInNepal();

    const [employeesResult, presentResult, absentResult] = await Promise.all([
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

    const firstError = employeesResult.error ?? presentResult.error ?? absentResult.error;
    if (firstError) throw new AppError(describeDbError(firstError), 500);

    const totalEmployees = employeesResult.count ?? 0;
    const present = presentResult.count ?? 0;
    const absent = absentResult.count ?? 0;

    return jsonOk({
      today,
      totalEmployees,
      present,
      absent,
      notMarked: Math.max(0, totalEmployees - present - absent),
    });
  } catch (error) {
    return handleRouteError(error, 'Unable to load dashboard figures.');
  }
}
