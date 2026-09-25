import type { MetadataRoute } from 'next';

/**
 * Lets staff add the system to a phone's home screen and open it like an app —
 * which is how most people will use it day to day.
 */
export default function manifest(): MetadataRoute.Manifest {
  const name = process.env.NEXT_PUBLIC_ORG_NAME?.trim() || 'Attendance Management System';

  return {
    name: `${name} — Attendance`,
    short_name: 'Attendance',
    description: 'Record and review daily staff attendance.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f8fb',
    theme_color: '#1e3a5f',
    icons: [
      { src: '/logo.png', sizes: '105x99', type: 'image/png', purpose: 'any' },
    ],
  };
}
