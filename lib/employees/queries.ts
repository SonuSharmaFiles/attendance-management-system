import { getServiceClient } from '@/lib/supabase/admin';
import { AppError, describeDbError } from '@/lib/errors';
import type { Employee, EmployeePublic } from '@/types/employee';

const EMPLOYEE_COLUMNS =
  'id, computer_code, full_name, rank, department, office, phone, email, profile_photo_url, is_active, created_at, updated_at';

/**
 * Looks up an active employee by computer code.
 *
 * This is the single place where "who is this person?" is decided. When a
 * second factor (PIN / password / OTP) is introduced, verify it here and keep
 * the rest of the application unchanged.
 */
export async function verifyEmployeeCode(computerCode: string): Promise<Employee | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('employees')
    .select(EMPLOYEE_COLUMNS)
    .eq('computer_code', computerCode)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw new AppError(describeDbError(error), 500);
  return (data as Employee | null) ?? null;
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('employees')
    .select(EMPLOYEE_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new AppError(describeDbError(error), 500);
  return (data as Employee | null) ?? null;
}

export async function updateEmployeePhotoUrl(id: string, url: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.from('employees').update({ profile_photo_url: url }).eq('id', id);
  if (error) throw new AppError(describeDbError(error), 500);
}

/** Strips phone/email and internal flags before sending to an employee's browser. */
export function toPublicEmployee(employee: Employee): EmployeePublic {
  return {
    id: employee.id,
    computer_code: employee.computer_code,
    full_name: employee.full_name,
    rank: employee.rank,
    department: employee.department,
    office: employee.office,
    profile_photo_url: employee.profile_photo_url,
  };
}
