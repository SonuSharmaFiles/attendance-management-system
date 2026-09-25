import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AttendanceReportRow } from '@/types/attendance';
import { totalsFromRows } from '@/lib/attendance/summary';

const NAVY: [number, number, number] = [30, 58, 95];
const GREEN: [number, number, number] = [21, 128, 61];
const RED: [number, number, number] = [185, 28, 28];
const GRAY: [number, number, number] = [107, 114, 128];

export interface PdfReportMeta {
  organisationName: string;
  employeeName: string;
  computerCode: string;
  rank?: string | null;
  department?: string | null;
  periodLabel: string;
}

/** Renders a printable attendance report and returns the raw PDF bytes. */
export function buildAttendancePdf(rows: AttendanceReportRow[], meta: PdfReportMeta): Buffer {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // --- Header band ---------------------------------------------------------
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 72, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Attendance Report', margin, 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(meta.organisationName, margin, 54);

  // --- Employee details ----------------------------------------------------
  doc.setTextColor(17, 24, 39);
  let cursorY = 104;
  const detail = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${label}:`, margin, cursorY);
    doc.setFont('helvetica', 'normal');
    doc.text(value || '—', margin + 90, cursorY);
    cursorY += 16;
  };
  detail('Name', meta.employeeName);
  detail('Computer Code', meta.computerCode);
  detail('Rank', meta.rank ?? '—');
  detail('Department', meta.department ?? '—');
  detail('Period', meta.periodLabel);

  // --- Table ---------------------------------------------------------------
  autoTable(doc, {
    startY: cursorY + 10,
    margin: { left: margin, right: margin },
    head: [['Date', 'Day', 'Status', 'Remark']],
    body: rows.map((row) => [row.date, row.day, row.status, row.remark]),
    styles: { fontSize: 9, cellPadding: 5, overflow: 'linebreak' },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 80 },
      2: { cellWidth: 70 },
      3: { cellWidth: 'auto' },
    },
    didParseCell(data) {
      if (data.section !== 'body' || data.column.index !== 2) return;
      const value = String(data.cell.raw ?? '');
      if (value === 'Present') data.cell.styles.textColor = GREEN;
      else if (value === 'Absent') data.cell.styles.textColor = RED;
      else data.cell.styles.textColor = GRAY;
      data.cell.styles.fontStyle = 'bold';
    },
  });

  // --- Totals --------------------------------------------------------------
  const totals = totalsFromRows(rows);
  const afterTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  let summaryY = (afterTable?.finalY ?? cursorY) + 28;

  if (summaryY > doc.internal.pageSize.getHeight() - 110) {
    doc.addPage();
    summaryY = 60;
  }

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(247, 249, 252);
  doc.roundedRect(margin, summaryY - 20, pageWidth - margin * 2, 86, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text('Summary', margin + 16, summaryY);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(17, 24, 39);
  doc.text(`Total Present: ${totals.present}`, margin + 16, summaryY + 22);
  doc.text(`Total Absent: ${totals.absent}`, margin + 16, summaryY + 40);
  doc.text(`Not Marked: ${totals.notMarked}`, margin + 220, summaryY + 22);
  doc.text(`Attendance Rate: ${totals.attendanceRate}%`, margin + 220, summaryY + 40);

  // --- Footer on every page ------------------------------------------------
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(
      `Generated ${new Date().toISOString().slice(0, 10)}`,
      margin,
      doc.internal.pageSize.getHeight() - 24,
    );
    doc.text(
      `Page ${page} of ${pageCount}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 24,
      { align: 'right' },
    );
  }

  return Buffer.from(doc.output('arraybuffer'));
}
