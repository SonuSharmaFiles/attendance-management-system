import { redirect } from 'next/navigation';
import { resolveAdminAccess } from '@/lib/auth/admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { NoAdminAccess } from '@/components/admin/NoAdminAccess';

export const dynamic = 'force-dynamic';

/**
 * Admin gate.
 *
 * `(protected)` is a route group: it adds this layout to every admin page
 * without appearing in the URL, and deliberately excludes /admin/login, which
 * must still render for signed-out visitors.
 *
 * Three independent checks protect this area:
 *   1. proxy.ts     — redirects requests that carry no Supabase session.
 *   2. this layout  — confirms the session belongs to a profile with role=admin.
 *   3. RLS policies — the database itself refuses non-admin reads and writes.
 *
 * A signed-in non-admin is shown a message rather than redirected: proxy.ts
 * sends signed-in users away from the login page, so redirecting here would
 * put the two in an infinite loop.
 */
export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const access = await resolveAdminAccess();

  if (access.state === 'anonymous') redirect('/admin/login');
  if (access.state === 'forbidden') return <NoAdminAccess email={access.email} />;

  const { fullName, email } = access.context;
  return <AdminShell adminName={fullName ?? email ?? 'Administrator'}>{children}</AdminShell>;
}
