import { cookies } from 'next/headers';
import { EMPLOYEE_SESSION_TTL_SECONDS } from '@/lib/config';
import { verifySessionToken, type EmployeeSession } from '@/lib/auth/session-token';

/**
 * Employee sessions (cookie layer).
 *
 * An employee proves who they are once, on the landing page, by entering their
 * computer code. The server then issues a tamper-proof cookie holding the
 * employee's database id. Every later request reads the id from that cookie —
 * never from the URL or the request body — so editing `/employee/NP99999` in
 * the address bar cannot reach another person's record.
 *
 * NOTE ON STRENGTH: a computer code is an identifier, not a password. The
 * "who is this?" decision is isolated in `verifyEmployeeCode`
 * (lib/employees/queries.ts), so a PIN, password or OTP check can be added
 * there later without touching anything else. See the README.
 */

export const EMPLOYEE_SESSION_COOKIE = 'emp_session';

export type { EmployeeSession };
export { createSessionToken, verifySessionToken } from '@/lib/auth/session-token';

const COOKIE_OPTIONS = {
  httpOnly: true, // unreadable from JavaScript, so XSS cannot steal it
  sameSite: 'lax' as const, // not sent on cross-site POSTs, blunting CSRF
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

/** Reads and verifies the session cookie on the current request. */
export async function getEmployeeSession(): Promise<EmployeeSession | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(EMPLOYEE_SESSION_COOKIE)?.value);
}

export async function setEmployeeSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(EMPLOYEE_SESSION_COOKIE, token, {
    ...COOKIE_OPTIONS,
    maxAge: EMPLOYEE_SESSION_TTL_SECONDS,
  });
}

export async function clearEmployeeSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(EMPLOYEE_SESSION_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
}
