import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/admin';
import { getServiceClient } from '@/lib/supabase/admin';
import { adminAccountUpdateSchema } from '@/lib/validation/schemas';
import { AppError, describeDbError, handleRouteError, jsonOk, readJson } from '@/lib/http';
import { clientKey, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * PATCH /api/admin/account — an administrator changes their own email or password.
 *
 * Two deliberate choices here:
 *
 * 1. The CURRENT PASSWORD is always required and is re-checked against Supabase
 *    before anything changes. Holding a valid session is not sufficient — an
 *    unattended laptop must not be enough to take the account over.
 *
 * 2. The change is applied with the service-role admin API rather than the
 *    normal `updateUser` flow. The normal flow emails a confirmation link, and
 *    Supabase's built-in mail service is rate limited and meant only for
 *    testing, so an administrator who cannot receive that mail would be locked
 *    out mid-change. Re-checking the password above is what makes it safe to
 *    skip the email round-trip.
 */
export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();

    // Password guessing against a known admin email is the obvious attack.
    const limit = rateLimit(clientKey(request, 'admin-account'), 8, 300_000);
    if (!limit.allowed) {
      throw new AppError(
        `Too many attempts. Please wait ${limit.retryAfterSeconds} seconds and try again.`,
        429,
      );
    }

    const input = adminAccountUpdateSchema.parse(await readJson(request));

    if (!admin.email) {
      throw new AppError('This account has no email address on record.', 400);
    }

    // --- Step 1: prove they know the current password ----------------------
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) throw new AppError('Supabase is not configured.', 500);

    // A throwaway client, so signing in here cannot disturb the real session.
    const verifier = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: signInError } = await verifier.auth.signInWithPassword({
      email: admin.email,
      password: input.currentPassword,
    });

    if (signInError) {
      throw new AppError('Your current password is incorrect.', 401);
    }

    // --- Step 2: apply the change -----------------------------------------
    const service = getServiceClient();

    const payload: { email?: string; password?: string; email_confirm?: boolean } = {};
    if (input.newEmail && input.newEmail !== admin.email.toLowerCase()) {
      payload.email = input.newEmail;
      // Mark it confirmed: the password check above already proved ownership,
      // and there is no mail service configured to complete a link flow.
      payload.email_confirm = true;
    }
    if (input.newPassword) {
      payload.password = input.newPassword;
    }

    if (Object.keys(payload).length === 0) {
      throw new AppError('That is already your email address. Nothing to change.', 422);
    }

    const { error: updateError } = await service.auth.admin.updateUserById(admin.userId, payload);

    if (updateError) {
      const message = updateError.message.toLowerCase();
      if (message.includes('already') || message.includes('registered')) {
        throw new AppError('That email address is already in use by another account.', 409);
      }
      if (message.includes('password')) {
        throw new AppError('That password was rejected. Please choose a stronger one.', 422);
      }
      console.error('[attendance] admin account update failed:', updateError);
      throw new AppError('The change could not be saved. Please try again.', 500);
    }

    // --- Step 3: keep the profiles table in step --------------------------
    if (payload.email) {
      const { error: profileError } = await service
        .from('profiles')
        .update({ email: payload.email })
        .eq('id', admin.userId);
      if (profileError) throw new AppError(describeDbError(profileError), 500);
    }

    return jsonOk({
      emailChanged: Boolean(payload.email),
      passwordChanged: Boolean(payload.password),
      email: payload.email ?? admin.email,
    });
  } catch (error) {
    return handleRouteError(error, 'The change could not be saved. Please try again.');
  }
}
