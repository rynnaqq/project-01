/**
 * Contract between the synced game lifecycle (P4.1) and the individual
 * mini-games (Phase 5).
 *
 * A game component is mounted only during the `active` phase and unmounted when
 * the phase changes, which keeps per-game state isolated between matches and
 * between games (no shared mutable state anywhere in this layer).
 *
 * Timing always comes from the lifecycle (server-anchored), never from a local
 * timer, so every client sees the same clock.
 */

/** A live scoreboard row, flattened for game components. */
export type GamePlayerScore = {
  playerId: string;
  username: string | null;
  avatar: string | null;
  score: number;
};

export type GameComponentProps = {
  /** Current player's id (used for score reporting). */
  userId: string;
  /**
   * Id of the persisted match, or null if none was opened. Games may use it as
   * a shared seed so every client derives identical content.
   */
  matchId: string | null;
  /** Ms elapsed since the active phase started (server-corrected). */
  elapsedMs: number;
  /** Ms left in the match (server-corrected). */
  remainingMs: number;
  /** Total match length in ms. */
  durationMs: number;
  /** Number of players in the room (1 = solo, 2 = 1v1, 3+ = party). */
  playerCount: number;
  /**
   * Turn order for versus modes: the roster's player ids, stable across
   * clients (ordered by join time).
   */
  playerIds: string[];
  /** Live scores for the match, highest first (drives in-game progress bars). */
  scores: GamePlayerScore[];
  /** Publish an absolute score for this player (client-trusted, clamped). */
  reportScore: (score: number) => void;
};
