import { describe, expect, it } from 'vitest';
import {
  FALLBACK_ERROR_MESSAGE,
  OFFLINE_ERROR_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  friendlyMessage,
} from './errors';

describe('friendlyMessage', () => {
  it('maps auth failures', () => {
    expect(friendlyMessage('Invalid login credentials')).toBe('Wrong username or password.');
    expect(friendlyMessage('User already registered')).toBe('That username is taken.');
    expect(friendlyMessage('Email not confirmed')).toBe(
      'Please confirm your account before logging in.',
    );
  });

  it('maps network failures to the offline message', () => {
    expect(friendlyMessage('TypeError: Failed to fetch')).toBe(OFFLINE_ERROR_MESSAGE);
    expect(friendlyMessage('NetworkError when attempting to fetch resource.')).toBe(
      OFFLINE_ERROR_MESSAGE,
    );
  });

  it('maps rate limits and session problems', () => {
    expect(friendlyMessage('Too many requests, please try again later')).toMatch(/too many/i);
    expect(friendlyMessage('JWT expired')).toBe(SESSION_EXPIRED_MESSAGE);
    expect(friendlyMessage('Database error saving new user')).toMatch(/could not create/i);
  });

  it('maps database permission/duplicate errors', () => {
    expect(friendlyMessage('new row violates row-level security policy')).toBe(
      "You don't have permission to do that.",
    );
    expect(friendlyMessage('duplicate key value violates unique constraint')).toBe(
      'That username is taken.',
    );
  });

  it('passes through our own human-readable errors with a period', () => {
    expect(friendlyMessage('That room is full')).toBe('That room is full.');
    expect(friendlyMessage('No room found with that code.')).toBe(
      'No room found with that code.',
    );
  });

  it('falls back for empty or cryptic input', () => {
    expect(friendlyMessage(null)).toBe(FALLBACK_ERROR_MESSAGE);
    expect(friendlyMessage('')).toBe(FALLBACK_ERROR_MESSAGE);
    expect(friendlyMessage('   ')).toBe(FALLBACK_ERROR_MESSAGE);
    expect(friendlyMessage('PG::Something failed: x_y_42')).toBe(FALLBACK_ERROR_MESSAGE);
  });
});
