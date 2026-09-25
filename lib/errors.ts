/**
 * Framework-free error helpers.
 *
 * Kept separate from lib/http.ts (which imports next/server) so the data and
 * parsing layers — and their tests — do not drag the web framework in with them.
 */

/** An error whose message is safe to show a user, with the status to send. */
export class AppError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

/**
 * Turns a Postgres/Supabase error into a sentence a user can act on.
 * Anything unrecognised is logged server-side and reported generically, so
 * database internals never reach the browser.
 */
export function describeDbError(error: { code?: string; message?: string } | null): string {
  if (!error) return 'Unexpected database response.';
  switch (error.code) {
    case '23505':
      return 'That record already exists.';
    case '23503':
      return 'The referenced record no longer exists.';
    case '23514':
      return 'The information provided is not valid.';
    case '42501':
      return 'You do not have permission to perform this action.';
    default:
      console.error('[attendance] database error:', error);
      return 'The database is unavailable right now. Please try again.';
  }
}
