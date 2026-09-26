import ExcelJS from 'exceljs';
import { STAFF_TYPES } from '@/lib/config';

/** The दरबन्दी shown on both example rows of the blank template. */
export const TEMPLATE_DARBANDI = 'मधेश प्रदेश प्रहरी तालिम केन्द्र - सप्तरी';

/**
 * Builds the blank staff-import template.
 *
 * Kept out of the route handler so the exact bytes an admin downloads can also
 * be produced by a script or a test, without going through the admin session.
 * A template that cannot be checked without logging in is a template nobody
 * checks.
 */
export function buildStaffTemplate(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Attendance Management System';

  const sheet = workbook.addWorksheet('Staff');
  sheet.columns = [
    { header: 'Computer Code', key: 'code', width: 16 },
    { header: 'Name', key: 'name', width: 26 },
    { header: 'Rank', key: 'rank', width: 18 },
    { header: 'Type of staff', key: 'type', width: 22 },
    // Wide enough for the full office name without clipping: the example
    // value alone is 41 characters, and a cut-off दरबन्दी is the one column
    // people copy their own wording from.
    { header: 'दरबन्दी', key: 'darbandi', width: 44 },
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
    darbandi: TEMPLATE_DARBANDI,
    phone: '9800000000',
  });
  sheet.addRow({
    code: '494617',
    name: 'राम बहादुर श्रेष्ठ',
    rank: 'ASI',
    type: STAFF_TYPES[1],
    darbandi: TEMPLATE_DARBANDI,
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

  return workbook;
}
