import type { Metadata } from 'next';
import { ImportWizard } from '@/components/admin/ImportWizard';

export const metadata: Metadata = { title: 'Import Employees' };
export const dynamic = 'force-dynamic';

export default function AdminImportPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">Import Staff from Excel</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload your existing staff spreadsheet. Nothing is saved until you confirm the preview.
        </p>
      </div>

      <ImportWizard />
    </div>
  );
}
