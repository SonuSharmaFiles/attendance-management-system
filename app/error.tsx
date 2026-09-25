'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';

/**
 * Catches anything that throws while rendering a page. Without this, a failure
 * in a server component shows the visitor a raw framework error screen.
 * The real error is logged server-side; the user sees a calm message.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[attendance] page error:', error);
  }, [error]);

  return (
    <main id="main" className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <Logo size={56} className="mx-auto h-14 w-14" />
        <h1 className="mt-6 text-xl font-bold text-navy-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600">
          The page could not be loaded. This is usually temporary — please try again.
        </p>

        {/* A digest is safe to show: it identifies the log entry without
            revealing anything about the failure itself. */}
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-slate-400">Reference: {error.digest}</p>
        ) : null}

        <div className="mt-6 space-y-2">
          <Button fullWidth onClick={reset}>
            <RefreshCw aria-hidden className="h-4 w-4" />
            Try again
          </Button>
          {/* A plain anchor, not next/link, on purpose: this boundary renders
              because something already failed, and a full page load throws away
              the broken client state. A client-side navigation would keep it. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-navy-800 hover:bg-slate-50"
          >
            Back to the main page
          </a>
        </div>
      </div>
    </main>
  );
}
