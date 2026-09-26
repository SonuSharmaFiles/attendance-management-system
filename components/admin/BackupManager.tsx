'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Archive, Download, Play, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { TableSkeleton } from '@/components/LoadingState';
import { toNepaliNumber } from '@/lib/date/bikram';

interface BackupRow {
  id: string;
  bs_year: number;
  file_path: string;
  file_size: number;
  staff_count: number;
  record_count: number;
  source: 'scheduled' | 'manual';
  created_at: string;
}

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BackupManager() {
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [day, setDay] = useState(1);
  const [savedDay, setSavedDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [savingDay, setSavingDay] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/backups', { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { backups: BackupRow[]; backupDayOfMonth: number } }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        toast.error(payload && 'error' in payload ? payload.error : 'Unable to load backups.');
        return;
      }
      setBackups(payload.data.backups);
      setDay(payload.data.backupDayOfMonth);
      setSavedDay(payload.data.backupDayOfMonth);
    } catch {
      toast.error('Unable to reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function runNow() {
    if (running) return;
    setRunning(true);
    try {
      const response = await fetch('/api/admin/backups', { method: 'POST' });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { created: boolean; reason?: string; recordCount?: number } }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        toast.error(payload && 'error' in payload ? payload.error : 'The backup failed.');
        return;
      }
      if (!payload.data.created) {
        toast.message(payload.data.reason ?? 'Nothing to back up.');
        return;
      }
      toast.success(`Backup created — ${payload.data.recordCount ?? 0} attendance records saved.`);
      await load();
    } catch {
      toast.error('Unable to reach the server.');
    } finally {
      setRunning(false);
    }
  }

  async function saveDay() {
    if (savingDay) return;
    setSavingDay(true);
    try {
      const response = await fetch('/api/admin/backups', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dayOfMonth: day }),
      });
      if (!response.ok) {
        toast.error('The backup day could not be saved.');
        return;
      }
      setSavedDay(day);
      toast.success(`The robot will now run on day ${day} of each Nepali month.`);
    } finally {
      setSavingDay(false);
    }
  }

  async function download(row: BackupRow) {
    if (downloading) return;
    setDownloading(row.id);
    try {
      const response = await fetch('/api/admin/backups/download', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { url: string } }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        toast.error(payload && 'error' in payload ? payload.error : 'Could not prepare the download.');
        return;
      }
      window.location.href = payload.data.url;
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-4 sm:p-5">
        <div>
          <h2 className="font-semibold text-navy-900">When the robot runs</h2>
          <p className="mt-1 text-sm text-slate-600">
            Once a month, on the day of the Nepali month you choose, the robot saves the whole
            year&apos;s attendance as an Excel file. Files are kept privately — only you can
            download them.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-52">
            <Select
              label="Day of the Nepali month"
              value={String(day)}
              onChange={(event) => setDay(Number(event.target.value))}
              disabled={savingDay}
              hint="Up to 29, so it exists in every Nepali month."
            >
              {Array.from({ length: 29 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {toNepaliNumber(d)} ({d})
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={saveDay} loading={savingDay} disabled={day === savedDay}>
            <Save aria-hidden className="h-4 w-4" />
            Save
          </Button>
          <Button variant="secondary" onClick={runNow} loading={running}>
            <Play aria-hidden className="h-4 w-4" />
            {running ? 'Backing up…' : 'Back up now'}
          </Button>
        </div>
      </section>

      {loading ? (
        <TableSkeleton rows={3} />
      ) : backups.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <Archive aria-hidden className="h-6 w-6 text-slate-400" />
          <p className="font-medium text-slate-700">No backups yet</p>
          <p className="text-sm text-slate-500">
            Press &quot;Back up now&quot; to make the first one.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {backups.map((row) => (
            <li key={row.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-semibold text-navy-900">
                  {toNepaliNumber(row.bs_year)} ({row.bs_year})
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      row.source === 'scheduled'
                        ? 'bg-navy-100 text-navy-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {row.source === 'scheduled' ? 'Robot' : 'By hand'}
                  </span>
                </p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {new Date(row.created_at).toLocaleString()} · {row.staff_count} staff ·{' '}
                  {row.record_count} records · {prettySize(row.file_size)}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                loading={downloading === row.id}
                onClick={() => download(row)}
              >
                <Download aria-hidden className="h-4 w-4" />
                Download
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
