'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AtSign, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Mode = 'email' | 'password';

export function AccountSettings({ currentEmail }: { currentEmail: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('email');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCurrentPassword('');
    setNewEmail('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;

    setError(null);

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }
    if (mode === 'email' && !newEmail.trim()) {
      setError('Please enter your new email address.');
      return;
    }
    if (mode === 'password') {
      if (newPassword.length < 8) {
        setError('The new password must be at least 8 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('The two new passwords do not match.');
        return;
      }
      if (newPassword === currentPassword) {
        setError('The new password must be different from your current one.');
        return;
      }
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/account', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newEmail: mode === 'email' ? newEmail.trim() : undefined,
          newPassword: mode === 'password' ? newPassword : undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { emailChanged: boolean; passwordChanged: boolean; email: string } }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        const message =
          payload && 'error' in payload ? payload.error : 'The change could not be saved.';
        setError(message);
        toast.error(message);
        return;
      }

      reset();

      if (payload.data.passwordChanged) {
        // Supabase ends every existing session when a password changes, so the
        // admin is already signed out at this point. Say so and send them to
        // the login page deliberately, rather than letting them discover it by
        // being bounced there on their next click.
        toast.success('Password changed. Please sign in again with your new password.');
        setSignedOut(true);
        window.setTimeout(() => {
          router.push('/admin/login');
          router.refresh();
        }, 1800);
        return;
      }

      // An email change keeps the session alive.
      toast.success(`Your sign-in email is now ${payload.data.email}.`);
      router.refresh();
    } catch {
      const message = 'Unable to reach the server. Please check your connection.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (signedOut) {
    return (
      <section className="card p-6 text-center" role="status">
        <KeyRound aria-hidden className="mx-auto h-8 w-8 text-present" />
        <h2 className="mt-3 text-lg font-bold text-navy-900">Password changed</h2>
        <p className="mt-2 text-sm text-slate-600">
          For your security you have been signed out everywhere. Taking you to the sign-in page —
          use your new password there.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="card p-4 sm:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Signed in as
        </h2>
        <p className="mt-1 break-all text-lg font-semibold text-navy-900">{currentEmail}</p>
      </section>

      <section className="card p-4 sm:p-6">
        {/* Two tabs rather than one long form: changing an email and changing a
            password are different jobs, and mixing them invites mistakes. */}
        <div
          role="tablist"
          aria-label="What would you like to change?"
          className="mb-6 flex gap-2 rounded-xl bg-slate-100 p-1"
        >
          {(
            [
              { value: 'email', label: 'Change Email', Icon: AtSign },
              { value: 'password', label: 'Change Password', Icon: KeyRound },
            ] as const
          ).map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => {
                setMode(value);
                reset();
              }}
              className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${
                mode === value
                  ? 'bg-white text-navy-900 shadow-sm'
                  : 'text-slate-600 hover:text-navy-800'
              }`}
            >
              <Icon aria-hidden className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === 'email' ? (
            <Input
              label="New email address"
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={saving}
              hint="You will use this address to sign in from now on."
              required
            />
          ) : (
            <>
              <Input
                label="New password"
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                disabled={saving}
                hint="At least 8 characters. You will be signed out and must sign in again."
                required
              />
              <Input
                label="Type the new password again"
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                disabled={saving}
                required
              />
            </>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <Input
              label="Your current password"
              type={showPasswords ? 'text' : 'password'}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              disabled={saving}
              hint="Required for any change, to prove it is really you."
              error={error ?? undefined}
              required
            />
          </div>

          <button
            type="button"
            onClick={() => setShowPasswords((value) => !value)}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-navy-800"
          >
            {showPasswords ? (
              <EyeOff aria-hidden className="h-4 w-4" />
            ) : (
              <Eye aria-hidden className="h-4 w-4" />
            )}
            {showPasswords ? 'Hide passwords' : 'Show passwords'}
          </button>

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button type="submit" fullWidth loading={saving}>
              {saving
                ? 'Saving…'
                : mode === 'email'
                  ? 'Change my email'
                  : 'Change my password'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={reset}
              disabled={saving}
            >
              Clear
            </Button>
          </div>
        </form>
      </section>

      <p className="flex items-start gap-2 text-xs text-slate-500">
        <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Your current password is checked every time, so a signed-in browser left open cannot be
          used to take over this account. Write your new password down somewhere safe — there is no
          password reset unless the email address is a mailbox you can actually open.
        </span>
      </p>
    </div>
  );
}
