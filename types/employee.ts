export interface Employee {
  id: string;
  computer_code: string;
  full_name: string;
  rank: string | null;
  department: string | null;
  office: string | null;
  phone: string | null;
  email: string | null;
  profile_photo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** The subset that is safe to send to an employee's own browser. */
export type EmployeePublic = Pick<
  Employee,
  | 'id'
  | 'computer_code'
  | 'full_name'
  | 'rank'
  | 'department'
  | 'office'
  | 'profile_photo_url'
>;

export interface EmployeeImportRow {
  computer_code: string;
  full_name: string;
  rank: string | null;
  department: string | null;
  office: string | null;
  phone: string | null;
  email: string | null;
}

export type ImportRowOutcome = 'new' | 'update' | 'duplicate' | 'invalid';

export interface ImportPreviewRow {
  rowNumber: number;
  outcome: ImportRowOutcome;
  errors: string[];
  data: EmployeeImportRow;
}

export interface ImportPreview {
  rows: ImportPreviewRow[];
  summary: {
    totalRows: number;
    newEmployees: number;
    updatedEmployees: number;
    duplicateCodes: number;
    invalidRows: number;
  };
}
