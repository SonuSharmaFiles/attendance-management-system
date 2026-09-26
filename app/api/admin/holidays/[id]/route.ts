import { requireAdmin } from '@/lib/auth/admin';
import { holidayInputSchema } from '@/lib/validation/schemas';
import { AppError, describeDbError, handleRouteError, jsonOk, readJson } from '@/lib/http';
import { z } from 'zod';

export const runtime = 'nodejs';

const COLUMNS =
  'id, title, note, recurrence, weekday, bs_day, start_date, end_date, is_active, created_at, updated_at';

type Context = { params: Promise<{ id: string }> };

/** PATCH — edit a rule, or just switch it on/off. */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const { supabase } = await requireAdmin();
    const { id } = await params;
    const body = await readJson(request);

    // A bare {isActive} toggle is allowed without re-sending the whole rule.
    const toggle = z.object({ isActive: z.boolean() }).strict().safeParse(body);
    const payload = toggle.success
      ? { is_active: toggle.data.isActive }
      : (() => {
          const input = holidayInputSchema.parse(body);
          return {
            title: input.title,
            note: input.note,
            recurrence: input.recurrence,
            weekday: input.recurrence === 'weekly' ? input.weekday : null,
            bs_day: input.recurrence === 'monthly' ? input.bsDay : null,
            start_date: input.startDate,
            end_date: input.endDate,
            is_active: input.isActive,
          };
        })();

    const { data, error } = await supabase
      .from('holidays')
      .update(payload)
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();

    if (error) throw new AppError(describeDbError(error), 500);
    if (!data) throw new AppError('Holiday not found.', 404);

    return jsonOk({ holiday: data });
  } catch (error) {
    return handleRouteError(error, 'The holiday could not be updated.');
  }
}

/** DELETE — remove a rule entirely. Attendance records are untouched. */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { supabase } = await requireAdmin();
    const { id } = await params;

    const { error } = await supabase.from('holidays').delete().eq('id', id);
    if (error) throw new AppError(describeDbError(error), 500);

    return jsonOk({ deleted: true });
  } catch (error) {
    return handleRouteError(error, 'The holiday could not be removed.');
  }
}
