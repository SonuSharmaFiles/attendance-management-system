import type { DateStr } from '@/lib/date/nepal';

export type AttendanceStatus = 'present' | 'absent' | 'leave';

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  attendance_date: DateStr;
  status: AttendanceStatus;
  remark: string | null;
  /** Set by an administrator; staff cannot change it. */
  locked_by_admin: boolean;
  created_at: string;
  updated_at: string;
}

/** What the calendar needs for one day — keeps the client payload small. */
export interface AttendanceDay {
  date: DateStr;
  status: AttendanceStatus;
  remark: string | null;
  /** An administrator set this day; staff see "Updated by administrator". */
  lockedByAdmin: boolean;
}

/** A day made a holiday by one of the admin's holiday rules. */
export interface CalendarHoliday {
  date: DateStr;
  title: string;
}

export interface MonthlySummary {
  totalDays: number;
  present: number;
  absent: number;
  notMarked: number;
  /** Days covered by a holiday rule. Never counted as present or absent. */
  holidays: number;
  /** Days an administrator assigned as leave. Never counted as absent. */
  leave: number;
  /** Working days that have happened so far (future and holidays excluded). */
  elapsedDays: number;
  attendanceRate: number;
}

export interface AttendanceReportRow {
  computerCode: string;
  fullName: string;
  date: DateStr;
  day: string;
  status: 'Present' | 'Absent' | 'Leave' | 'Not Marked' | 'Holiday';
  remark: string;
}
