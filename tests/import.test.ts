import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { buildImportPreview, parseEmployeeWorkbook } from '@/lib/excel/import';
import { sniffImageType } from '@/lib/employees/photos';

/** Builds a real .xlsx in memory so the parser is exercised end to end. */
async function makeWorkbook(rows: (string | number | null)[][], headers: string[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Employees');
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

const HEADERS = ['Computer Code', 'Name', 'Rank', 'Department', 'Office', 'Phone', 'Email'];

describe('Excel import', () => {
  it('reads a well-formed sheet', async () => {
    const buffer = await makeWorkbook(
      [
        ['NP10001', 'Demo One', 'Inspector', 'Demo Dept', 'Demo Office', '9800000001', 'one@example.com'],
        ['NP10002', 'Demo Two', 'Constable', 'Demo Dept', null, null, null],
      ],
      HEADERS,
    );

    const parsed = await parseEmployeeWorkbook(buffer);
    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.rows[0].computer_code, 'NP10001');
    assert.equal(parsed.rows[0].full_name, 'Demo One');
    assert.equal(parsed.rows[1].office, null);
  });

  it('accepts alternative header spellings', async () => {
    const buffer = await makeWorkbook(
      [['NP10001', 'Demo One', 'Inspector', 'Demo Dept']],
      ['code', 'Full Name', 'Designation', 'Dept'],
    );

    const parsed = await parseEmployeeWorkbook(buffer);
    assert.equal(parsed.rows[0].computer_code, 'NP10001');
    assert.equal(parsed.rows[0].rank, 'Inspector');
    assert.equal(parsed.rows[0].department, 'Demo Dept');
  });

  it('refuses a sheet that is missing a required column', async () => {
    const buffer = await makeWorkbook([['Inspector', 'Demo Dept']], ['Rank', 'Department']);
    await assert.rejects(() => parseEmployeeWorkbook(buffer), /missing required column/i);
  });

  it('refuses an empty sheet', async () => {
    const buffer = await makeWorkbook([], HEADERS);
    await assert.rejects(() => parseEmployeeWorkbook(buffer), /empty|No employee rows/i);
  });

  it('refuses a file that is not a spreadsheet', async () => {
    const notAWorkbook = new TextEncoder().encode('this is not xlsx').buffer;
    await assert.rejects(() => parseEmployeeWorkbook(notAWorkbook), /could not be read/i);
  });

  it('skips blank lines instead of reporting them as errors', async () => {
    const buffer = await makeWorkbook(
      [['NP10001', 'Demo One'], [null, null], ['NP10002', 'Demo Two']],
      HEADERS,
    );
    const parsed = await parseEmployeeWorkbook(buffer);
    assert.equal(parsed.rows.length, 2);
  });
});

describe('import preview classification', () => {
  const parsed = {
    order: [2, 3, 4, 5, 6],
    rows: [
      { computer_code: 'NP10001', full_name: 'New Person', rank: null, department: null, office: null, phone: null, email: null },
      { computer_code: 'NP20002', full_name: 'Existing Person', rank: null, department: null, office: null, phone: null, email: null },
      { computer_code: 'NP10001', full_name: 'Repeat In File', rank: null, department: null, office: null, phone: null, email: null },
      { computer_code: 'X', full_name: 'Bad Code', rank: null, department: null, office: null, phone: null, email: null },
      { computer_code: 'NP30003', full_name: '', rank: null, department: null, office: null, phone: null, email: null },
    ],
  };

  const preview = buildImportPreview(parsed, new Set(['NP20002']));

  it('summarises new, updated, duplicate and invalid rows', () => {
    assert.deepEqual(preview.summary, {
      totalRows: 5,
      newEmployees: 1,
      updatedEmployees: 1,
      duplicateCodes: 1,
      invalidRows: 2,
    });
  });

  it('marks an existing computer code as an update, not a new record', () => {
    const row = preview.rows.find((entry) => entry.data.computer_code === 'NP20002');
    assert.equal(row?.outcome, 'update');
  });

  it('flags a code repeated inside the file as a duplicate', () => {
    const duplicates = preview.rows.filter((entry) => entry.outcome === 'duplicate');
    assert.equal(duplicates.length, 1);
    assert.match(duplicates[0].errors[0], /more than once/);
  });

  it('keeps the original row numbers so errors can be found in the sheet', () => {
    assert.deepEqual(preview.rows.map((entry) => entry.rowNumber), [2, 3, 4, 5, 6]);
  });

  it('normalises codes to upper case on the way in', () => {
    const single = buildImportPreview(
      {
        order: [2],
        rows: [
          { computer_code: 'np99999', full_name: 'Lower Case', rank: null, department: null, office: null, phone: null, email: null },
        ],
      },
      new Set(),
    );
    assert.equal(single.rows[0].data.computer_code, 'NP99999');
  });
});

describe('uploaded image sniffing', () => {
  it('recognises real image headers', () => {
    assert.equal(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/jpeg');
    assert.equal(
      sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])),
      'image/png',
    );
    const webp = new Uint8Array([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')]);
    assert.equal(sniffImageType(webp), 'image/webp');
  });

  it('rejects an executable renamed to .png', () => {
    // "MZ" — the DOS/Windows executable header.
    const executable = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(sniffImageType(executable), null);
  });

  it('rejects a file too short to identify', () => {
    assert.equal(sniffImageType(new Uint8Array([0xff, 0xd8])), null);
  });
});
