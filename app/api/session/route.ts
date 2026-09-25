import { NextResponse } from 'next/server';
import { lookupSchema } from '@/lib/validation/schemas';
import { verifyEmployeeCode } from '@/lib/employees/queries';
import {
  clearEmployeeSessionCookie,
  createSessionToken,
  setEmployeeSessionCookie,
} from '@/lib/auth/employee-session';
import { handleRouteError, jsonError, jsonOk, readJson } from '@/lib/http';
import { clientKey, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * POST /api/session — exchange a computer code for a signed session cookie.
 *
 * The lookup happens entirely on the server with the service-role key, so the
 * browser never receives a queryable handle on the employees table. Failures
 * return one generic message and are rate limited, so this endpoint cannot be
 * used to discover which computer codes exist.
 */
export async function POST(request: Request) {
  try {
    const limit = rateLimit(clientKey(request, 'session'), 10, 60_000);
    if (!limit.allowed) {
      return jsonError(
        `Too many attempts. Please wait ${limit.retryAfterSeconds} seconds and try again.`,
        429,
      );
    }

    const body = await readJson(request);
    const parsed = lookupSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Please enter a valid computer code.', 422);
    }

    const employee = await verifyEmployeeCode(parsed.data.computerCode);
    if (!employee) {
      // Deliberately identical wording for "no such code" and "deactivated".
      return jsonError('Computer code not found. Please check your code and try again.', 404);
    }

    const token = await createSessionToken({ sub: employee.id, code: employee.computer_code });
    await setEmployeeSessionCookie(token);

    return jsonOk({ computerCode: employee.computer_code });
  } catch (error) {
    return handleRouteError(error, 'Unable to sign in right now. Please try again.');
  }
}

/** DELETE /api/session — sign out. */
export async function DELETE() {
  await clearEmployeeSessionCookie();
  return NextResponse.json({ ok: true });
}
