import type { DateStr } from '@/lib/date/nepal';

export type AttendanceStatus = 'present' | 'absent';

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  attendance_date: DateStr;
  status: AttendanceStatus;
  remark: string | null;
  created_at: string;
  updated_at: string;
}

/** What the calendar needs for one day — keeps the client payload small. */
export interface AttendanceDay {
  date: DateStr;
  status: AttendanceStatus;
  remark: string | null;
}

export interface MonthlySummary {
  totalDays: number;
  present: number;
  absent: number;
  notMarked: number;
  /** Days that have happened so far this month (future days excluded). */
  elapsedDays: number;
  attendanceRate: number;
}

export interface AttendanceReportRow {
  computerCode: string;
  fullName: string;
  date: DateStr;
  day: string;
  status: 'Present' | 'Absent' | 'Not Marked';
  remark: string;
}
