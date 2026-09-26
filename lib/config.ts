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
  /**
   * Small print at the bottom of the landing page. The default is deliberately
   * cautious: until you replace the placeholder logo with branding you are
   * authorised to use, the site should not imply official status. Set
   * NEXT_PUBLIC_FOOTER_NOTE once that is in order, or to an empty string to
   * remove the line entirely.
   */
  footerNote: string;
}

export function getAppSettings(): AppSettings {
  const footerNote = process.env.NEXT_PUBLIC_FOOTER_NOTE;

  return {
    attendanceEditEnabled: envFlag(process.env.ATTENDANCE_EDIT_ENABLED, true),
    allowFutureAttendance: envFlag(process.env.ALLOW_FUTURE_ATTENDANCE, false),
    organisationName: process.env.NEXT_PUBLIC_ORG_NAME?.trim() || 'Attendance Management System',
    footerNote:
      footerNote === undefined
        ? 'Internal use only. Authorised personnel only.'
        : footerNote.trim(),
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

/**
 * "Type of staff" — stored in the `department` column.
 *
 * The column keeps its original name on purpose: renaming it would mean a
 * migration across attendance queries, exports, the Excel importer and the
 * filters, for a label change. Only what people see has changed.
 */
export const STAFF_TYPES = [
  'यही दरबन्दी भएको',
  'काजमा रहेको',
] as const;

export type StaffType = (typeof STAFF_TYPES)[number];

/** Label used wherever the `department` field is shown. */
export const STAFF_TYPE_LABEL = 'Type of staff';

/** Label used wherever the `office` field is shown. */
export const DARBANDI_LABEL = 'दरबन्दी';

/**
 * Admin panel heading. Kept in config rather than hard-coded in the component
 * so it can be changed from the environment without touching the code.
 */
export const ADMIN_TITLE =
  process.env.NEXT_PUBLIC_ADMIN_TITLE?.trim() || 'मधेश प्रदेश प्रहरी तालिम केन्द्र, जनकपुर';

export const ADMIN_SUBTITLE =
  process.env.NEXT_PUBLIC_ADMIN_SUBTITLE?.trim() || 'सम्पर्क कार्यालय - सप्तरी';
