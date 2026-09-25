'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProfilePhoto } from '@/components/ProfilePhoto';
import type { Employee } from '@/types/employee';

type FormState = {
  computer_code: string;
  full_name: string;
  rank: string;
  department: string;
  office: string;
  phone: string;
  email: string;
};

const EMPTY: FormState = {
  computer_code: '',
  full_name: '',
  rank: '',
  department: '',
  office: '',
  phone: '',
  email: '',
};

function toFormState(employee: Employee | null): FormState {
  if (!employee) return EMPTY;
  return {
    computer_code: employee.computer_code,
    full_name: employee.full_name,
    rank: employee.rank ?? '',
    department: employee.department ?? '',
    office: employee.office ?? '',
    phone: employee.phone ?? '',
    email: employee.email ?? '',
  };
}

interface EmployeeFormModalProps {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EmployeeFormModal({ open, employee, onClose, onSaved }: EmployeeFormModalProps) {
  if (!open) return null;

  // Keying by the employee (or 'new') gives each open a fresh form, so the
  // fields reset themselves instead of being synchronised by an effect.
  return (
    <EmployeeForm
      key={employee?.id ?? 'new'}
      employee={employee}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function EmployeeForm({ employee, onClose, onSaved }: Omit<EmployeeFormModalProps, 'open'>) {
  const [form, setForm] = useState<FormState>(() => toFormState(employee));
  const [photoUrl, setPhotoUrl] = useState<string | null>(employee?.profile_photo_url ?? null);
  const [saving, setSaving] = useState(false);

  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value })),
    disabled: saving,
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const endpoint = employee ? `/api/admin/employees/${employee.id}` : '/api/admin/employees';
      const response = await fetch(endpoint, {
        method: employee ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        toast.error(
          payload && 'error' in payload ? payload.error : 'The employee could not be saved.',
        );
        return;
      }

      toast.success(employee ? 'Employee updated.' : 'Employee added.');
      onSaved();
      onClose();
    } catch {
      toast.error('Unable to reach the server. Please check your connection.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      title={employee ? 'Edit Employee' : 'Add Employee'}
      description={
        employee ? `Updating ${employee.full_name}.` : 'Only the code and name are required.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {employee ? (
          <div className="flex justify-center">
            <ProfilePhoto
              photoUrl={photoUrl}
              fullName={employee.full_name}
              endpoint="/api/admin/employees/photo"
              employeeId={employee.id}
              size="md"
              onUploaded={(url) => {
                setPhotoUrl(url);
                onSaved();
              }}
            />
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Computer Code"
            required
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={32}
            {...field('computer_code')}
          />
          <Input label="Full Name" required maxLength={120} {...field('full_name')} />
          <Input label="Rank" maxLength={80} {...field('rank')} />
          <Input label="Department" maxLength={120} {...field('department')} />
          <Input label="Office" maxLength={120} {...field('office')} />
          <Input label="Phone" type="tel" maxLength={40} {...field('phone')} />
          <div className="sm:col-span-2">
            <Input label="Email" type="email" maxLength={160} {...field('email')} />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="submit" fullWidth loading={saving}>
            {employee ? 'Save Changes' : 'Add Employee'}
          </Button>
          <Button type="button" variant="secondary" fullWidth onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
