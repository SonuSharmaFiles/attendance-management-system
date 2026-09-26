import { getServiceClient } from '@/lib/supabase/admin';
import { AppError, describeDbError } from '@/lib/errors';
import { buildYearGridWorkbook, type GridStaff } from '@/lib/excel/year-grid';
import { getHolidaysForDates } from '@/lib/holidays/queries';
import { todayInNepal, parseDateStr, type DateStr } from '@/lib/date/nepal';
import { bsDaysInMonth, bsYearMonthOf, fromBs, toBs } from '@/lib/date/bikram';
import type { AttendanceStatus } from '@/types/attendance';

export const BACKUP_BUCKET = 'attendance-backups';

export interface BackupResult {
  created: boolean;
  reason?: string;
  filePath?: string;
  bsYear?: number;
  staffCount?: number;
  recordCount?: number;
  fileSize?: number;
}

async function getSetting(key: string, fallback: string): Promise<string> {
  const supabase = getServiceClient();
  const { data } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
  return data?.value ?? fallback;
}

/**
 * Builds the whole-year grid and stores it.
 *
 * Always the full Nepali year, never a range: a backup that covers only part
 * of the year is not a backup. The admin export handles ranges instead.
 */
export async function runBackup(source: 'scheduled' | 'manual'): Promise<BackupResult> {
  const supabase = getServiceClient();
  const today = todayInNepal();
  const bsYear = bsYearMonthOf(today).year;

  if (source === 'scheduled') {
    // The robot runs daily; the day it should ACT on lives in the database so
    // an administrator can change it without editing a workflow file.
    const dayOfMonth = Number(await getSetting('backup_day_of_month', '1'));
    const todayBsDay = toBs(today).day;

    if (todayBsDay !== dayOfMonth) {
      return { created: false, reason: `Not the backup day (set to day ${dayOfMonth} of the Nepali month; today is ${todayBsDay}).` };
    }

    // Guard against a re-run on the same day producing duplicates.
    const { data: recent } = await supabase
      .from('backups')
      .select('id, created_at')
      .eq('source', 'scheduled')
      .gte('created_at', `${today}T00:00:00Z`)
      .limit(1);

    if (recent && recent.length > 0) {
      return { created: false, reason: 'A scheduled backup has already run today.' };
    }
  }

  // --- Gather -------------------------------------------------------------
  const { data: staff, error: staffError } = await supabase
    .from('employees')
    .select('id, computer_code, full_name')
    .eq('is_active', true)
    .order('computer_code', { ascending: true });

  if (staffError) throw new AppError(describeDbError(staffError), 500);
  if (!staff || staff.length === 0) {
    return { created: false, reason: 'There are no active staff to back up.' };
  }

  const first = fromBs({ year: bsYear, month: 1, day: 1 });
  const last = fromBs({
    year: bsYear,
    month: 12,
    day: bsDaysInMonth({ year: bsYear, month: 12 }),
  });

  const { data: rows, error: rowsError } = await supabase
    .from('attendance')
    .select('employee_id, attendance_date, status, remark')
    .in('employee_id', staff.map((s) => s.id))
    .gte('attendance_date', first)
    .lte('attendance_date', last);

  if (rowsError) throw new AppError(describeDbError(rowsError), 500);

  const attendance = new Map<string, { status: AttendanceStatus; remark: string | null }>();
  for (const row of rows ?? []) {
    attendance.set(`${row.employee_id}|${row.attendance_date}`, {
      status: row.status as AttendanceStatus,
      remark: (row.remark as string | null) ?? null,
    });
  }

  const allDates: DateStr[] = [];
  for (let month = 1; month <= 12; month += 1) {
    for (let day = 1; day <= bsDaysInMonth({ year: bsYear, month }); day += 1) {
      allDates.push(fromBs({ year: bsYear, month, day }));
    }
  }
  const holidays = await getHolidaysForDates(allDates);

  // --- Build and store ----------------------------------------------------
  const workbook = await buildYearGridWorkbook({
    bsYear,
    staff: staff as GridStaff[],
    attendance,
    holidays,
    today,
  });

  const { year, month, day } = parseDateStr(today);
  const stamp = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}-${Date.now()}`;
  const filePath = `${bsYear}/attendance-${bsYear}-BS-${stamp}.xlsx`;

  const { error: uploadError } = await supabase.storage
    .from(BACKUP_BUCKET)
    .upload(filePath, workbook, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: false,
    });

  if (uploadError) {
    console.error('[attendance] backup upload failed:', uploadError);
    throw new AppError('The backup file could not be stored.', 502);
  }

  const { error: recordError } = await supabase.from('backups').insert({
    bs_year: bsYear,
    file_path: filePath,
    file_size: workbook.length,
    staff_count: staff.length,
    record_count: rows?.length ?? 0,
    source,
  });

  if (recordError) throw new AppError(describeDbError(recordError), 500);

  return {
    created: true,
    filePath,
    bsYear,
    staffCount: staff.length,
    recordCount: rows?.length ?? 0,
    fileSize: workbook.length,
  };
}
