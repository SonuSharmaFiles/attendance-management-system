import { requireAdmin } from '@/lib/auth/admin';
import { employeeUpdateSchema } from '@/lib/validation/schemas';
import { AppError, describeDbError, handleRouteError, jsonOk, readJson } from '@/lib/http';

export const runtime = 'nodejs';

const COLUMNS =
  'id, computer_code, full_name, rank, department, office, phone, email, profile_photo_url, is_active, created_at, updated_at';

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/admin/employees/:id — edit an employee. */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const { supabase } = await requireAdmin();
    const { id } = await params;
    const payload = employeeUpdateSchema.parse(await readJson(request));

    if (Object.keys(payload).length === 0) {
      throw new AppError('There is nothing to update.', 422);
    }

    const { data, error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();

    if (error) {
      if (error.code === '23505') throw new AppError('That computer code is already in use.', 409);
      throw new AppError(describeDbError(error), 500);
    }
    if (!data) throw new AppError('Employee not found.', 404);

    return jsonOk({ employee: data });
  } catch (error) {
    return handleRouteError(error, 'Unable to update the employee.');
  }
}

/**
 * DELETE /api/admin/employees/:id
 * Deactivates by default (attendance history is preserved).
 * `?hard=true` permanently deletes the employee and, by cascade, their attendance.
 */
export async function DELETE(request: Request, { params }: Context) {
  try {
    const { supabase } = await requireAdmin();
    const { id } = await params;
    const hard = new URL(request.url).searchParams.get('hard') === 'true';

    if (hard) {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw new AppError(describeDbError(error), 500);
      return jsonOk({ deleted: true });
    }

    const { data, error } = await supabase
      .from('employees')
      .update({ is_active: false })
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw new AppError(describeDbError(error), 500);
    if (!data) throw new AppError('Employee not found.', 404);

    return jsonOk({ deactivated: true });
  } catch (error) {
    return handleRouteError(error, 'Unable to remove the employee.');
  }
}
