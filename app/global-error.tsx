'use client';

import { useEffect } from 'react';

/**
 * Last line of defence: catches failures in the root layout itself, where the
 * normal error boundary cannot run. It must render its own <html> and <body>,
 * and cannot rely on the app's styles being loaded, so everything is inline.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[attendance] global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background: '#f6f8fb',
          color: '#0f172a',
          padding: '1rem',
        }}
      >
        <div style={{ maxWidth: '24rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e3a5f' }}>
            The application could not start
          </h1>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#475569' }}>
            Please try again in a moment. If this keeps happening, contact your administrator.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              minHeight: '44px',
              padding: '0 1.25rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: '#1e3a5f',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
