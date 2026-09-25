'use client';

import { createBrowserClient } from '@supabase/ssr';

/** Browser client used only for admin sign-in/sign-out. Uses the public anon key. */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase environment variables are missing.');
  }

  return createBrowserClient(url, anonKey);
}
