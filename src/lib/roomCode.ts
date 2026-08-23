/**
 * Room code generation.
 *
 * Codes are 6 characters from an unambiguous uppercase alphanumeric alphabet
 * (letters/digits that are easy to read and hard to confuse). This matches the
 * `rooms.code` CHECK constraint (`^[A-Z0-9]{6}$`).
 */
export const ROOM_CODE_LENGTH = 6;

// Excludes ambiguous characters: 0/O, 1/I, and similar look-alikes are removed
// to reduce transcription errors when players share codes verbally.
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;

/** Cryptographically-random integers in [0, max). Falls back to Math.random. */
function randomIndex(max: number): number {
  const g = globalThis.crypto;
  if (g && typeof g.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    // Rejection sampling to avoid modulo bias.
    const limit = Math.floor(0xffffffff / max) * max;
    let x = 0;
    do {
      g.getRandomValues(buf);
      x = buf[0];
    } while (x >= limit);
    return x % max;
  }
  return Math.floor(Math.random() * max);
}

/** Generate a single random room code. */
export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += ROOM_CODE_ALPHABET[randomIndex(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** Validate that a string is a well-formed room code. */
export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_PATTERN.test(code);
}

/** Normalize user input into canonical room-code form (upper, trimmed). */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase();
}
