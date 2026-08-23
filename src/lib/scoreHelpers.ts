/** Pure helpers for scoring (client-trusted, lightly validated). */

export const MAX_SCORE = 1_000_000;

/** Clamp/normalise a reported score to a safe non-negative integer. */
export function clampScore(raw: number): number {
  if (Number.isNaN(raw)) return 0;
  if (raw === Infinity) return MAX_SCORE;
  if (raw === -Infinity) return 0;
  const n = Math.floor(raw);
  if (n < 0) return 0;
  if (n > MAX_SCORE) return MAX_SCORE;
  return n;
}

export type ScoreLike = { player_id: string; score: number };

/**
 * Determine the winning player id from a set of scores (highest wins).
 * Returns null on an empty set or an exact tie for first place.
 */
export function computeWinner(scores: ScoreLike[]): string | null {
  if (scores.length === 0) return null;
  let best: ScoreLike | null = null;
  let tie = false;
  for (const s of scores) {
    if (!best || s.score > best.score) {
      best = s;
      tie = false;
    } else if (s.score === best.score) {
      tie = true;
    }
  }
  return best && !tie ? best.player_id : null;
}

/** Sort scores descending for scoreboard display (stable on ties by player_id). */
export function rankScores<T extends ScoreLike>(scores: T[]): T[] {
  return [...scores].sort((a, b) => b.score - a.score || a.player_id.localeCompare(b.player_id));
}
