import type { NextConfig } from 'next';

/**
 * The Supabase origin has to appear in the Content-Security-Policy, because the
 * browser talks to it directly for admin sign-in and loads profile photos from
 * it. Derived from the environment so the policy follows the deployment.
 */
function supabaseOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
}

const isDev = process.env.NODE_ENV !== 'production';
const supabase = supabaseOrigin();

const csp = [
  "default-src 'self'",
  // Next.js inlines a small bootstrap script and the hydration payload.
  // 'unsafe-eval' is required by the dev server's hot reload only.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  // Tailwind injects styles at runtime.
  "style-src 'self' 'unsafe-inline'",
  // blob:/data: cover the in-browser photo resize preview.
  `img-src 'self' data: blob:${supabase ? ` ${supabase}` : ''}`,
  "font-src 'self' data:",
  `connect-src 'self'${supabase ? ` ${supabase}` : ''}${isDev ? ' ws: wss:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const nextConfig: NextConfig = {
  // exceljs and jsPDF are CommonJS libraries that ship their own bundled
  // dependencies; leaving them external avoids bundler warnings and keeps the
  // serverless function small.
  serverExternalPackages: ['exceljs', 'jspdf', 'jspdf-autotable'],

  // Never leak the framework version to the internet.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          // Employee records must never be framed by another site.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Belt and braces alongside app/robots.ts.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        // Nothing under /api may ever be cached by a browser or CDN.
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
