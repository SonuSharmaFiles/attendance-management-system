'use client';

import { ProfilePhoto } from '@/components/ProfilePhoto';
import type { EmployeePublic } from '@/types/employee';

interface EmployeeProfileProps {
  employee: EmployeePublic;
  photoUrl: string | null;
  onPhotoUploaded: (url: string) => void;
  actions?: React.ReactNode;
}

export function EmployeeProfile({
  employee,
  photoUrl,
  onPhotoUploaded,
  actions,
}: EmployeeProfileProps) {
  return (
    <section className="card p-4 sm:p-6" aria-label="Employee profile">
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
        <ProfilePhoto
          photoUrl={photoUrl}
          fullName={employee.full_name}
          onUploaded={onPhotoUploaded}
        />

        <div className="min-w-0 flex-1">
          <h1 className="break-words text-xl font-bold text-navy-900 sm:text-2xl">
            {employee.full_name}
          </h1>

          <dl className="mt-2 space-y-1 text-sm text-slate-600">
            <div className="flex flex-wrap justify-center gap-x-1.5 sm:justify-start">
              <dt className="font-medium text-slate-700">Computer Code:</dt>
              <dd className="font-mono font-semibold tracking-wide text-navy-800">
                {employee.computer_code}
              </dd>
            </div>
            {employee.rank ? (
              <div className="flex flex-wrap justify-center gap-x-1.5 sm:justify-start">
                <dt className="sr-only">Rank</dt>
                <dd>{employee.rank}</dd>
              </div>
            ) : null}
            {employee.department || employee.office ? (
              <div className="flex flex-wrap justify-center gap-x-1.5 sm:justify-start">
                <dt className="sr-only">Department and office</dt>
                <dd>{[employee.department, employee.office].filter(Boolean).join(' · ')}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {actions ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}
