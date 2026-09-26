import ExcelJS from 'exceljs';
import type { AttendanceReportRow } from '@/types/attendance';
import { totalsFromRows } from '@/lib/attendance/summary';

const NAVY = 'FF1E3A5F';
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = HEADER_FONT;
  row.alignment = { vertical: 'middle', horizontal: 'left' };
  row.height = 22;
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
  });
}

function autoFitColumns(sheet: ExcelJS.Worksheet, minWidths: number[]) {
  sheet.columns.forEach((column, index) => {
    let longest = minWidths[index] ?? 12;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const length = String(cell.value ?? '').length + 2;
      if (length > longest) longest = length;
    });
    column.width = Math.min(longest, 48);
  });
}

function addAttendanceSheet(workbook: ExcelJS.Workbook, rows: AttendanceReportRow[], name = 'Attendance') {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = [
    { header: 'Computer Code', key: 'computerCode' },
    { header: 'Employee Name', key: 'fullName' },
    { header: 'Date', key: 'date' },
    { header: 'Day', key: 'day' },
    { header: 'Status', key: 'status' },
    { header: 'Remark', key: 'remark' },
  ];
  styleHeaderRow(sheet.getRow(1));
  rows.forEach((row) => sheet.addRow(row));
  sheet.autoFilter = { from: 'A1', to: 'F1' };
  autoFitColumns(sheet, [16, 24, 12, 12, 12, 30]);
  return sheet;
}

/** Single-employee attendance export. */
export async function buildAttendanceWorkbook(
  rows: AttendanceReportRow[],
  meta: {
    employeeName: string;
    computerCode: string;
    rank?: string | null;
    department?: string | null;
    periodLabel: string;
  },
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Attendance Management System';
  workbook.created = new Date();

  const info = workbook.addWorksheet('Report Info');
  info.columns = [{ header: 'Field', key: 'field' }, { header: 'Value', key: 'value' }];
  styleHeaderRow(info.getRow(1));
  const totals = totalsFromRows(rows);
  [
    ['Employee Name', meta.employeeName],
    ['Computer Code', meta.computerCode],
    ['Rank', meta.rank ?? '—'],
    ['Type of staff', meta.department ?? '—'],
    ['Period', meta.periodLabel],
    ['Total Present', String(totals.present)],
    ['Total Absent', String(totals.absent)],
    ['Not Marked', String(totals.notMarked)],
    ['Attendance Rate', `${totals.attendanceRate}%`],
  ].forEach(([field, value]) => info.addRow({ field, value }));
  autoFitColumns(info, [20, 28]);

  addAttendanceSheet(workbook, rows);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export interface FullExportEmployee {
  computer_code: string;
  full_name: string;
  rank: string | null;
  department: string | null;
  office: string | null;
}

/** Admin "export everything" workbook: Employees + Attendance + Summary sheets. */
export async function buildFullExportWorkbook(input: {
  employees: FullExportEmployee[];
  rows: AttendanceReportRow[];
  periodLabel: string;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Attendance Management System';
  workbook.created = new Date();

  const employeesSheet = workbook.addWorksheet('Employees', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  employeesSheet.columns = [
    { header: 'Computer Code', key: 'computer_code' },
    { header: 'Name', key: 'full_name' },
    { header: 'Rank', key: 'rank' },
    { header: 'Type of staff', key: 'department' },
    { header: 'दरबन्दी', key: 'office' },
  ];
  styleHeaderRow(employeesSheet.getRow(1));
  input.employees.forEach((employee) => employeesSheet.addRow(employee));
  autoFitColumns(employeesSheet, [16, 24, 16, 20, 20]);

  addAttendanceSheet(workbook, input.rows);

  // Summary: one line per employee.
  const summarySheet = workbook.addWorksheet('Summary', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  summarySheet.columns = [
    { header: 'Computer Code', key: 'code' },
    { header: 'Employee', key: 'employee' },
    { header: 'Present', key: 'present' },
    { header: 'Absent', key: 'absent' },
    { header: 'Attendance %', key: 'rate' },
  ];
  styleHeaderRow(summarySheet.getRow(1));

  const grouped = new Map<string, AttendanceReportRow[]>();
  for (const row of input.rows) {
    const bucket = grouped.get(row.computerCode);
    if (bucket) bucket.push(row);
    else grouped.set(row.computerCode, [row]);
  }
  for (const [code, employeeRows] of grouped) {
    const totals = totalsFromRows(employeeRows);
    summarySheet.addRow({
      code,
      employee: employeeRows[0]?.fullName ?? '',
      present: totals.present,
      absent: totals.absent,
      rate: `${totals.attendanceRate}%`,
    });
  }
  autoFitColumns(summarySheet, [16, 24, 10, 10, 14]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function escapeCsv(value: string): string {
  // A leading =, +, - or @ can be executed as a formula by spreadsheet apps.
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function rowsToCsv(rows: AttendanceReportRow[]): string {
  const header = ['Computer Code', 'Employee Name', 'Date', 'Day', 'Status', 'Remark'];
  const lines = [header.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(
      [row.computerCode, row.fullName, row.date, row.day, row.status, row.remark]
        .map((value) => escapeCsv(String(value ?? '')))
        .join(','),
    );
  }
  // BOM so Excel opens UTF-8 (e.g. Devanagari names) correctly.
  return `﻿${lines.join('\r\n')}`;
}
