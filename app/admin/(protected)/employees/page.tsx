import type { Metadata } from 'next';
import Link from 'next/link';
import { Upload } from 'lucide-react';
import { EmployeeManager } from '@/components/admin/EmployeeManager';

export const metadata: Metadata = { title: 'Staff' };
export const dynamic = 'force-dynamic';

export default function AdminEmployeesPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">Staff Management</h1>
          <p className="mt-1 text-sm text-slate-600">
            Add, edit, photograph and deactivate staff records.
          </p>
        </div>
        <Link
          href="/admin/employees/import"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-navy-800 hover:bg-slate-50"
        >
          <Upload aria-hidden className="h-4 w-4" />
          Import from Excel
        </Link>
      </div>

      <EmployeeManager />
    </div>
  );
}
