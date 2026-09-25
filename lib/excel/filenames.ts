import { monthLabel, yearMonthToInput, type YearMonth } from '@/lib/date/nepal';

const EXTENSIONS = { xlsx: 'xlsx', csv: 'csv', pdf: 'pdf' } as const;
export type ExportFormat = keyof typeof EXTENSIONS;

export const CONTENT_TYPES: Record<ExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
  pdf: 'application/pdf',
};

/**
 * attendance-NP12345-2026-09.xlsx            (single month)
 * attendance-NP12345-2026-01-to-2026-09.xlsx (range)
 */
export function attendanceFilename(
  computerCode: string,
  from: YearMonth,
  to: YearMonth,
  format: ExportFormat,
): string {
  const fromLabel = yearMonthToInput(from);
  const toLabel = yearMonthToInput(to);
  const period = fromLabel === toLabel ? fromLabel : `${fromLabel}-to-${toLabel}`;
  const safeCode = computerCode.replace(/[^A-Za-z0-9._-]/g, '');
  return `attendance-${safeCode}-${period}.${EXTENSIONS[format]}`;
}

export function fullExportFilename(from: YearMonth, to: YearMonth, format: ExportFormat): string {
  const fromLabel = yearMonthToInput(from);
  const toLabel = yearMonthToInput(to);
  const period = fromLabel === toLabel ? fromLabel : `${fromLabel}-to-${toLabel}`;
  return `attendance-all-employees-${period}.${EXTENSIONS[format]}`;
}

export function periodLabel(from: YearMonth, to: YearMonth): string {
  const fromLabel = monthLabel(from);
  const toLabel = monthLabel(to);
  return fromLabel === toLabel ? fromLabel : `${fromLabel} — ${toLabel}`;
}
