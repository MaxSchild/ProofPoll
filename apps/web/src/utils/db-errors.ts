import { UserFacingError } from '@/utils/user-facing-error';
import type { PostgrestError } from '@supabase/supabase-js';

const CHECK_VIOLATION = '23514';

/**
 * The database's own rules raise check_violation with messages written for
 * people (for example "The plan of an opened poll cannot be changed"); those
 * are shown as they are. Table CHECK constraints share the error code but
 * name internal constraints, so they get the generic message like any other
 * error, which is logged.
 */
export function toUserError(error: PostgrestError, fallback: string): Error {
  const isConstraintMessage =
    error.message.startsWith('new row for relation') ||
    error.message.includes('violates check constraint');
  if (error.code === CHECK_VIOLATION && !isConstraintMessage) {
    return new UserFacingError(error.message);
  }
  console.error('Database query failed:', error);
  return new UserFacingError(fallback);
}
