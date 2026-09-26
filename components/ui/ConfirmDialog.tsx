'use client';

import { AlertTriangle, Info, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

type Tone = 'danger' | 'warning' | 'info';

const TONE = {
  danger: { Icon: Trash2, ring: 'bg-absent-soft text-absent', button: 'danger' as const },
  warning: { Icon: AlertTriangle, ring: 'bg-amber-100 text-amber-700', button: 'primary' as const },
  info: { Icon: Info, ring: 'bg-navy-100 text-navy-700', button: 'primary' as const },
};

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** The one-line consequence. Keep it plain. */
  message: string;
  /** Optional extra lines — what is kept, what is lost, how to undo. */
  details?: string[];
  confirmLabel: string;
  cancelLabel?: string;
  tone?: Tone;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A confirmation people can actually read.
 *
 * Replaces window.confirm, which cannot be styled, ignores the page's
 * language and typography, renders Devanagari inconsistently across browsers,
 * and on some mobile browsers can be suppressed entirely — so a destructive
 * action could go through with no prompt at all.
 *
 * Cancel is listed first in the DOM so it takes focus, and the destructive
 * button is never the default action of a key press.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  details,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { Icon, ring, button } = TONE[tone];

  return (
    <Modal open={open} onClose={onCancel} busy={busy} title={title}>
      <div className="space-y-4">
        <div className="flex gap-3">
          <span
            aria-hidden
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ring}`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <p className="pt-1.5 text-sm text-slate-700">{message}</p>
        </div>

        {details && details.length > 0 ? (
          <ul className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            {details.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button variant={button} fullWidth loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button variant="secondary" fullWidth onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
