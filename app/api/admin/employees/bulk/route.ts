import { requireAdmin } from '@/lib/auth/admin';
import { employeeBulkUpdateSchema } from '@/lib/validation/schemas';
import { AppError, describeDbError, handleRouteError, jsonOk, readJson } from '@/lib/http';

export const runtime = 'nodejs';

/**
 * PATCH /api/admin/employees/bulk
 *
 * Applies one set of changes — rank, type of staff, active or not — to every
 * staff member whose id is listed. Used by the tick boxes on the staff list,
 * where an admin re-ranks or reassigns a group of people in one go.
 *
 * Deactivating here is the same soft removal as DELETE on a single employee:
 * the record and all of its attendance are kept, the person just leaves the
 * active list.
 */
export async function PATCH(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const { ids, ...changes } = employeeBulkUpdateSchema.parse(await readJson(request));

    const { data, error } = await supabase
      .from('employees')
      .update(changes)
      .in('id', ids)
      .select('id');

    if (error) throw new AppError(describeDbError(error), 500);

    const updated = data?.length ?? 0;
    // Nothing matched: every id was already gone. Say so rather than reporting
    // a cheerful "0 changed", which reads like success.
    if (updated === 0) {
      throw new AppError('None of the selected staff could be found.', 404);
    }

    return jsonOk({ updated, requested: ids.length });
  } catch (error) {
    return handleRouteError(error, 'The changes could not be saved.');
  }
}
