'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { TableSkeleton } from '@/components/LoadingState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { describeRule, type HolidayRule } from '@/lib/holidays/rules';
import { BS_WEEKDAYS_NEPALI, bsLongLabelNepali, toBs } from '@/lib/date/bikram';
import { todayInNepal } from '@/lib/date/nepal';

type Recurrence = 'once' | 'weekly' | 'monthly';

interface FormState {
  title: string;
  note: string;
  recurrence: Recurrence;
  weekday: string;
  bsDay: string;
  startDate: string;
  endDate: string;
}

/** Turns a saved rule back into form values, so it can be edited. */
function formFromRule(rule: HolidayRule): FormState {
  return {
    title: rule.title,
    note: rule.note ?? '',
    recurrence: rule.recurrence,
    weekday: String(rule.weekday ?? 0),
    bsDay: String(rule.bs_day ?? 1),
    startDate: rule.start_date,
    endDate: rule.end_date ?? '',
  };
}

function emptyForm(): FormState {
  return {
    title: '',
    note: '',
    recurrence: 'once',
    weekday: '0',
    bsDay: '1',
    startDate: todayInNepal(),
    endDate: '',
  };
}

export function HolidayManager() {
  const [holidays, setHolidays] = useState<HolidayRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HolidayRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<HolidayRule | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/holidays', { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { holidays: HolidayRule[] } }
        | { ok: false; error: string }
        | null;
      if (!response.ok || !payload?.ok) {
        toast.error(payload && 'error' in payload ? payload.error : 'Unable to load holidays.');
        return;
      }
      setHolidays(payload.data.holidays);
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

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError(null);

    if (form.title.trim().length < 2) {
      setError('Give the holiday a name.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        editing ? `/api/admin/holidays/${editing.id}` : '/api/admin/holidays',
        {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          note: form.note.trim() || null,
          recurrence: form.recurrence,
          weekday: form.recurrence === 'weekly' ? Number(form.weekday) : null,
          bsDay: form.recurrence === 'monthly' ? Number(form.bsDay) : null,
          startDate: form.startDate,
          endDate: form.endDate || null,
          isActive: editing ? editing.is_active : true,
        }),
      },
      );
      const payload = (await response.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        const message = payload && 'error' in payload ? payload.error : 'Could not save the holiday.';
        setError(message);
        toast.error(message);
        return;
      }

      toast.success(
        editing ? 'Holiday updated for every employee.' : 'Holiday added. It applies to every employee.',
      );
      setForm(emptyForm());
      setEditing(null);
      setOpen(false);
      await load();
    } catch {
      toast.error('Unable to reach the server.');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(rule: HolidayRule) {
    if (pendingId) return;
    setPendingId(rule.id);
    try {
      const response = await fetch(`/api/admin/holidays/${rule.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.is_active }),
      });
      if (!response.ok) {
        toast.error('Could not change the holiday.');
        return;
      }
      toast.success(rule.is_active ? 'Holiday switched off.' : 'Holiday switched on.');
      await load();
    } finally {
      setPendingId(null);
    }
  }

  async function remove(rule: HolidayRule) {
    if (pendingId) return;
    setPendingId(rule.id);
    try {
      const response = await fetch(`/api/admin/holidays/${rule.id}`, { method: 'DELETE' });
      if (!response.ok) {
        toast.error('Could not remove the holiday.');
        return;
      }
      toast.success('Holiday removed.');
      await load();
    } finally {
      setPendingId(null);
      setConfirming(null);
    }
  }

  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => setForm((current) => ({ ...current, [key]: event.target.value })),
    disabled: saving,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Holidays apply to <span className="font-semibold">every staff member</span>. Staff cannot mark
          attendance on a holiday.
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setForm(emptyForm());
            setError(null);
            setOpen(true);
          }}
        >
          <Plus aria-hidden className="h-4 w-4" />
          Add Holiday
        </Button>
      </div>

      {loading ? (
        <TableSkeleton rows={3} />
      ) : holidays.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <CalendarOff aria-hidden className="h-6 w-6 text-slate-400" />
          <p className="font-medium text-slate-700">No holidays yet</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {holidays.map((rule) => (
            <li key={rule.id} className={`card p-4 ${rule.is_active ? '' : 'opacity-60'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-navy-900">
                    {rule.title}
                    {!rule.is_active ? (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        Switched off
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">{describeRule(rule)}</p>
                  {rule.note ? <p className="mt-1 text-xs text-slate-500">{rule.note}</p> : null}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditing(rule);
                      setForm(formFromRule(rule));
                      setError(null);
                      setOpen(true);
                    }}
                  >
                    <Pencil aria-hidden className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={pendingId === rule.id}
                    onClick={() => toggle(rule)}
                  >
                    {rule.is_active ? 'Switch off' : 'Switch on'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${rule.title}`}
                    loading={pendingId === rule.id}
                    onClick={() => setConfirming(rule)}
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(confirming)}
        tone="danger"
        title={confirming ? `Delete "${confirming.title}"?` : ''}
        message={
          confirming
            ? `This holiday rule will be removed for every staff member: ${describeRule(confirming)}.`
            : ''
        }
        details={[
          'Those days stop being holidays and become ordinary working days.',
          'No attendance records are deleted.',
          'To keep the rule but stop it applying, use "Switch off" instead.',
        ]}
        confirmLabel="Delete holiday"
        cancelLabel="Keep it"
        busy={Boolean(pendingId)}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) void remove(confirming);
        }}
      />

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        busy={saving}
        title={editing ? 'Edit Holiday' : 'Add a Holiday'}
        description={
          editing
            ? 'Changes apply to every staff member straight away.'
            : 'This applies to every staff member straight away.'
        }
      >
        <form onSubmit={save} className="space-y-4" noValidate>
          <Input label="Name" placeholder="For example: Dashain" maxLength={80} required {...field('title')} />

          <Select
            label="How often?"
            hint="Choose 'One date' for a single day or a festival that spans several days."
            {...field('recurrence')}
          >
            <option value="once">One date (or a range of dates)</option>
            <option value="weekly">Every week, on a chosen day</option>
            <option value="monthly">Every Nepali month, on a chosen date</option>
          </Select>

          {form.recurrence === 'weekly' ? (
            <Select label="Which day of the week?" {...field('weekday')}>
              {BS_WEEKDAYS_NEPALI.map((nepali, index) => (
                <option key={nepali} value={index}>
                  {nepali}
                </option>
              ))}
            </Select>
          ) : null}

          {form.recurrence === 'monthly' ? (
            <Select
              label="Which date of the Nepali month?"
              hint="Nepali months have 29 to 32 days; higher numbers are skipped in shorter months."
              {...field('bsDay')}
            >
              {Array.from({ length: 32 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={form.recurrence === 'once' ? 'Date' : 'Starts from'}
              type="date"
              required
              hint={(() => {
                try {
                  return bsLongLabelNepali(toBs(form.startDate));
                } catch {
                  return 'Pick a date to see the Nepali date.';
                }
              })()}
              {...field('startDate')}
            />
            <Input
              label={form.recurrence === 'once' ? 'Last date (optional)' : 'Stops after (optional)'}
              type="date"
              hint={form.recurrence === 'once' ? 'Leave blank for a single day.' : 'Leave blank to continue forever.'}
              {...field('endDate')}
            />
          </div>

          <Textarea label="Note (optional)" maxLength={200} {...field('note')} />

          {error ? (
            <p role="alert" className="text-sm font-medium text-absent">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button type="submit" fullWidth loading={saving}>
              {editing ? 'Save Changes' : 'Add Holiday'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
