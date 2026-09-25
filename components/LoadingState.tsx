import { Loader2 } from 'lucide-react';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-slate-600">
      <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
      {label}
    </span>
  );
}

export function CalendarSkeleton() {
  return (
    <div aria-hidden className="space-y-3">
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="skeleton h-5" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {Array.from({ length: 35 }).map((_, index) => (
          <div key={index} className="skeleton aspect-square min-h-[44px]" />
        ))}
      </div>
    </div>
  );
}

export function SummarySkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="skeleton h-20" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton h-12" />
      ))}
    </div>
  );
}

/** Announced to screen readers while an async region is loading. */
export function LoadingRegion({ label }: { label: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {label}
    </p>
  );
}
