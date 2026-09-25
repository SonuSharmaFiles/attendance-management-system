import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // exceljs and jsPDF are CommonJS libraries that ship their own bundled
  // dependencies; leaving them external avoids bundler warnings and keeps the
  // serverless function small.
  serverExternalPackages: ['exceljs', 'jspdf', 'jspdf-autotable'],

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Employee records must never be framed by another site.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Belt and braces alongside app/robots.ts.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
