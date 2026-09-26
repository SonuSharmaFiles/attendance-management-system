import { requireAdmin } from '@/lib/auth/admin';
import { getServiceClient } from '@/lib/supabase/admin';
import { BACKUP_BUCKET } from '@/lib/backups/run';
import { AppError, handleRouteError, jsonOk, readJson } from '@/lib/http';
import { z } from 'zod';

export const runtime = 'nodejs';

/**
 * POST /api/admin/backups/download — a short-lived link to one backup.
 *
 * The bucket is private, so there is no public URL to hand out. A signed link
 * valid for five minutes is enough to start a download and useless if it later
 * leaks out of a browser history.
 */
export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const { id } = z.object({ id: z.string().uuid() }).parse(await readJson(request));

    const { data: backup } = await supabase
      .from('backups')
      .select('file_path')
      .eq('id', id)
      .maybeSingle();

    if (!backup) throw new AppError('That backup no longer exists.', 404);

    const { data, error } = await getServiceClient()
      .storage.from(BACKUP_BUCKET)
      .createSignedUrl(backup.file_path as string, 300);

    if (error || !data) {
      console.error('[attendance] signed url failed:', error);
      throw new AppError('The download link could not be created.', 502);
    }

    return jsonOk({ url: data.signedUrl });
  } catch (error) {
    return handleRouteError(error, 'The download could not be prepared.');
  }
}
