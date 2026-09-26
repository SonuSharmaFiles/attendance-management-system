'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/LoadingState';
import type { ImportPreview, ImportRowOutcome } from '@/types/employee';

const OUTCOME_STYLES: Record<ImportRowOutcome, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-present-soft text-present-ink' },
  update: { label: 'Update', className: 'bg-navy-100 text-navy-800' },
  duplicate: { label: 'Duplicate', className: 'bg-amber-100 text-amber-800' },
  invalid: { label: 'Invalid', className: 'bg-absent-soft text-absent-ink' },
};

/**
 * Two-step import: parse and preview first, write only after confirmation.
 * Duplicate and invalid rows are listed but never sent to the database.
 */
export function ImportWizard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ newEmployees: number; updatedEmployees: number } | null>(null);

  async function handleFile(file: File) {
    setParsing(true);
    setPreview(null);
    setResult(null);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/employees/import/preview', {
        method: 'POST',
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: ImportPreview }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        toast.error(payload && 'error' in payload ? payload.error : 'The file could not be read.');
        setFileName(null);
        return;
      }

      setPreview(payload.data);
      toast.success(`${payload.data.summary.totalRows} rows read. Review the preview below.`);
    } catch {
      toast.error('Unable to reach the server. Please check your connection.');
      setFileName(null);
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleConfirm() {
    if (!preview || importing) return;

    const importable = preview.rows
      .filter((row) => row.outcome === 'new' || row.outcome === 'update')
      .map((row) => ({ ...row.data, is_active: true }));

    if (importable.length === 0) {
      toast.error('There are no valid rows to import.');
      return;
    }

    setImporting(true);
    try {
      const response = await fetch('/api/admin/employees/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: importable }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { newEmployees: number; updatedEmployees: number } }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        toast.error(payload && 'error' in payload ? payload.error : 'The import could not be completed.');
        return;
      }

      setResult(payload.data);
      setPreview(null);
      toast.success('Employees imported successfully.');
    } catch {
      toast.error('Unable to reach the server. Please check your connection.');
    } finally {
      setImporting(false);
    }
  }

  const summary = preview?.summary;
  const importableCount = (summary?.newEmployees ?? 0) + (summary?.updatedEmployees ?? 0);

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h2 className="font-semibold text-navy-900">1. Choose your spreadsheet</h2>
        <p className="mt-1 text-sm text-slate-600">
          Expected column headers:{' '}
          <span className="font-medium text-slate-800">
            Computer Code, Name, Rank, Department, Office, Phone, Email
          </span>
          . Computer Code and Name are required; the rest are optional. Existing codes are updated,
          not duplicated.
        </p>

        <input
          ref={inputRef}
          id="import-file"
          type="file"
          accept=".xlsx,.xls"
          className="sr-only"
          disabled={parsing || importing}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label
            htmlFor="import-file"
            className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-navy-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-700 ${
              parsing || importing ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            <Upload aria-hidden className="h-4 w-4" />
            Choose .xlsx or .xls file
          </label>
          {fileName ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
              <FileSpreadsheet aria-hidden className="h-4 w-4" />
              {fileName}
            </span>
          ) : null}
          {parsing ? <Spinner label="Reading spreadsheet…" /> : null}
        </div>
      </section>

      {result ? (
        <section className="card border-green-200 bg-green-50 p-5" role="status">
          <h2 className="flex items-center gap-2 font-semibold text-present-ink">
            <CheckCircle2 aria-hidden className="h-5 w-5" />
            Import complete
          </h2>
          <p className="mt-1 text-sm text-present-ink">
            {result.newEmployees} new employee{result.newEmployees === 1 ? '' : 's'} added and{' '}
            {result.updatedEmployees} existing record{result.updatedEmployees === 1 ? '' : 's'} updated.
          </p>
        </section>
      ) : null}

      {preview && summary ? (
        <>
          <section className="card p-5">
            <h2 className="font-semibold text-navy-900">2. Review the preview</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ['Total Rows', summary.totalRows, 'text-navy-900'],
                ['New Employees', summary.newEmployees, 'text-present'],
                ['Updated Employees', summary.updatedEmployees, 'text-navy-700'],
                ['Duplicate Codes', summary.duplicateCodes, 'text-amber-600'],
                ['Invalid Rows', summary.invalidRows, 'text-absent'],
              ].map(([label, value, tone]) => (
                <div key={String(label)} className="rounded-xl border border-slate-200 p-3">
                  <dt className="text-xs font-medium text-slate-500">{label}</dt>
                  <dd className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</dd>
                </div>
              ))}
            </dl>

            {summary.duplicateCodes + summary.invalidRows > 0 ? (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                Duplicate and invalid rows are listed below and will be skipped. Fix them in the
                spreadsheet and import again if they are needed.
              </p>
            ) : null}
          </section>

          <section className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Import preview rows</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-3">Row</th>
                  <th scope="col" className="px-3 py-3">Outcome</th>
                  <th scope="col" className="px-3 py-3">Code</th>
                  <th scope="col" className="px-3 py-3">Name</th>
                  <th scope="col" className="px-3 py-3">Type of staff</th>
                  <th scope="col" className="px-3 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.rows.slice(0, 200).map((row) => {
                  const style = OUTCOME_STYLES[row.outcome];
                  return (
                    <tr key={`${row.rowNumber}-${row.data.computer_code}`}>
                      <td className="px-3 py-2.5 tabular-nums text-slate-500">{row.rowNumber}</td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style.className}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{row.data.computer_code || '—'}</td>
                      <td className="px-3 py-2.5">{row.data.full_name || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{row.data.department || '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-absent">{row.errors.join(' ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {preview.rows.length > 200 ? (
              <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                Showing the first 200 of {preview.rows.length} rows. All valid rows will be imported.
              </p>
            ) : null}
          </section>

          <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <h2 className="font-semibold text-navy-900">3. Confirm the import</h2>
              <p className="text-sm text-slate-600">
                {importableCount} row{importableCount === 1 ? '' : 's'} will be written to the database.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPreview(null)} disabled={importing}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} loading={importing} disabled={importableCount === 0}>
                {importing ? 'Importing…' : 'Confirm Import'}
              </Button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
