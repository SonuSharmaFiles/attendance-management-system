import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

const orgName = process.env.NEXT_PUBLIC_ORG_NAME?.trim() || 'Attendance Management System';

export const metadata: Metadata = {
  title: {
    default: 'Attendance Management System',
    template: `%s · ${orgName}`,
  },
  description:
    'Internal attendance management system for recording and reviewing daily staff attendance.',
  applicationName: orgName,
  // Internal tool: keep every page out of search engines.
  robots: { index: false, follow: false, nocache: true },
  icons: { icon: '/logo.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1e3a5f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-navy-900 focus:shadow-lg"
        >
          Skip to main content
        </a>
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ duration: 4000 }}
        />
      </body>
    </html>
  );
}
