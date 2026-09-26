import { requireAdmin } from '@/lib/auth/admin';
import { handleRouteError } from '@/lib/http';
import { CONTENT_TYPES } from '@/lib/excel/filenames';
import { buildStaffTemplate } from '@/lib/excel/template';

export const runtime = 'nodejs';

/**
 * GET /api/admin/employees/import/template
 *
 * A blank sheet with the right headings in row 1 and two example rows. Handing
 * someone a correct file is a clearer explanation of the format than any
 * paragraph, and it sidesteps the commonest mistake — a title row above the
 * headings, which pushes the real headings to row 2 where the importer will
 * not find them.
 *
 * The workbook itself is built in lib/excel/template.ts.
 */
export async function GET() {
  try {
    await requireAdmin();

    const workbook = buildStaffTemplate();
    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(Buffer.from(buffer) as BodyInit, {
      headers: {
        'Content-Type': CONTENT_TYPES.xlsx,
        'Content-Disposition': 'attachment; filename="staff-import-template.xlsx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleRouteError(error, 'The template could not be created.');
  }
}
