'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/**
 * Landing-page lookup.
 *
 * The code is posted to /api/session. The server does the lookup and, on
 * success, sets a signed HttpOnly cookie — the browser never receives employee
 * data from this call, only a redirect target.
 */
export function CodeLookupForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const trimmed = code.trim();
    if (!trimmed) {
      setError('Please enter your computer code.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ computerCode: trimmed }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { computerCode: string } }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        const message =
          payload && 'error' in payload
            ? payload.error
            : 'Computer code not found. Please check your code and try again.';
        setError(message);
        toast.error(message);
        return;
      }

      router.push(`/employee/${encodeURIComponent(payload.data.computerCode)}`);
    } catch {
      const message = 'Unable to reach the server. Please check your connection and try again.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Input
        label="Computer Code"
        name="computerCode"
        placeholder="Enter your computer code"
        value={code}
        onChange={(event) => {
          setCode(event.target.value);
          if (error) setError(null);
        }}
        error={error ?? undefined}
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        inputMode="text"
        maxLength={32}
        required
        disabled={submitting}
      />

      <Button type="submit" size="lg" fullWidth loading={submitting}>
        {submitting ? 'Checking…' : 'View Profile'}
        {!submitting ? <ArrowRight aria-hidden className="h-4 w-4" /> : null}
      </Button>
    </form>
  );
}
