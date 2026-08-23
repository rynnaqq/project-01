import { describe, expect, it } from 'vitest';
import { AVATARS, getAvatar } from './avatars';

describe('getAvatar', () => {
  it('resolves a known avatar id', () => {
    expect(getAvatar('avatar-05').label).toBe('Fox');
  });

  it('falls back to the default for unknown ids', () => {
    expect(getAvatar('does-not-exist')).toEqual(AVATARS[0]);
  });

  it('falls back to the default for null/undefined', () => {
    expect(getAvatar(null)).toEqual(AVATARS[0]);
    expect(getAvatar(undefined)).toEqual(AVATARS[0]);
  });

  it('has unique avatar ids', () => {
    const ids = new Set(AVATARS.map((a) => a.id));
    expect(ids.size).toBe(AVATARS.length);
  });
});
