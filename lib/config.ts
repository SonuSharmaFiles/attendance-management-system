/**
 * Organisation-level switches. These are read on the server and passed down to
 * the client, so an admin can change behaviour by editing environment variables
 * and redeploying — no code change required.
 */

function envFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export interface AppSettings {
  /** Employees may change an attendance entry that was already saved. */
  attendanceEditEnabled: boolean;
  /** Employees may mark attendance for dates that have not happened yet. */
  allowFutureAttendance: boolean;
  /** Displayed organisation name. Replace with your own. */
  organisationName: string;
}

export function getAppSettings(): AppSettings {
  return {
    attendanceEditEnabled: envFlag(process.env.ATTENDANCE_EDIT_ENABLED, true),
    allowFutureAttendance: envFlag(process.env.ALLOW_FUTURE_ATTENDANCE, false),
    organisationName: process.env.NEXT_PUBLIC_ORG_NAME?.trim() || 'Attendance Management System',
  };
}

/** Employee session cookie lifetime, in seconds (default 12 hours). */
export const EMPLOYEE_SESSION_TTL_SECONDS = Number(
  process.env.EMPLOYEE_SESSION_TTL_SECONDS ?? 60 * 60 * 12,
);

export const PHOTO_BUCKET = 'employee-photos';
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_REMARK_LENGTH = 300;
export const MAX_EXPORT_MONTHS = 24;
