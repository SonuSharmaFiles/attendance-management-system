import { requireAdmin } from '@/lib/auth/admin';
import { getHolidaysForDates } from '@/lib/holidays/queries';
import { assignLeaveSchema } from '@/lib/validation/schemas';
import { AppError, describeDbError, handleRouteError, jsonOk, readJson } from '@/lib/http';
import { type DateStr } from '@/lib/date/nepal';
import { toBs, bsLongLabel } from '@/lib/date/bikram';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Every calendar day from `from` to `to`, inclusive. */
function datesInRange(from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = [];
  // Stepping through UTC noon avoids any daylight-saving or timezone shift.
  let cursor = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
    12,
  );
  const end = Date.UTC(
    Number(to.slice(0, 4)),
    Number(to.slice(5, 7)) - 1,
    Number(to.slice(8, 10)),
    12,
  );

  while (cursor <= end) {
    out.push(new Date(cursor).toISOString().slice(0, 10) as DateStr);
    cursor += 24 * 60 * 60 * 1000;
  }
  return out;
}

const MAX_LEAVE_DAYS = 366;

/**
 * POST /api/admin/employees/:id/leave
 * Assigns (or clears) leave across a date range for one staff member.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAdmin();
    const { id } = await params;
    const input = assignLeaveSchema.parse(await readJson(request));

    const { data: employee } = await supabase
      .from('employees')
      .select('id, full_name')
      .eq('id', id)
      .maybeSingle();

    if (!employee) throw new AppError('Staff member not found.', 404);

    const allDates = datesInRange(input.fromDate, input.toDate);
    if (allDates.length > MAX_LEAVE_DAYS) {
      throw new AppError(`Leave can be assigned for up to ${MAX_LEAVE_DAYS} days at a time.`, 422);
    }

    // A holiday is already a non-working day. Turning it into leave would eat
    // into someone's leave entitlement for a day they were never due to work.
    const holidays = await getHolidaysForDates(allDates);
    const workingDates = allDates.filter((date) => !holidays.has(date));

    if (workingDates.length === 0) {
      throw new AppError(
        'Every day in that range is already a holiday, so there is no leave to assign.',
        422,
      );
    }

    if (input.clear) {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('employee_id', id)
        .eq('status', 'leave')
        .in('attendance_date', workingDates);

      if (error) throw new AppError(describeDbError(error), 500);

      return jsonOk({
        cleared: true,
        days: workingDates.length,
        skippedHolidays: allDates.length - workingDates.length,
      });
    }

    const rows = workingDates.map((date) => ({
      employee_id: id,
      attendance_date: date,
      status: 'leave' as const,
      remark: input.remark,
      // Assigned by an administrator, so the staff member cannot change it.
      locked_by_admin: true,
    }));

    const { error } = await supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'employee_id,attendance_date' });

    if (error) throw new AppError(describeDbError(error), 500);

    return jsonOk({
      assigned: workingDates.length,
      skippedHolidays: allDates.length - workingDates.length,
      from: bsLongLabel(toBs(input.fromDate)),
      to: bsLongLabel(toBs(input.toDate)),
      employeeName: employee.full_name,
    });
  } catch (error) {
    return handleRouteError(error, 'The leave could not be assigned.');
  }
}
