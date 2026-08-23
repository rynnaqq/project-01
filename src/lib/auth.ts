import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { usernameToEmail } from './authHelpers';

export type AuthResult = { ok: true } | { ok: false; error: string };

/**
 * Check whether a username is free via the anon-callable RPC.
 * Returns true on availability; false if taken or on lookup error (fail-closed).
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('username_available', {
    p_username: username.trim(),
  });
  if (error) {
    console.error('username_available RPC failed:', error.message);
    return false;
  }
  return Boolean(data);
}

/** Register a new user with a username + password. */
export async function signUp(username: string, password: string): Promise<AuthResult> {
  const available = await isUsernameAvailable(username);
  if (!available) {
    return { ok: false, error: 'That username is already taken.' };
  }

  const { error } = await supabase.auth.signUp({
    email: usernameToEmail(username),
    password,
    options: {
      data: { username: username.trim() },
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Log in an existing user with a username + password. */
export async function signIn(username: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) {
    // Supabase returns a generic "Invalid login credentials" for wrong
    // username or password; surface a friendlier message.
    return { ok: false, error: 'Invalid username or password.' };
  }
  return { ok: true };
}

/** Sign the current user out. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Fetch the current session (if any). */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export type { Session, User };
