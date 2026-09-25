import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. This key bypasses Row Level Security, so it must
 * never reach the browser. Every module that imports this file is server-only
 * (route handlers and server components); the guard below turns an accidental
 * client import into a loud error instead of a silent key leak.
 */
if (typeof window !== 'undefined') {
  throw new Error('lib/supabase/admin.ts must never be imported from client code.');
}

let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
