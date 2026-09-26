import { requireAdmin } from '@/lib/auth/admin';
import { holidayInputSchema } from '@/lib/validation/schemas';
import { AppError, describeDbError, handleRouteError, jsonOk, readJson } from '@/lib/http';

export const runtime = 'nodejs';

const COLUMNS =
  'id, title, note, recurrence, weekday, bs_day, start_date, end_date, is_active, created_at, updated_at';

/** Maps the form's shape onto the table's column names. */
function toRow(input: ReturnType<typeof holidayInputSchema.parse>) {
  return {
    title: input.title,
    note: input.note,
    recurrence: input.recurrence,
    // Each recurrence type uses only its own field; the others must be null or
    // the table's shape constraint rejects the row.
    weekday: input.recurrence === 'weekly' ? input.weekday : null,
    bs_day: input.recurrence === 'monthly' ? input.bsDay : null,
    start_date: input.startDate,
    end_date: input.endDate,
    is_active: input.isActive,
  };
}

/** GET /api/admin/holidays — every rule, newest last. */
export async function GET() {
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase
      .from('holidays')
      .select(COLUMNS)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw new AppError(describeDbError(error), 500);
    return jsonOk({ holidays: data ?? [] });
  } catch (error) {
    return handleRouteError(error, 'Unable to load holidays.');
  }
}

/** POST /api/admin/holidays — add a rule. */
export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const input = holidayInputSchema.parse(await readJson(request));

    const { data, error } = await supabase
      .from('holidays')
      .insert(toRow(input))
      .select(COLUMNS)
      .single();

    if (error) throw new AppError(describeDbError(error), 500);
    return jsonOk({ holiday: data }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'The holiday could not be saved.');
  }
}
