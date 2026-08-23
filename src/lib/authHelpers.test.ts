import { describe, expect, it } from 'vitest';
import {
  AUTH_EMAIL_DOMAIN,
  usernameToEmail,
  validatePassword,
  validateUsername,
} from './authHelpers';

describe('validateUsername', () => {
  it('accepts a valid username', () => {
    expect(validateUsername('player_1')).toEqual({ valid: true });
  });

  it('rejects too-short usernames', () => {
    expect(validateUsername('ab').valid).toBe(false);
  });

  it('rejects too-long usernames', () => {
    expect(validateUsername('a'.repeat(21)).valid).toBe(false);
  });

  it('rejects invalid characters', () => {
    expect(validateUsername('bad name!').valid).toBe(false);
  });
});

describe('validatePassword', () => {
  it('accepts a 6+ char password', () => {
    expect(validatePassword('secret')).toEqual({ valid: true });
  });

  it('rejects short passwords', () => {
    expect(validatePassword('12345').valid).toBe(false);
  });
});

describe('usernameToEmail', () => {
  it('lowercases and appends the reserved domain', () => {
    expect(usernameToEmail('PlayerOne')).toBe(`playerone@${AUTH_EMAIL_DOMAIN}`);
  });

  it('trims surrounding whitespace', () => {
    expect(usernameToEmail('  Neo  ')).toBe(`neo@${AUTH_EMAIL_DOMAIN}`);
  });
});
