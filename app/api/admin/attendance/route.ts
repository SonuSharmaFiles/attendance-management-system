import { requireAdmin } from '@/lib/auth/admin';
import { adminAttendanceQuerySchema, adminAttendanceSchema } from '@/lib/validation/schemas';
import { AppError, describeDbError, handleRouteError, jsonOk, readJson } from '@/lib/http';
import { compareDateStr } from '@/lib/date/nepal';

export const runtime = 'nodejs';

/** GET /api/admin/attendance?from=&to=&employeeId=&department=&status= */
export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const url = new URL(request.url);

    const parsed = adminAttendanceQuerySchema.parse({
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
      employeeId: url.searchParams.get('employeeId') || undefined,
      department: url.searchParams.get('department') || undefined,
      status: url.searchParams.get('status') || 'all',
    });

    if (compareDateStr(parsed.from, parsed.to) > 0) {
      throw new AppError('The start date must not be after the end date.', 422);
    }

    let query = supabase
      .from('attendance')
      .select(
        'id, attendance_date, status, remark, employee_id, employees!inner (computer_code, full_name, rank, department)',
        { count: 'exact' },
      )
      .gte('attendance_date', parsed.from)
      .lte('attendance_date', parsed.to);

    if (parsed.employeeId) query = query.eq('employee_id', parsed.employeeId);
    if (parsed.department) query = query.eq('employees.department', parsed.department);
    if (parsed.status !== 'all') query = query.eq('status', parsed.status);

    const { data, error, count } = await query
      .order('attendance_date', { ascending: false })
      .limit(1000);

    if (error) throw new AppError(describeDbError(error), 500);

    return jsonOk({ records: data ?? [], total: count ?? 0 });
  } catch (error) {
    return handleRouteError(error, 'Unable to load attendance records.');
  }
}

/**
 * POST /api/admin/attendance — set, correct or clear one day for any employee.
 * Admins are trusted with an explicit employeeId; employees are not.
 */
export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const parsed = adminAttendanceSchema.parse(await readJson(request));

    if (parsed.status === 'clear') {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('employee_id', parsed.employeeId)
        .eq('attendance_date', parsed.date);
      if (error) throw new AppError(describeDbError(error), 500);
      return jsonOk({ cleared: true });
    }

    const { data, error } = await supabase
      .from('attendance')
      .upsert(
        {
          employee_id: parsed.employeeId,
          attendance_date: parsed.date,
          status: parsed.status,
          remark: parsed.status === 'absent' ? parsed.remark : null,
          // Anything an administrator sets is locked against staff edits.
          locked_by_admin: true,
        },
        { onConflict: 'employee_id,attendance_date' },
      )
      .select('attendance_date, status, remark, locked_by_admin')
      .single();

    if (error) throw new AppError(describeDbError(error), 500);

    return jsonOk({ record: data });
  } catch (error) {
    return handleRouteError(error, 'Unable to save the attendance record.');
  }
}
