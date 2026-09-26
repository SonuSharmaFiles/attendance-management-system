import { z } from 'zod';
import { dateStrSchema } from '@/lib/validation/schemas';
import { requireAdmin } from '@/lib/auth/admin';
import { buildYearGridWorkbook, type GridStaff } from '@/lib/excel/year-grid';
import { getHolidaysForDates } from '@/lib/holidays/queries';
import { AppError, describeDbError, handleRouteError, readJson } from '@/lib/http';
import { CONTENT_TYPES } from '@/lib/excel/filenames';
import { todayInNepal, type DateStr } from '@/lib/date/nepal';
import { bsDaysInMonth, fromBs } from '@/lib/date/bikram';
import type { AttendanceStatus } from '@/types/attendance';

export const runtime = 'nodejs';
export const maxDuration = 60;

const requestSchema = z
  .object({
    bsYear: z.coerce.number().int().min(2000).max(2100),
    department: z.string().trim().max(120).optional(),
    employeeId: z.string().uuid().optional(),
    // Omitted by the scheduled backup, which always wants the whole year.
    fromDate: z.union([dateStrSchema, z.literal('')]).optional().transform((v) => v || undefined),
    toDate: z.union([dateStrSchema, z.literal('')]).optional().transform((v) => v || undefined),
  })
  .refine((v) => !v.fromDate || !v.toDate || v.fromDate <= v.toDate, {
    message: 'The start date must not be after the end date.',
    path: ['fromDate'],
  });

/**
 * POST /api/admin/export/year-grid
 * A whole Bikram Sambat year as one grid: staff down, days across.
 */
export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const input = requestSchema.parse(await readJson(request));

    let staffQuery = supabase
      .from('employees')
      .select('id, computer_code, full_name')
      .eq('is_active', true)
      .order('computer_code', { ascending: true });

    if (input.employeeId) staffQuery = staffQuery.eq('id', input.employeeId);
    if (input.department) staffQuery = staffQuery.eq('department', input.department);

    const { data: staff, error: staffError } = await staffQuery;
    if (staffError) throw new AppError(describeDbError(staffError), 500);
    if (!staff || staff.length === 0) throw new AppError('No staff match that selection.', 404);

    // The Gregorian span of the whole Nepali year.
    const first = fromBs({ year: input.bsYear, month: 1, day: 1 });
    const last = fromBs({
      year: input.bsYear,
      month: 12,
      day: bsDaysInMonth({ year: input.bsYear, month: 12 }),
    });

    const { data: rows, error: attendanceError } = await supabase
      .from('attendance')
      .select('employee_id, attendance_date, status, remark')
      .in('employee_id', staff.map((s) => s.id))
      .gte('attendance_date', first)
      .lte('attendance_date', last);

    if (attendanceError) throw new AppError(describeDbError(attendanceError), 500);

    const attendance = new Map<string, { status: AttendanceStatus; remark: string | null }>();
    for (const row of rows ?? []) {
      attendance.set(`${row.employee_id}|${row.attendance_date}`, {
        status: row.status as AttendanceStatus,
        remark: (row.remark as string | null) ?? null,
      });
    }

    // Every day of the year, so holiday rules can be expanded across it.
    const allDates: DateStr[] = [];
    for (let month = 1; month <= 12; month += 1) {
      for (let day = 1; day <= bsDaysInMonth({ year: input.bsYear, month }); day += 1) {
        allDates.push(fromBs({ year: input.bsYear, month, day }));
      }
    }
    const holidays = await getHolidaysForDates(allDates);

    const workbook = await buildYearGridWorkbook({
      bsYear: input.bsYear,
      staff: staff as GridStaff[],
      attendance,
      holidays,
      today: todayInNepal(),
      fromDate: input.fromDate,
      toDate: input.toDate,
    });

    const suffix =
      input.fromDate || input.toDate
        ? `-${input.fromDate ?? 'start'}-to-${input.toDate ?? 'end'}`
        : '';

    return new Response(workbook as BodyInit, {
      headers: {
        'Content-Type': CONTENT_TYPES.xlsx,
        'Content-Disposition': `attachment; filename="attendance-${input.bsYear}-BS${suffix}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleRouteError(error, 'The year grid could not be generated.');
  }
}
