import type { Metadata } from 'next';
import { getAdminContext } from '@/lib/auth/admin';
import { AccountSettings } from '@/components/admin/AccountSettings';

export const metadata: Metadata = { title: 'My Account' };
export const dynamic = 'force-dynamic';

export default async function AdminAccountPage() {
  const admin = await getAdminContext();
  // The layout has already redirected if this is null; narrow for TypeScript.
  if (!admin) return null;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy-900 sm:text-2xl">My Account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Change the email address and password you use to sign in.
        </p>
      </div>

      <AccountSettings currentEmail={admin.email ?? 'unknown'} />
    </div>
  );
}
