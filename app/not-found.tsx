import Link from 'next/link';
import { Header } from '@/components/Header';

export default function NotFound() {
  return (
    <div className="min-h-screen">
      <Header title="Attendance Management System" />
      <main id="main" className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-navy-900">Page not found</h1>
        <p className="mt-2 text-slate-600">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-[44px] items-center rounded-xl bg-navy-800 px-5 font-semibold text-white hover:bg-navy-700"
        >
          Back to home
        </Link>
      </main>
    </div>
  );
}
