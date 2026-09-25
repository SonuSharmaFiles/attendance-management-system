import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { CodeLookupForm } from '@/components/CodeLookupForm';
import { Logo } from '@/components/Logo';
import { getAppSettings } from '@/lib/config';

export default function LandingPage() {
  const { organisationName, footerNote } = getAppSettings();

  return (
    <div className="flex min-h-screen flex-col">
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md">
          <div className="text-center">
            <Logo size={72} className="mx-auto h-16 w-auto sm:h-20" />
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
              Attendance Management System
            </h1>
            <p className="mt-2 text-sm text-slate-600">{organisationName}</p>
          </div>

          <div className="card mt-8 p-6 sm:p-8">
            <h2 className="text-center text-lg font-semibold text-navy-900">
              Enter Your Computer Code
            </h2>
            <p className="mt-1 mb-6 text-center text-sm text-slate-600">
              Enter the code issued to you to open your attendance record.
            </p>
            <CodeLookupForm />
          </div>

          <p className="mt-6 flex items-start justify-center gap-2 text-center text-xs text-slate-500">
            <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Your record is private to you. Contact your administrator if your code does not work.
            </span>
          </p>

          <p className="mt-8 text-center text-xs text-slate-400">
            <Link href="/admin" className="underline underline-offset-2 hover:text-slate-600">
              Administrator sign in
            </Link>
          </p>
        </div>
      </main>

      {footerNote ? (
        <footer className="px-4 pb-8 text-center text-xs text-slate-400">{footerNote}</footer>
      ) : null}
    </div>
  );
}
