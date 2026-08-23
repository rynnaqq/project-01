/**
 * Pure helpers for username/password auth.
 *
 * Registered-only auth uses Supabase email/password under the hood. Since users
 * authenticate with a username (not an email), we map a username to a stable
 * synthetic email address in a reserved domain. This keeps Supabase Auth happy
 * while presenting a username-only experience to users.
 */
export const AUTH_EMAIL_DOMAIN = 'arcade.local';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export type UsernameValidation = { valid: true } | { valid: false; reason: string };

/** Validate a username against length and character rules. */
export function validateUsername(username: string): UsernameValidation {
  const trimmed = username.trim();
  if (trimmed.length < USERNAME_MIN) {
    return { valid: false, reason: `Username must be at least ${USERNAME_MIN} characters.` };
  }
  if (trimmed.length > USERNAME_MAX) {
    return { valid: false, reason: `Username must be at most ${USERNAME_MAX} characters.` };
  }
  if (!USERNAME_PATTERN.test(trimmed)) {
    return { valid: false, reason: 'Username may only contain letters, numbers, and underscores.' };
  }
  return { valid: true };
}

/** Validate a password. Minimal policy for a casual arcade. */
export function validatePassword(password: string): UsernameValidation {
  if (password.length < 6) {
    return { valid: false, reason: 'Password must be at least 6 characters.' };
  }
  return { valid: true };
}

/** Deterministically map a username to its synthetic login email. */
export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}
