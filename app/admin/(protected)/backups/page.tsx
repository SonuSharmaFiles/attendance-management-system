import type { Metadata } from 'next';
import { BackupManager } from '@/components/admin/BackupManager';

export const metadata: Metadata = { title: 'Backups' };
export const dynamic = 'force-dynamic';

export default function AdminBackupsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">Backups</h1>
        <p className="mt-1 text-sm text-slate-600">
          Automatic monthly copies of every staff member&apos;s attendance, as Excel files.
        </p>
      </div>

      <BackupManager />
    </div>
  );
}
