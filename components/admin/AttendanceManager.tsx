'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TableSkeleton } from '@/components/LoadingState';
import { currentYearMonth, dayName, monthBounds, todayInNepal, type DateStr } from '@/lib/date/nepal';
import { MAX_REMARK_LENGTH } from '@/lib/config';
import type { Employee } from '@/types/employee';

interface AttendanceRow {
  id: string;
  employee_id: string;
  attendance_date: DateStr;
  status: 'present' | 'absent';
  remark: string | null;
  employees: {
    computer_code: string;
    full_name: string;
    rank: string | null;
    department: string | null;
  } | null;
}

interface EditState {
  employeeId: string;
  employeeName: string;
  date: DateStr;
  status: 'present' | 'absent' | 'clear';
  remark: string;
}

export function AttendanceManager({ departments }: { departments: string[] }) {
  const bounds = useMemo(() => monthBounds(currentYearMonth()), []);
  const today = useMemo(() => todayInNepal(), []);

  const [from, setFrom] = useState<DateStr>(bounds.start);
  const [to, setTo] = useState<DateStr>(today);
  const [status, setStatus] = useState<'all' | 'present' | 'absent'>('all');
  const [department, setDepartment] = useState('');
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [employeeMatches, setEmployeeMatches] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  // --- employee search ------------------------------------------------------
  // Matches are cleared by the handlers that change the query, so this effect
  // only ever talks to the network.
  useEffect(() => {
    const query = employeeQuery.trim();
    if (!query || selectedEmployee) return;

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/employees?search=${encodeURIComponent(query)}&pageSize=10&status=all`,
          { cache: 'no-store' },
        );
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; data: { employees: Employee[] } }
          | null;
        if (payload?.ok) setEmployeeMatches(payload.data.employees);
      } catch {
        // A failed type-ahead is not worth a toast; the main query will report.
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [employeeQuery, selectedEmployee]);

  // --- records --------------------------------------------------------------
  const load = useCallback(async () => {
    if (from > to) {
      toast.error('The start date must not be after the end date.');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to, status });
      if (selectedEmployee) params.set('employeeId', selectedEmployee.id);
      if (department) params.set('department', department);

      const response = await fetch(`/api/admin/attendance?${params}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { records: AttendanceRow[] } }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        toast.error(
          payload && 'error' in payload ? payload.error : 'Unable to load attendance records.',
        );
        return;
      }

      setRows(payload.data.records);
    } catch {
      toast.error('Unable to reach the server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [from, to, status, department, selectedEmployee]);

  // Debounced so dragging a date picker or typing a filter does not fire a
  // request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveEdit() {
    if (!edit || saving) return;

    setSaving(true);
    try {
      const response = await fetch('/api/admin/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: edit.employeeId,
          date: edit.date,
          status: edit.status,
          remark: edit.status === 'absent' ? edit.remark.trim() || null : null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        toast.error(payload && 'error' in payload ? payload.error : 'The change could not be saved.');
        return;
      }

      toast.success(edit.status === 'clear' ? 'Attendance cleared.' : 'Attendance updated.');
      setEdit(null);
      await load();
    } catch {
      toast.error('Unable to reach the server. Please check your connection.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card space-y-4 p-4 sm:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Filters</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="From Date" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To Date" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">All statuses</option>
            <option value="present">Present only</option>
            <option value="absent">Absent only</option>
          </Select>
          <Select
            label="Department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            disabled={Boolean(selectedEmployee)}
          >
            <option value="">All departments</option>
            {departments.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>

        <div className="relative">
          <Input
            label="Employee"
            placeholder="Search by name or computer code"
            value={selectedEmployee ? `${selectedEmployee.computer_code} — ${selectedEmployee.full_name}` : employeeQuery}
            onChange={(event) => {
              setSelectedEmployee(null);
              setEmployeeQuery(event.target.value);
              if (!event.target.value.trim()) setEmployeeMatches([]);
            }}
            autoComplete="off"
            hint={selectedEmployee ? 'Clear the box to search again.' : 'Leave blank to include everyone.'}
          />
          {employeeMatches.length > 0 ? (
            <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {employeeMatches.map((employee) => (
                <li key={employee.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      setSelectedEmployee(employee);
                      setEmployeeQuery('');
                      setEmployeeMatches([]);
                    }}
                  >
                    <span className="font-mono text-xs text-navy-700">{employee.computer_code}</span>
                    <span className="truncate">{employee.full_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {selectedEmployee ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSelectedEmployee(null);
                setEmployeeQuery('');
              }}
            >
              Clear employee filter
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setEdit({
                  employeeId: selectedEmployee.id,
                  employeeName: selectedEmployee.full_name,
                  date: today,
                  status: 'present',
                  remark: '',
                })
              }
            >
              <Pencil aria-hidden className="h-3.5 w-3.5" />
              Add / correct a date
            </Button>
          </div>
        ) : null}
      </section>

      {loading ? (
        <TableSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <Search aria-hidden className="h-6 w-6 text-slate-400" />
          <p className="font-medium text-slate-700">No attendance records match these filters</p>
          <p className="text-sm text-slate-500">Try widening the date range or clearing a filter.</p>
        </div>
      ) : (
        <section className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Attendance records</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-3 py-3">Date</th>
                <th scope="col" className="px-3 py-3">Day</th>
                <th scope="col" className="px-3 py-3">Code</th>
                <th scope="col" className="px-3 py-3">Employee</th>
                <th scope="col" className="px-3 py-3">Status</th>
                <th scope="col" className="px-3 py-3">Remark</th>
                <th scope="col" className="px-3 py-3 text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{row.attendance_date}</td>
                  <td className="px-3 py-2.5 text-slate-600">{dayName(row.attendance_date)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-navy-800">
                    {row.employees?.computer_code ?? '—'}
                  </td>
                  <td className="px-3 py-2.5">{row.employees?.full_name ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2.5 text-slate-600" title={row.remark ?? ''}>
                    {row.remark || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit attendance for ${row.employees?.full_name ?? 'employee'} on ${row.attendance_date}`}
                      onClick={() =>
                        setEdit({
                          employeeId: row.employee_id,
                          employeeName: row.employees?.full_name ?? 'Employee',
                          date: row.attendance_date,
                          status: row.status,
                          remark: row.remark ?? '',
                        })
                      }
                    >
                      <Pencil aria-hidden className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            Showing {rows.length} record{rows.length === 1 ? '' : 's'} (maximum 1000 per query). Use
            Export for a complete report.
          </p>
        </section>
      )}

      <Modal
        open={Boolean(edit)}
        onClose={() => {
          if (!saving) setEdit(null);
        }}
        busy={saving}
        title="Correct Attendance"
        description={edit ? `${edit.employeeName} — ${edit.date}` : undefined}
      >
        {edit ? (
          <div className="space-y-4">
            <Input
              label="Date"
              type="date"
              value={edit.date}
              onChange={(event) => setEdit({ ...edit, date: event.target.value })}
              disabled={saving}
            />

            <Select
              label="Status"
              value={edit.status}
              onChange={(event) => setEdit({ ...edit, status: event.target.value as EditState['status'] })}
              disabled={saving}
              hint="Choosing “Clear” removes the record for this date entirely."
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="clear">Clear (not marked)</option>
            </Select>

            {edit.status === 'absent' ? (
              <Textarea
                label="Remark (Optional)"
                value={edit.remark}
                maxLength={MAX_REMARK_LENGTH}
                onChange={(event) => setEdit({ ...edit, remark: event.target.value })}
                disabled={saving}
              />
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button fullWidth loading={saving} onClick={saveEdit}>
                Save
              </Button>
              <Button variant="secondary" fullWidth onClick={() => setEdit(null)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
