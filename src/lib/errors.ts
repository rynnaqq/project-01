/**
 * Central mapping from raw backend/network error strings to short, friendly,
 * actionable user-facing messages (P6.1). Pure and unit-tested; UI layers call
 * this before rendering or toasting an error.
 */

export const FALLBACK_ERROR_MESSAGE = 'Something went wrong. Please try again.';
export const OFFLINE_ERROR_MESSAGE =
  'You appear to be offline. Check your connection and try again.';
export const SESSION_EXPIRED_MESSAGE = 'Your session expired — please log in again.';

type Rule = { test: RegExp; message: string };

const RULES: Rule[] = [
  // Network / connectivity
  {
    test: /failed to fetch|networkerror|load failed|network request failed|err_internet|fetch failed/i,
    message: OFFLINE_ERROR_MESSAGE,
  },
  // Supabase auth
  { test: /invalid login credentials/i, message: 'Wrong username or password.' },
  { test: /user already registered|already exists/i, message: 'That username is taken.' },
  { test: /email not confirmed/i, message: 'Please confirm your account before logging in.' },
  {
    test: /database error saving new user|error creating user|signup requires a valid/i,
    message: 'Could not create the account. Please try a different username.',
  },
  {
    test: /rate limit|too many requests|over_request_rate_limit/i,
    message: 'Too many attempts — wait a moment and try again.',
  },
  { test: /\bjwt\b|token.*expired|invalid claim|session.*expired/i, message: SESSION_EXPIRED_MESSAGE },
  // Postgres / RLS
  { test: /duplicate key|unique constraint/i, message: 'That username is taken.' },
  { test: /row-level security|permission denied|not authorized/i, message: "You don't have permission to do that." },
  { test: /violates foreign key/i, message: 'That record no longer exists.' },
];

/**
 * Translate any raw error (Supabase message, network TypeError text, etc.) into
 * a friendly sentence. Unknown or empty input falls back to a generic message;
 * already-friendly strings pass through untouched.
 */
export function friendlyMessage(
  raw: string | null | undefined,
  fallback: string = FALLBACK_ERROR_MESSAGE,
): string {
  if (!raw || raw.trim() === '') return fallback;
  const text = raw.trim();
  for (const rule of RULES) {
    if (rule.test.test(text)) return rule.message;
  }
  // Already human-readable (our own lib errors) — keep them.
  const core = text.endsWith('.') ? text.slice(0, -1) : text;
  if (/^[A-Z0-9]/.test(core) && !/[_.]|failed:|error:/i.test(core) && core.length < 160) {
    return `${core}.`;
  }
  return fallback;
}
