import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Logo } from '@/components/Logo';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';

export const metadata: Metadata = {
  title: 'Administrator Sign In',
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <Logo size={56} className="mx-auto h-14 w-auto" />
          <h1 className="mt-4 text-xl font-bold text-navy-900">Administrator Sign In</h1>
          <p className="mt-1 text-sm text-slate-600">
            Restricted area. Staff should use the main page instead.
          </p>
        </div>

        <div className="card mt-6 p-6">
          <Suspense fallback={null}>
            <AdminLoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
