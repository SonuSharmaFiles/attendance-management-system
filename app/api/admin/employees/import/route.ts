import { requireAdmin } from '@/lib/auth/admin';
import { employeeInputSchema } from '@/lib/validation/schemas';
import { AppError, describeDbError, handleRouteError, jsonOk, readJson } from '@/lib/http';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const confirmSchema = z.object({
  rows: z.array(employeeInputSchema).min(1, 'There are no valid rows to import.').max(5000),
});

const BATCH_SIZE = 500;

/**
 * POST /api/admin/employees/import — commit a previewed import.
 *
 * Upserting on computer_code means an existing employee is UPDATED in place
 * rather than duplicated, which is the behaviour the unique index enforces.
 * Rows are sent in batches so a large sheet does not exceed request limits.
 */
export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const { rows } = confirmSchema.parse(await readJson(request));

    const codes = rows.map((row) => row.computer_code);
    const uniqueCodes = new Set(codes);
    if (uniqueCodes.size !== codes.length) {
      throw new AppError('The import contains duplicate computer codes. Please review and try again.', 422);
    }

    const { data: before, error: beforeError } = await supabase
      .from('employees')
      .select('computer_code')
      .in('computer_code', codes);
    if (beforeError) throw new AppError(describeDbError(beforeError), 500);

    const existing = new Set((before ?? []).map((row) => row.computer_code as string));

    let imported = 0;
    for (let index = 0; index < rows.length; index += BATCH_SIZE) {
      const batch = rows.slice(index, index + BATCH_SIZE);
      const { error } = await supabase
        .from('employees')
        .upsert(batch, { onConflict: 'computer_code' });
      if (error) throw new AppError(describeDbError(error), 500);
      imported += batch.length;
    }

    const updatedEmployees = codes.filter((code) => existing.has(code)).length;

    return jsonOk({
      imported,
      newEmployees: imported - updatedEmployees,
      updatedEmployees,
    });
  } catch (error) {
    return handleRouteError(error, 'The import could not be completed.');
  }
}
