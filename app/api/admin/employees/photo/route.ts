import { requireAdmin } from '@/lib/auth/admin';
import { uploadProfilePhoto } from '@/lib/employees/photos';
import { AppError, describeDbError, handleRouteError, jsonOk } from '@/lib/http';

export const runtime = 'nodejs';

/** POST /api/admin/employees/photo — an admin sets any employee's photo. */
export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin();

    const formData = await request.formData().catch(() => null);
    const file = formData?.get('photo');
    const employeeId = formData?.get('employeeId');

    if (typeof employeeId !== 'string' || employeeId.length === 0) {
      throw new AppError('No employee was selected.', 422);
    }
    if (!(file instanceof File)) {
      throw new AppError('No image was received. Please choose a photo and try again.', 422);
    }

    const url = await uploadProfilePhoto(employeeId, file);

    const { error } = await supabase
      .from('employees')
      .update({ profile_photo_url: url })
      .eq('id', employeeId);
    if (error) throw new AppError(describeDbError(error), 500);

    return jsonOk({ profilePhotoUrl: url });
  } catch (error) {
    return handleRouteError(error, 'The photo could not be uploaded.');
  }
}
