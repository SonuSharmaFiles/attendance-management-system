import { requireAdmin } from '@/lib/auth/admin';
import { buildImportPreview, parseEmployeeWorkbook } from '@/lib/excel/import';
import { AppError, describeDbError, handleRouteError, jsonOk } from '@/lib/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/admin/employees/import/preview
 * Parses the spreadsheet and reports what WOULD happen. Writes nothing.
 */
export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin();

    const formData = await request.formData().catch(() => null);
    const file = formData?.get('file');
    if (!(file instanceof File)) {
      throw new AppError('Please choose an .xlsx or .xls file to import.', 422);
    }
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      throw new AppError('Only .xlsx and .xls files can be imported.', 422);
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new AppError('That file is larger than 10 MB. Please split it into smaller files.', 422);
    }

    const parsed = await parseEmployeeWorkbook(await file.arrayBuffer());

    const { data, error } = await supabase.from('employees').select('computer_code');
    if (error) throw new AppError(describeDbError(error), 500);

    const existingCodes = new Set((data ?? []).map((row) => row.computer_code as string));
    const preview = buildImportPreview(parsed, existingCodes);

    return jsonOk(preview);
  } catch (error) {
    return handleRouteError(error, 'The spreadsheet could not be read.');
  }
}
