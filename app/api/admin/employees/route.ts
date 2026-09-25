import { requireAdmin } from '@/lib/auth/admin';
import { employeeInputSchema } from '@/lib/validation/schemas';
import { AppError, describeDbError, handleRouteError, jsonOk, readJson } from '@/lib/http';

export const runtime = 'nodejs';

const COLUMNS =
  'id, computer_code, full_name, rank, department, office, phone, email, profile_photo_url, is_active, created_at, updated_at';

/** GET /api/admin/employees?search=&department=&status=&page= */
export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const url = new URL(request.url);

    const search = url.searchParams.get('search')?.trim() ?? '';
    const department = url.searchParams.get('department')?.trim() ?? '';
    const status = url.searchParams.get('status') ?? 'all';
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get('pageSize') ?? 25) || 25));

    let query = supabase.from('employees').select(COLUMNS, { count: 'exact' });

    if (search) {
      // Escape PostgREST's or() delimiters before interpolating user input.
      const safe = search.replace(/[,()%]/g, ' ').trim();
      if (safe) query = query.or(`computer_code.ilike.%${safe}%,full_name.ilike.%${safe}%`);
    }
    if (department) query = query.eq('department', department);
    if (status === 'active') query = query.eq('is_active', true);
    if (status === 'inactive') query = query.eq('is_active', false);

    const { data, error, count } = await query
      .order('computer_code', { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw new AppError(describeDbError(error), 500);

    return jsonOk({ employees: data ?? [], total: count ?? 0, page, pageSize });
  } catch (error) {
    return handleRouteError(error, 'Unable to load employees.');
  }
}

/** POST /api/admin/employees — add one employee. */
export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const payload = employeeInputSchema.parse(await readJson(request));

    const { data, error } = await supabase.from('employees').insert(payload).select(COLUMNS).single();

    if (error) {
      if (error.code === '23505') {
        throw new AppError(`Computer code ${payload.computer_code} is already in use.`, 409);
      }
      throw new AppError(describeDbError(error), 500);
    }

    return jsonOk({ employee: data }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Unable to add the employee.');
  }
}
