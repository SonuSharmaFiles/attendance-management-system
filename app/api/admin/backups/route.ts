import { requireAdmin } from '@/lib/auth/admin';
import { runBackup } from '@/lib/backups/run';
import { AppError, describeDbError, handleRouteError, jsonOk, readJson } from '@/lib/http';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** GET — the backup history and the currently chosen day. */
export async function GET() {
  try {
    const { supabase } = await requireAdmin();

    const [backups, setting] = await Promise.all([
      supabase
        .from('backups')
        .select('id, bs_year, file_path, file_size, staff_count, record_count, source, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('app_settings').select('value').eq('key', 'backup_day_of_month').maybeSingle(),
    ]);

    if (backups.error) throw new AppError(describeDbError(backups.error), 500);

    return jsonOk({
      backups: backups.data ?? [],
      backupDayOfMonth: Number(setting.data?.value ?? 1),
    });
  } catch (error) {
    return handleRouteError(error, 'Unable to load backups.');
  }
}

/** POST — run one now, by hand. */
export async function POST() {
  try {
    await requireAdmin();
    const result = await runBackup('manual');
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error, 'The backup could not be created.');
  }
}

/** PATCH — change which day of the Nepali month the robot runs. */
export async function PATCH(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const { dayOfMonth } = z
      .object({ dayOfMonth: z.coerce.number().int().min(1).max(29) })
      .parse(await readJson(request));

    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'backup_day_of_month', value: String(dayOfMonth) }, { onConflict: 'key' });

    if (error) throw new AppError(describeDbError(error), 500);
    return jsonOk({ dayOfMonth });
  } catch (error) {
    return handleRouteError(error, 'The backup day could not be saved.');
  }
}
