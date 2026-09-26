'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, RotateCcw, Search, UserX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { TableSkeleton } from '@/components/LoadingState';
import { EmployeeFormModal } from '@/components/admin/EmployeeFormModal';
import type { Employee } from '@/types/employee';

const PAGE_SIZE = 25;

export function EmployeeManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('active');
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        status,
      });
      if (search.trim()) params.set('search', search.trim());

      const response = await fetch(`/api/admin/employees?${params}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { employees: Employee[]; total: number } }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        toast.error(payload && 'error' in payload ? payload.error : 'Unable to load employees.');
        return;
      }

      setEmployees(payload.data.employees);
      setTotal(payload.data.total);
    } catch {
      toast.error('Unable to reach the server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function setActive(employee: Employee, active: boolean) {
    if (pendingId) return;

    if (!active && !window.confirm(`Deactivate ${employee.full_name}? Their attendance history is kept.`)) {
      return;
    }

    setPendingId(employee.id);
    try {
      const response = active
        ? await fetch(`/api/admin/employees/${employee.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: true }),
          })
        : await fetch(`/api/admin/employees/${employee.id}`, { method: 'DELETE' });

      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !payload?.ok) {
        toast.error(payload?.error ?? 'The change could not be saved.');
        return;
      }

      toast.success(active ? 'Employee reactivated.' : 'Employee deactivated.');
      await load();
    } catch {
      toast.error('Unable to reach the server. Please check your connection.');
    } finally {
      setPendingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <Input
            label="Search"
            placeholder="Name or computer code"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            autoComplete="off"
          />
        </div>
        <div className="w-40">
          <Select
            label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
              setPage(1);
            }}
          >
            <option value="active">Active</option>
            <option value="inactive">Deactivated</option>
            <option value="all">All</option>
          </Select>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus aria-hidden className="h-4 w-4" />
          Add Employee
        </Button>
      </div>

      {loading ? (
        <TableSkeleton rows={6} />
      ) : employees.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <Search aria-hidden className="h-6 w-6 text-slate-400" />
          <p className="font-medium text-slate-700">No employees found</p>
          <p className="text-sm text-slate-500">
            Try a different search, or import your staff list from Excel.
          </p>
        </div>
      ) : (
        <>
          {/* Cards on phones, a table from `md` up — both from the same data. */}
          <ul className="space-y-2 md:hidden">
            {employees.map((employee) => (
              <li key={employee.id} className="card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy-900">{employee.full_name}</p>
                    <p className="font-mono text-xs text-slate-500">{employee.computer_code}</p>
                    <p className="mt-1 truncate text-xs text-slate-600">
                      {[employee.rank, employee.department].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  {!employee.is_active ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      Inactive
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditing(employee);
                      setModalOpen(true);
                    }}
                  >
                    <Pencil aria-hidden className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={pendingId === employee.id}
                    onClick={() => setActive(employee, !employee.is_active)}
                  >
                    {employee.is_active ? 'Deactivate' : 'Reactivate'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Employee records</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Code</th>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Rank</th>
                  <th scope="col" className="px-4 py-3">Type of staff</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((employee) => (
                  <tr key={employee.id} className={employee.is_active ? '' : 'bg-slate-50/60'}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-navy-800">
                      {employee.computer_code}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{employee.full_name}</td>
                    <td className="px-4 py-3 text-slate-600">{employee.rank ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{employee.department ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          employee.is_active
                            ? 'bg-present-soft text-present-ink'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {employee.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Edit ${employee.full_name}`}
                          onClick={() => {
                            setEditing(employee);
                            setModalOpen(true);
                          }}
                        >
                          <Pencil aria-hidden className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={pendingId === employee.id}
                          aria-label={`${employee.is_active ? 'Deactivate' : 'Reactivate'} ${employee.full_name}`}
                          onClick={() => setActive(employee, !employee.is_active)}
                        >
                          {employee.is_active ? (
                            <UserX aria-hidden className="h-4 w-4" />
                          ) : (
                            <RotateCcw aria-hidden className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
            <span>
              {total} employee{total === 1 ? '' : 's'} · page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <EmployeeFormModal
        open={modalOpen}
        employee={editing}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />
    </div>
  );
}
