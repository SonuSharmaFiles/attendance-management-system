import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { firstIssueMessage } from '@/lib/validation/schemas';
import { AppError } from '@/lib/errors';

/**
 * A single place to turn anything thrown inside a route handler into a safe
 * JSON response.
 */

export { AppError, describeDbError } from '@/lib/errors';

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function handleRouteError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
) {
  if (error instanceof ZodError) {
    return jsonError(firstIssueMessage(error), 422);
  }
  if (error instanceof AppError) {
    return jsonError(error.message, error.status);
  }
  console.error('[attendance] unhandled route error:', error);
  return jsonError(fallback, 500);
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError('Invalid request body.', 400);
  }
}
