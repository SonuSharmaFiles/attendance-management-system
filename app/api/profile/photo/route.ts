import { getEmployeeSession } from '@/lib/auth/employee-session';
import { uploadProfilePhoto } from '@/lib/employees/photos';
import { updateEmployeePhotoUrl } from '@/lib/employees/queries';
import { AppError, handleRouteError, jsonOk } from '@/lib/http';
import { clientKey, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/** POST /api/profile/photo — replace the signed-in employee's photo. */
export async function POST(request: Request) {
  try {
    const session = await getEmployeeSession();
    if (!session) throw new AppError('Your session has expired. Please enter your code again.', 401);

    const limit = rateLimit(clientKey(request, 'photo'), 12, 60_000);
    if (!limit.allowed) {
      throw new AppError('Too many uploads. Please wait a moment and try again.', 429);
    }

    const formData = await request.formData().catch(() => null);
    const file = formData?.get('photo');

    if (!(file instanceof File)) {
      throw new AppError('No image was received. Please choose a photo and try again.', 422);
    }

    // The employee id comes from the cookie, so a crafted request cannot
    // overwrite somebody else's photo.
    const url = await uploadProfilePhoto(session.sub, file);
    await updateEmployeePhotoUrl(session.sub, url);

    return jsonOk({ profilePhotoUrl: url });
  } catch (error) {
    return handleRouteError(error, 'The photo could not be uploaded. Please try again.');
  }
}
