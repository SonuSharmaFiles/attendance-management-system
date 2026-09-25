'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Shown when somebody is signed in to Supabase but their profile is not an
 * admin. Deliberately a page rather than a redirect: bouncing them to the login
 * page would send them straight back here, forever.
 */
export function NoAdminAccess({ email }: { email: string | null }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <main id="main" className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <Logo size={56} className="mx-auto h-14 w-auto" />
        <ShieldAlert aria-hidden className="mx-auto mt-6 h-8 w-8 text-absent" />
        <h1 className="mt-3 text-xl font-bold text-navy-900">Administrator access required</h1>
        <p className="mt-2 text-sm text-slate-600">
          {email ? (
            <>
              You are signed in as <span className="font-medium text-slate-800">{email}</span>, but
              this account has not been granted administrator access.
            </>
          ) : (
            'This account has not been granted administrator access.'
          )}
        </p>

        <div className="mt-6 space-y-2">
          <Button fullWidth onClick={signOut}>
            Sign in with a different account
          </Button>
          <Link
            href="/"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-navy-800 hover:bg-slate-50"
          >
            Back to the main page
          </Link>
        </div>
      </div>
    </main>
  );
}
