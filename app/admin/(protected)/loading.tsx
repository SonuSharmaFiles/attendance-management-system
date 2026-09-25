import { TableSkeleton } from '@/components/LoadingState';

/** Shown while an admin page fetches its data on the server. */
export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-7 w-56" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="skeleton h-24" />
        ))}
      </div>
      <TableSkeleton rows={5} />
      <p role="status" aria-live="polite" className="sr-only">
        Loading
      </p>
    </div>
  );
}
