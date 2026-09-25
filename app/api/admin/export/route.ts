import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/admin';
import { buildFullExportWorkbook, rowsToCsv, type FullExportEmployee } from '@/lib/excel/export';
import { CONTENT_TYPES, fullExportFilename, periodLabel } from '@/lib/excel/filenames';
import { AppError, describeDbError, handleRouteError, readJson } from '@/lib/http';
import { MAX_EXPORT_MONTHS } from '@/lib/config';
import {
  compareYearMonth,
  datesBetweenMonths,
  dayName,
  monthBounds,
  todayInNepal,
  yearMonthFromInput,
} from '@/lib/date/nepal';
import type { AttendanceReportRow } from '@/types/attendance';

export const runtime = 'nodejs';
export const maxDuration = 60;

const requestSchema = z.object({
  fromMonth: z.string().regex(/^\d{4}-\d{2}$/),
  toMonth: z.string().regex(/^\d{4}-\d{2}$/),
  format: z.enum(['xlsx', 'csv']),
  /** Restrict to one employee, one department, or leave both out for everyone. */
  employeeId: z.string().uuid().optional(),
  employeeIds: z.array(z.string().uuid()).max(500).optional(),
  department: z.string().trim().max(120).optional(),
  /** Include days with no record at all. Off by default to keep files small. */
  includeUnmarked: z.boolean().optional().default(false),
});

/** POST /api/admin/export — Employees + Attendance + Summary workbook, or a flat CSV. */
export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const input = requestSchema.parse(await readJson(request));

    const from = yearMonthFromInput(input.fromMonth);
    const to = yearMonthFromInput(input.toMonth);
    if (!from || !to || compareYearMonth(from, to) > 0) {
      throw new AppError('Please choose a valid month range.', 422);
    }
    if (compareYearMonth(to, from) + 1 > MAX_EXPORT_MONTHS) {
      throw new AppError(`Please choose a range of ${MAX_EXPORT_MONTHS} months or fewer.`, 422);
    }

    // --- Employees in scope ------------------------------------------------
    let employeeQuery = supabase
      .from('employees')
      .select('id, computer_code, full_name, rank, department, office')
      .order('computer_code', { ascending: true });

    if (input.employeeId) employeeQuery = employeeQuery.eq('id', input.employeeId);
    if (input.employeeIds?.length) employeeQuery = employeeQuery.in('id', input.employeeIds);
    if (input.department) employeeQuery = employeeQuery.eq('department', input.department);

    const { data: employees, error: employeesError } = await employeeQuery;
    if (employeesError) throw new AppError(describeDbError(employeesError), 500);
    if (!employees || employees.length === 0) {
      throw new AppError('No employees match that selection.', 404);
    }

    // --- Attendance in scope ----------------------------------------------
    const start = monthBounds(from).start;
    const end = monthBounds(to).end;
    const employeeIds = employees.map((employee) => employee.id as string);

    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('employee_id, attendance_date, status, remark')
      .in('employee_id', employeeIds)
      .gte('attendance_date', start)
      .lte('attendance_date', end)
      .order('attendance_date', { ascending: true });

    if (attendanceError) throw new AppError(describeDbError(attendanceError), 500);

    const today = todayInNepal();
    const allDates = datesBetweenMonths(from, to).filter((date) => date <= today);

    const byEmployeeDate = new Map<string, { status: string; remark: string | null }>();
    for (const record of attendance ?? []) {
      byEmployeeDate.set(`${record.employee_id}|${record.attendance_date}`, {
        status: record.status as string,
        remark: (record.remark as string | null) ?? null,
      });
    }

    const rows: AttendanceReportRow[] = [];
    for (const employee of employees) {
      for (const date of allDates) {
        const record = byEmployeeDate.get(`${employee.id}|${date}`);
        if (!record && !input.includeUnmarked) continue;
        rows.push({
          computerCode: employee.computer_code as string,
          fullName: employee.full_name as string,
          date,
          day: dayName(date),
          status: record ? (record.status === 'present' ? 'Present' : 'Absent') : 'Not Marked',
          remark: record?.remark ?? '',
        });
      }
    }

    const filename = fullExportFilename(from, to, input.format);

    if (input.format === 'csv') {
      return new Response(rowsToCsv(rows), {
        headers: {
          'Content-Type': CONTENT_TYPES.csv,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const workbook = await buildFullExportWorkbook({
      employees: employees.map((employee) => ({
        computer_code: employee.computer_code,
        full_name: employee.full_name,
        rank: employee.rank,
        department: employee.department,
        office: employee.office,
      })) as FullExportEmployee[],
      rows,
      periodLabel: periodLabel(from, to),
    });

    return new Response(workbook as BodyInit, {
      headers: {
        'Content-Type': CONTENT_TYPES.xlsx,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleRouteError(error, 'The export could not be generated.');
  }
}
