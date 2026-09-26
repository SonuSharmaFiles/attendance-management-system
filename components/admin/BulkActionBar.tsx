'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { STAFF_TYPES, STAFF_TYPE_LABEL } from '@/lib/config';

/** What a bulk edit may change. An absent key means "leave this alone". */
export interface BulkChanges {
  rank?: string;
  department?: string;
  is_active?: boolean;
}

/** The unchanged option, shared by both dropdowns. */
const KEEP = '';

interface BulkActionBarProps {
  /** How many staff are ticked. */
  count: number;
  busy: boolean;
  onApply: (changes: BulkChanges) => void;
  onClear: () => void;
}

/**
 * Appears above the staff list as soon as one tick box is ticked.
 *
 * Every field starts on "keep as it is", so pressing Apply with only the rank
 * filled in changes only the rank. Nothing is sent until the admin confirms,
 * and Apply stays disabled while every field is still untouched — there is no
 * such thing as an accidental empty bulk edit.
 */
export function BulkActionBar({ count, busy, onApply, onClear }: BulkActionBarProps) {
  const [rank, setRank] = useState('');
  const [department, setDepartment] = useState(KEEP);
  const [status, setStatus] = useState(KEEP);

  const changes: BulkChanges = {};
  if (rank.trim()) changes.rank = rank.trim();
  if (department !== KEEP) changes.department = department;
  if (status !== KEEP) changes.is_active = status === 'active';

  const nothingChosen = Object.keys(changes).length === 0;

  return (
    <div className="card border-navy-200 bg-navy-50 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <p className="min-h-[44px] shrink-0 self-center text-sm font-semibold text-navy-900">
          {count} selected
        </p>

        <div className="min-w-[150px] flex-1">
          <Input
            label="Rank"
            placeholder="Keep as it is"
            value={rank}
            maxLength={80}
            disabled={busy}
            autoComplete="off"
            onChange={(event) => setRank(event.target.value)}
          />
        </div>

        <div className="min-w-[180px] flex-1">
          <Select
            label={STAFF_TYPE_LABEL}
            value={department}
            disabled={busy}
            onChange={(event) => setDepartment(event.target.value)}
          >
            <option value={KEEP}>Keep as it is</option>
            {STAFF_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-40">
          <Select
            label="Status"
            value={status}
            disabled={busy}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value={KEEP}>Keep as it is</option>
            <option value="active">Active</option>
            <option value="inactive">Deactivated</option>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button loading={busy} disabled={nothingChosen} onClick={() => onApply(changes)}>
            Apply to {count}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onClear}>
            <X aria-hidden className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-600">
        A box left on &ldquo;Keep as it is&rdquo; changes nothing. Only what you fill in is applied,
        and only to the {count} staff you ticked.
      </p>
    </div>
  );
}
