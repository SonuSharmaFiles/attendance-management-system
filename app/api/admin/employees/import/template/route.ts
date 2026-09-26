import ExcelJS from 'exceljs';
import { requireAdmin } from '@/lib/auth/admin';
import { handleRouteError } from '@/lib/http';
import { CONTENT_TYPES } from '@/lib/excel/filenames';
import { STAFF_TYPES } from '@/lib/config';

export const runtime = 'nodejs';

/**
 * GET /api/admin/employees/import/template
 *
 * A blank sheet with the right headings in row 1 and two example rows. Handing
 * someone a correct file is a clearer explanation of the format than any
 * paragraph, and it sidesteps the commonest mistake — a title row above the
 * headings, which pushes the real headings to row 2 where the importer will
 * not find them.
 */
export async function GET() {
  try {
    await requireAdmin();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Attendance Management System';

    const sheet = workbook.addWorksheet('Staff');
    sheet.columns = [
      { header: 'Computer Code', key: 'code', width: 16 },
      { header: 'Name', key: 'name', width: 26 },
      { header: 'Rank', key: 'rank', width: 18 },
      { header: 'Type of staff', key: 'type', width: 22 },
      { header: 'दरबन्दी', key: 'darbandi', width: 30 },
      { header: 'Phone', key: 'phone', width: 16 },
    ];

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    header.height = 22;
    header.eachCell((cell, column) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        // The two required columns are a darker navy than the optional ones.
        fgColor: { argb: column <= 2 ? 'FF1E3A5F' : 'FF4573B1' },
      };
      cell.alignment = { vertical: 'middle' };
    });

    sheet.addRow({
      code: '497029',
      name: 'Monu Sharma',
      rank: 'Constable',
      type: STAFF_TYPES[0],
      darbandi: 'मधेश प्रदेश प्रहरी तालिम केन्द्र',
      phone: '9800000000',
    });
    sheet.addRow({
      code: '494617',
      name: 'राम बहादुर श्रेष्ठ',
      rank: 'ASI',
      type: STAFF_TYPES[1],
      darbandi: 'सम्पर्क कार्यालय - सप्तरी',
      phone: '9811111111',
    });

    for (const rowNumber of [2, 3]) {
      sheet.getRow(rowNumber).font = { italic: true, color: { argb: 'FF64748B' } };
    }

    // A dropdown on the Type of staff column, so the two values stay exact.
    // Applied per cell: the sheet-level dataValidations map is not in the
    // published types for this version of ExcelJS.
    for (let rowNumber = 2; rowNumber <= 500; rowNumber += 1) {
      sheet.getCell(`D${rowNumber}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${STAFF_TYPES.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'Type of staff',
        error: `Choose one of: ${STAFF_TYPES.join(' / ')}`,
      };
    }

    const notes = workbook.addWorksheet('How to use');
    notes.columns = [{ header: '', key: 'line', width: 96 }];
    [
      'HOW TO FILL THIS IN',
      '',
      '1.  Delete the two example rows and put your own staff underneath the headings.',
      '2.  Do NOT add a title row above the headings. Row 1 must be the headings.',
      '3.  Computer Code and Name must be filled in. Everything else is optional.',
      '4.  A Computer Code that already exists will UPDATE that person, not duplicate them.',
      '5.  Codes must be 3 to 32 characters: letters, numbers, and . - _ only.',
      '6.  Save as .xlsx or .xls, under 10 MB. Only the first sheet is read.',
      '',
      'TYPE OF STAFF — use one of these exactly:',
      ...STAFF_TYPES.map((type) => `     ${type}`),
      '',
      'Nothing is saved until you check the preview and press Confirm Import.',
    ].forEach((line) => notes.addRow({ line }));
    notes.getRow(1).font = { bold: true, size: 12 };

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
