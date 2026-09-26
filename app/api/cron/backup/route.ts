import { runBackup } from '@/lib/backups/run';
import { handleRouteError, jsonError, jsonOk } from '@/lib/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/cron/backup — called by the scheduled robot.
 *
 * The robot has no Supabase session, so this route is guarded by a shared
 * secret instead. The comparison is length-safe and constant-time-ish: a plain
 * === on a secret leaks its length through timing, which is cheap to avoid.
 */
function secretMatches(provided: string | null): boolean {
  const expected = process.env.BACKUP_CRON_SECRET;
  if (!expected || !provided) return false;
  if (provided.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(request: Request) {
  try {
    const provided =
      request.headers.get('x-backup-secret') ??
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
      null;

    if (!secretMatches(provided)) {
      // Deliberately vague: this endpoint should give nothing away.
      return jsonError('Not authorised.', 401);
    }

    const result = await runBackup('scheduled');
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error, 'The backup could not be completed.');
  }
}
