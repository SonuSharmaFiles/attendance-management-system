'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Admin sign-in via Supabase Auth.
 *
 * There is no password anywhere in this codebase — Supabase verifies the
 * credentials and issues a session. The account's admin role lives in the
 * `profiles` table and is checked server-side after sign-in.
 */
export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        // One generic message, so this form cannot be used to discover which
        // email addresses have accounts.
        const message = 'Incorrect email or password.';
        setError(message);
        toast.error(message);
        return;
      }

      const next = searchParams.get('next');
      router.push(next && next.startsWith('/admin') ? next : '/admin');
      router.refresh();
    } catch {
      const message = 'Unable to sign in right now. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        required
        disabled={submitting}
      />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        required
        disabled={submitting}
        error={error ?? undefined}
      />
      <Button type="submit" fullWidth size="lg" loading={submitting}>
        {submitting ? 'Signing in…' : 'Sign In'}
      </Button>
    </form>
  );
}
