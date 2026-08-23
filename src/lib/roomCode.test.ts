import { describe, expect, it } from 'vitest';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from './roomCode';

describe('generateRoomCode', () => {
  it('produces a code of the configured length', () => {
    expect(generateRoomCode()).toHaveLength(ROOM_CODE_LENGTH);
  });

  it('only uses characters from the alphabet', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateRoomCode();
      for (const ch of code) {
        expect(ROOM_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it('passes its own validity check', () => {
    for (let i = 0; i < 100; i += 1) {
      expect(isValidRoomCode(generateRoomCode())).toBe(true);
    }
  });

  it('has reasonable entropy (few collisions across many samples)', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 5000; i += 1) codes.add(generateRoomCode());
    // Expect essentially no collisions in 5000 samples over a ~887M space.
    expect(codes.size).toBeGreaterThan(4990);
  });
});

describe('isValidRoomCode', () => {
  it('accepts 6 uppercase alphanumerics', () => {
    expect(isValidRoomCode('ABC234')).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(isValidRoomCode('ABC23')).toBe(false);
    expect(isValidRoomCode('ABC2345')).toBe(false);
  });

  it('rejects lowercase and symbols', () => {
    expect(isValidRoomCode('abc234')).toBe(false);
    expect(isValidRoomCode('ABC-23')).toBe(false);
  });
});

describe('normalizeRoomCode', () => {
  it('uppercases and trims', () => {
    expect(normalizeRoomCode('  abc234 ')).toBe('ABC234');
  });
});
