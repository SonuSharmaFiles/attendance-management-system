import type { Metadata } from 'next';
import { HolidayManager } from '@/components/admin/HolidayManager';

export const metadata: Metadata = { title: 'Holidays' };
export const dynamic = 'force-dynamic';

export default function AdminHolidaysPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">Holidays</h1>
        <p className="mt-1 text-sm text-slate-600">
          Days marked here appear in red on everyone&apos;s calendar and cannot be changed by staff.
        </p>
      </div>

      <HolidayManager />
    </div>
  );
}
