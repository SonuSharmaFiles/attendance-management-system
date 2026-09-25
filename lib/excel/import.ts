import ExcelJS from 'exceljs';
import { AppError } from '@/lib/errors';
import { employeeInputSchema } from '@/lib/validation/schemas';
import type { EmployeeImportRow, ImportPreview, ImportPreviewRow } from '@/types/employee';

/**
 * Reads an employee spreadsheet and reports exactly what an import would do,
 * without writing anything. The admin confirms the preview before any row is
 * saved.
 */

/** Header aliases, so slightly different spreadsheets still import cleanly. */
const COLUMN_ALIASES: Record<keyof EmployeeImportRow, string[]> = {
  computer_code: ['computer code', 'computercode', 'code', 'comp code', 'computer_code'],
  full_name: ['name', 'full name', 'employee name', 'fullname', 'full_name'],
  rank: ['rank', 'post', 'designation'],
  department: ['department', 'dept', 'branch'],
  office: ['office', 'unit', 'station'],
  phone: ['phone', 'mobile', 'contact', 'phone number'],
  email: ['email', 'e-mail', 'email address'],
};

const REQUIRED_COLUMNS: (keyof EmployeeImportRow)[] = ['computer_code', 'full_name'];

function normaliseHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    if ('result' in value) return String(value.result ?? '').trim();
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim();
    }
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function mapColumns(headerRow: ExcelJS.Row): Partial<Record<keyof EmployeeImportRow, number>> {
  const mapping: Partial<Record<keyof EmployeeImportRow, number>> = {};
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = normaliseHeader(cell.value);
    if (!header) return;
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [
      keyof EmployeeImportRow,
      string[],
    ][]) {
      if (mapping[field] === undefined && aliases.includes(header)) {
        mapping[field] = colNumber;
      }
    }
  });
  return mapping;
}

export async function parseEmployeeWorkbook(buffer: ArrayBuffer): Promise<{
  rows: EmployeeImportRow[];
  issues: Map<number, string[]>;
  order: number[];
}> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new AppError('That file could not be read. Please upload a valid .xlsx or .xls file.', 422);
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    throw new AppError('The spreadsheet is empty. Add a header row and at least one employee.', 422);
  }

  const mapping = mapColumns(sheet.getRow(1));
  const missing = REQUIRED_COLUMNS.filter((field) => mapping[field] === undefined);
  if (missing.length > 0) {
    const names = missing.map((field) => (field === 'computer_code' ? 'Computer Code' : 'Name'));
    throw new AppError(
      `The spreadsheet is missing required column(s): ${names.join(', ')}. Expected headers are Computer Code, Name, Rank, Department, Office, Phone, Email.`,
      422,
    );
  }

  const read = (row: ExcelJS.Row, field: keyof EmployeeImportRow): string => {
    const column = mapping[field];
    if (column === undefined) return '';
    return cellText(row.getCell(column));
  };

  const rows: EmployeeImportRow[] = [];
  const order: number[] = [];
  const issues = new Map<number, string[]>();

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const code = read(row, 'computer_code');
    const name = read(row, 'full_name');

    // Skip completely blank lines rather than reporting them as errors.
    if (!code && !name) continue;

    rows.push({
      computer_code: code,
      full_name: name,
      rank: read(row, 'rank') || null,
      department: read(row, 'department') || null,
      office: read(row, 'office') || null,
      phone: read(row, 'phone') || null,
      email: read(row, 'email') || null,
    });
    order.push(rowNumber);
  }

  if (rows.length === 0) {
    throw new AppError('No employee rows were found in the spreadsheet.', 422);
  }

  return { rows, issues, order };
}

/**
 * Validates every parsed row and classifies it against the codes already in the
 * database. `existingCodes` is supplied by the caller so this stays pure.
 */
export function buildImportPreview(
  parsed: { rows: EmployeeImportRow[]; order: number[] },
  existingCodes: Set<string>,
): ImportPreview {
  const seenInFile = new Set<string>();
  const previewRows: ImportPreviewRow[] = [];

  parsed.rows.forEach((raw, index) => {
    const rowNumber = parsed.order[index] ?? index + 2;
    const result = employeeInputSchema.safeParse({ ...raw, is_active: true });

    if (!result.success) {
      previewRows.push({
        rowNumber,
        outcome: 'invalid',
        errors: result.error.issues.map((issue) => issue.message),
        data: raw,
      });
      return;
    }

    const clean: EmployeeImportRow = {
      computer_code: result.data.computer_code,
      full_name: result.data.full_name,
      rank: result.data.rank,
      department: result.data.department,
      office: result.data.office,
      phone: result.data.phone,
      email: result.data.email,
    };

    if (seenInFile.has(clean.computer_code)) {
      previewRows.push({
        rowNumber,
        outcome: 'duplicate',
        errors: [`Computer code ${clean.computer_code} appears more than once in this file.`],
        data: clean,
      });
      return;
    }
    seenInFile.add(clean.computer_code);

    previewRows.push({
      rowNumber,
      outcome: existingCodes.has(clean.computer_code) ? 'update' : 'new',
      errors: [],
      data: clean,
    });
  });

  return {
    rows: previewRows,
    summary: {
      totalRows: previewRows.length,
      newEmployees: previewRows.filter((row) => row.outcome === 'new').length,
      updatedEmployees: previewRows.filter((row) => row.outcome === 'update').length,
      duplicateCodes: previewRows.filter((row) => row.outcome === 'duplicate').length,
      invalidRows: previewRows.filter((row) => row.outcome === 'invalid').length,
    },
  };
}
