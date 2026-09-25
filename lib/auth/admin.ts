import { AppError } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface AdminContext {
  userId: string;
  email: string | null;
  fullName: string | null;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}

/**
 * Three outcomes, kept distinct on purpose:
 *   'anonymous'  — nobody is signed in            -> send them to the login page
 *   'forbidden'  — signed in, but not an admin    -> show "no access", do NOT
 *                  redirect to the login page, which would bounce them straight
 *                  back here and loop forever
 *   'admin'      — signed in with role = admin
 */
export type AdminAccess =
  | { state: 'anonymous' }
  | { state: 'forbidden'; email: string | null }
  | { state: 'admin'; context: AdminContext };

export async function resolveAdminAccess(): Promise<AdminAccess> {
  const supabase = await createSupabaseServerClient();

  // getUser() revalidates the JWT with Supabase, so a forged or expired
  // session cookie cannot get through.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { state: 'anonymous' };

  // The role lives in `profiles`, which is itself protected by RLS.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin') {
    return { state: 'forbidden', email: user.email ?? null };
  }

  return {
    state: 'admin',
    context: {
      userId: user.id,
      email: profile.email ?? user.email ?? null,
      fullName: profile.full_name ?? null,
      supabase,
    },
  };
}

/** Convenience for pages that have already been gated by the admin layout. */
export async function getAdminContext(): Promise<AdminContext | null> {
  const access = await resolveAdminAccess();
  return access.state === 'admin' ? access.context : null;
}

/** Route-handler variant: throws a status that `handleRouteError` turns into JSON. */
export async function requireAdmin(): Promise<AdminContext> {
  const access = await resolveAdminAccess();

  if (access.state === 'anonymous') {
    throw new AppError('You must be signed in as an administrator to do that.', 401);
  }
  if (access.state === 'forbidden') {
    throw new AppError('Your account does not have administrator access.', 403);
  }
  return access.context;
}
