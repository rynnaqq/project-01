/**
 * Pure logic for Terminal Cipher (P5.2) — grid sequence memory.
 *
 * Two modes share this module:
 *  - **Timed** (solo/party): each player advances their own rounds until the
 *    match clock runs out.
 *  - **Turn-based versus**: rounds are fixed time slices derived from the
 *    lifecycle's server-anchored `elapsedMs`, so every client independently
 *    computes the same round, the same active player, and — via a seeded RNG
 *    keyed on `matchId` + round — the *same sequence*. No extra infra needed.
 *
 * No module-level mutable state: sequences are always derived from inputs, so
 * nothing leaks between rounds, matches, or the other mini-games.
 */

/** Cells in the grid (3×3). Sequence entries are indices 0…GRID_CELLS-1. */
export const GRID_CELLS = 9;
/** Sequence length in round 0. */
export const START_LENGTH = 3;
/**
 * Cap for turn-based rounds: the round window is fixed, so an unbounded ramp
 * would quickly make playback longer than the whole turn.
 */
export const VERSUS_MAX_STEPS = 7;
/** Length of a turn-based round window. */
export const ROUND_MS = 9000;
/** Playback time per flashed step. */
export const STEP_FLASH_MS = 550;
/** Points awarded per correctly recalled step. */
export const POINTS_PER_STEP = 5;

export type ValidationResult = 'partial' | 'complete' | 'wrong';

// Seeded RNG lives in `lib/rng` because Typing Race needs the same primitives;
// re-exported here so this module stays the single import for the game.
import { hashSeed, makeRng } from '../../lib/rng';

export { hashSeed, makeRng };

/** Sequence length for a round (round 0 = START_LENGTH, +1 per round). */
export function sequenceLength(round: number): number {
  const safe = Number.isFinite(round) ? Math.max(0, Math.floor(round)) : 0;
  return START_LENGTH + safe;
}

/**
 * Build a sequence of grid indices. Consecutive repeats are avoided so playback
 * is always readable.
 */
export function generateSequence(
  length: number,
  rand: () => number = Math.random,
  cells: number = GRID_CELLS,
): number[] {
  const want = Number.isFinite(length) ? Math.max(0, Math.floor(length)) : 0;
  const size = Math.max(2, Math.floor(cells));
  const out: number[] = [];
  while (out.length < want) {
    const next = Math.min(size - 1, Math.floor(rand() * size));
    if (out.length > 0 && out[out.length - 1] === next) {
      // Nudge to the neighbouring cell instead of repeating.
      out.push((next + 1) % size);
    } else {
      out.push(next);
    }
  }
  return out;
}

/**
 * The sequence for a given round of a given match — identical on every client.
 * `matchId` may be null (offline/demo); the round still varies the seed.
 * `maxLength` caps the ramp (versus mode uses `VERSUS_MAX_STEPS` so playback
 * always fits inside the fixed turn window).
 */
export function sequenceForRound(
  matchId: string | null | undefined,
  round: number,
  opts: { maxLength?: number } = {},
): number[] {
  const safeRound = Number.isFinite(round) ? Math.max(0, Math.floor(round)) : 0;
  const want = Math.min(sequenceLength(safeRound), Math.max(1, Math.floor(opts.maxLength ?? Infinity)));
  const rng = makeRng(hashSeed(`${matchId ?? 'local'}#${safeRound}`));
  return generateSequence(want, rng);
}

/** Extend an existing sequence by one step (used by timed mode progression). */
export function extendSequence(
  sequence: number[],
  rand: () => number = Math.random,
  cells: number = GRID_CELLS,
): number[] {
  const size = Math.max(2, Math.floor(cells));
  let next = Math.min(size - 1, Math.floor(rand() * size));
  if (sequence.length > 0 && sequence[sequence.length - 1] === next) {
    next = (next + 1) % size;
  }
  return [...sequence, next];
}

/**
 * Compare the player's taps against the target sequence.
 * `partial` = correct so far, `complete` = fully matched, `wrong` = mismatch or
 * overlong input.
 */
export function validateInput(sequence: number[], input: number[]): ValidationResult {
  if (input.length > sequence.length) return 'wrong';
  for (let i = 0; i < input.length; i += 1) {
    if (input[i] !== sequence[i]) return 'wrong';
  }
  return input.length === sequence.length && sequence.length > 0 ? 'complete' : 'partial';
}

/** Score for clearing a round (longer sequences are worth more). */
export function pointsForRound(round: number): number {
  return sequenceLength(round) * POINTS_PER_STEP;
}

/** Total score after clearing rounds 0…roundsCleared-1. */
export function scoreForRounds(roundsCleared: number): number {
  const safe = Number.isFinite(roundsCleared) ? Math.max(0, Math.floor(roundsCleared)) : 0;
  let total = 0;
  for (let r = 0; r < safe; r += 1) total += pointsForRound(r);
  return total;
}

/** Turn-based mode: which round the match is in at `elapsedMs`. */
export function roundAt(elapsedMs: number, roundMs: number = ROUND_MS): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || roundMs <= 0) return 0;
  return Math.floor(elapsedMs / roundMs);
}

/** Ms left in the current turn-based round. */
export function roundRemainingMs(elapsedMs: number, roundMs: number = ROUND_MS): number {
  if (!Number.isFinite(elapsedMs) || roundMs <= 0) return 0;
  const into = Math.max(0, elapsedMs) % roundMs;
  return roundMs - into;
}

/** Turn-based mode: whose turn it is (round-robin over the stable roster). */
export function turnPlayerId(playerIds: string[], round: number): string | null {
  if (playerIds.length === 0) return null;
  const safeRound = Number.isFinite(round) ? Math.max(0, Math.floor(round)) : 0;
  return playerIds[safeRound % playerIds.length];
}

/** Convenience: is it this player's turn? */
export function isMyTurn(playerIds: string[], round: number, userId: string): boolean {
  return turnPlayerId(playerIds, round) === userId;
}

/** How long playback of a sequence takes. */
export function playbackMs(length: number, stepMs: number = STEP_FLASH_MS): number {
  const safe = Number.isFinite(length) ? Math.max(0, Math.floor(length)) : 0;
  return safe * Math.max(1, stepMs);
}

/**
 * Which step is lit during playback, or null once playback is over.
 * `sinceMs` is the time since playback started.
 */
export function playbackStep(
  sinceMs: number,
  length: number,
  stepMs: number = STEP_FLASH_MS,
): number | null {
  if (!Number.isFinite(sinceMs) || sinceMs < 0) return null;
  const step = Math.floor(sinceMs / Math.max(1, stepMs));
  return step < Math.max(0, Math.floor(length)) ? step : null;
}
