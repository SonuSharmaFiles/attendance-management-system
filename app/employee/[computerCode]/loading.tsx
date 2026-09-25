import { CalendarSkeleton, SummarySkeleton } from '@/components/LoadingState';

/** Shown while the employee dashboard's data is fetched on the server. */
export default function EmployeeLoading() {
  return (
    <div className="min-h-screen">
      <div className="h-[60px] bg-navy-800" />
      <main className="mx-auto max-w-4xl space-y-5 px-3 py-5 sm:px-6 sm:py-8">
        <div className="card p-4 sm:p-6">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <div className="skeleton h-24 w-24 rounded-2xl sm:h-28 sm:w-28" />
            <div className="w-full space-y-2">
              <div className="skeleton h-7 w-48" />
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-4 w-32" />
            </div>
          </div>
        </div>
        <SummarySkeleton />
        <div className="card p-3 sm:p-5">
          <CalendarSkeleton />
        </div>
      </main>
      <p role="status" aria-live="polite" className="sr-only">
        Loading your attendance record
      </p>
    </div>
  );
}
