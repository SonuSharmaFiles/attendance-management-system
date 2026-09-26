import ExcelJS from 'exceljs';
import { BS_MONTHS_NEPALI, bsDaysInMonth, fromBs } from '@/lib/date/bikram';
import { dayOfWeek, parseDateStr, WEEKDAY_SHORT, type DateStr } from '@/lib/date/nepal';
import type { AttendanceStatus, CalendarHoliday } from '@/types/attendance';

/**
 * The year grid: one row per staff member, one column per day of a Bikram
 * Sambat year, grouped under merged Devanagari month headings.
 *
 * Three header rows:
 *   1  merged month name          बैशाख … चैत
 *   2  day of the Nepali month    1 … 31 (BS months run 29-32 days)
 *   3  weekday                    Sun Mon … continuous across month ends
 *
 * Cells hold a single letter so a whole year stays readable on screen. The
 * holiday's own name is not lost: it is attached as a cell note and listed on
 * the Key sheet.
 */

export interface GridStaff {
  id: string;
  computer_code: string;
  full_name: string;
}

export interface GridInput {
  bsYear: number;
  staff: GridStaff[];
  /** Keyed `${employeeId}|${date}`. */
  attendance: Map<string, { status: AttendanceStatus; remark: string | null }>;
  holidays: Map<DateStr, CalendarHoliday>;
  /** Days after this are left blank rather than guessed at. */
  today: DateStr;
}

interface DayColumn {
  month: number;
  bsDay: number;
  date: DateStr;
  weekday: number;
}

const NAVY_ODD = 'FF1E3A5F';
const NAVY_EVEN = 'FF2B4878';
const FILL = { P: 'FFDCFCE7', A: 'FFFEE2E2', H: 'FFF1F5F9' } as const;
const INK = { P: 'FF14532D', A: 'FF7F1D1D', H: 'FF64748B' } as const;

function buildColumns(bsYear: number): DayColumn[] {
  const columns: DayColumn[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const total = bsDaysInMonth({ year: bsYear, month });
    for (let bsDay = 1; bsDay <= total; bsDay += 1) {
      const date = fromBs({ year: bsYear, month, day: bsDay });
      const { year, month: gMonth, day } = parseDateStr(date);
      columns.push({ month, bsDay, date, weekday: dayOfWeek(year, gMonth, day) });
    }
  }
  return columns;
}

export async function buildYearGridWorkbook(input: GridInput): Promise<Buffer> {
  const { bsYear, staff, attendance, holidays, today } = input;
  const columns = buildColumns(bsYear);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Attendance Management System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`${bsYear}`, {
    // Code and Name stay on screen while scrolling across the year.
    views: [{ state: 'frozen', xSplit: 2, ySplit: 3 }],
  });

  sheet.addRow(['', '', ...columns.map(() => '')]);
  sheet.addRow(['Code', 'Name', ...columns.map((c) => c.bsDay)]);
  sheet.addRow(['', '', ...columns.map((c) => WEEKDAY_SHORT[c.weekday])]);

  // Merge each month across exactly its own number of days.
  let at = 3;
  for (let month = 1; month <= 12; month += 1) {
    const span = bsDaysInMonth({ year: bsYear, month });
    sheet.mergeCells(1, at, 1, at + span - 1);
    const cell = sheet.getCell(1, at);
    cell.value = BS_MONTHS_NEPALI[month - 1];
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: month % 2 ? NAVY_ODD : NAVY_EVEN },
    };
    cell.border = { left: { style: 'medium' }, right: { style: 'medium' } };
    at += span;
  }

  for (const person of staff) {
    const row: (string | number)[] = [person.computer_code, person.full_name];
    for (const column of columns) {
      const record = attendance.get(`${person.id}|${column.date}`);
      const holiday = holidays.get(column.date);

      if (record) row.push(record.status === 'present' ? 'P' : 'A');
      else if (holiday) row.push('H');
      else if (column.date > today) row.push('');
      else row.push('');
    }
    sheet.addRow(row);
  }

  // --- Formatting ---------------------------------------------------------
  sheet.getRow(1).height = 22;
  sheet.getRow(2).font = { bold: true, size: 10 };
  sheet.getRow(3).font = { size: 8, color: { argb: 'FF64748B' } };

  for (const rowNumber of [2, 3]) {
    const row = sheet.getRow(rowNumber);
    row.alignment = { horizontal: 'center' };
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = { bottom: { style: 'thin' }, right: { style: 'hair' } };
    });
  }

  staff.forEach((_, index) => {
    const row = sheet.getRow(4 + index);
    row.height = 17;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.border = { right: { style: 'hair' }, bottom: { style: 'hair' } };

      if (columnNumber <= 2) {
        cell.font = { bold: columnNumber === 1, size: 10 };
        cell.alignment = { horizontal: columnNumber === 1 ? 'center' : 'left' };
        return;
      }

      const column = columns[columnNumber - 3];
      const letter = String(cell.value ?? '') as 'P' | 'A' | 'H' | '';
      cell.alignment = { horizontal: 'center', vertical: 'middle' };

      if (letter === 'P' || letter === 'A' || letter === 'H') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[letter] } };
        cell.font = { size: 9, bold: letter !== 'H', color: { argb: INK[letter] } };
      } else {
        cell.font = { size: 9 };
      }

      // The holiday's name survives as a hover note, so the grid stays narrow
      // without throwing the information away.
      const holiday = column && holidays.get(column.date);
      if (holiday) cell.note = holiday.title;
    });
  });

  sheet.getColumn(1).width = 11;
  sheet.getColumn(2).width = 22;
  for (let c = 3; c <= columns.length + 2; c += 1) sheet.getColumn(c).width = 3.4;

  // --- Key sheet ----------------------------------------------------------
  const key = workbook.addWorksheet('Key');
  key.columns = [
    { header: 'Symbol', key: 'symbol', width: 12 },
    { header: 'Meaning', key: 'meaning', width: 46 },
  ];
  key.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  key.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_ODD } };
  });
  [
    ['P', 'Present'],
    ['A', 'Absent'],
    ['H', 'Holiday — hover the cell to see which holiday'],
    ['(blank)', 'Not marked, or the day has not happened yet'],
  ].forEach(([symbol, meaning]) => key.addRow({ symbol, meaning }));

  key.addRow({});
  const heading = key.addRow({ symbol: 'Holidays', meaning: `Bikram Sambat ${bsYear}` });
  heading.font = { bold: true };

  const seen = new Set<string>();
  for (const column of columns) {
    const holiday = holidays.get(column.date);
    if (!holiday) continue;
    const label = `${BS_MONTHS_NEPALI[column.month - 1]} ${column.bsDay}`;
    const rowKey = `${label}|${holiday.title}`;
    if (seen.has(rowKey)) continue;
    seen.add(rowKey);
    key.addRow({ symbol: label, meaning: holiday.title });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
