/**
 * Pure game lifecycle state machine.
 *
 * A match is described by a `GamePlan` whose timestamps are in server-epoch
 * milliseconds. Every client computes the current phase from a (clock-skew
 * corrected) "now", so all clients agree on the countdown and end time without
 * a central tick authority.
 *
 * Timeline:
 *   [countdownStartAt] --countdownMs--> [activeAt] --durationMs--> [endAt]
 *        countdown                          active                  results
 */
export type GamePhase = 'lobby' | 'countdown' | 'active' | 'results';

export type GamePlan = {
  gameKey: string;
  /** Id of the persisted match this plan corresponds to (for score reporting). */
  matchId: string | null;
  /** Server epoch ms when the countdown begins. */
  countdownStartAt: number;
  countdownMs: number;
  durationMs: number;
};

export type LifecycleState = {
  phase: GamePhase;
  /** Ms remaining in the current timed phase (countdown/active); 0 otherwise. */
  remainingMs: number;
  /** Ms elapsed since the active phase began (0 before active). */
  elapsedMs: number;
};

export function activeAt(plan: GamePlan): number {
  return plan.countdownStartAt + plan.countdownMs;
}

export function endAt(plan: GamePlan): number {
  return activeAt(plan) + plan.durationMs;
}

/** Compute the lifecycle state at time `now` (server-corrected epoch ms). */
export function phaseAt(now: number, plan: GamePlan | null | undefined): LifecycleState {
  if (!plan) {
    return { phase: 'lobby', remainingMs: 0, elapsedMs: 0 };
  }
  const start = activeAt(plan);
  const finish = endAt(plan);

  if (now < start) {
    return { phase: 'countdown', remainingMs: Math.max(0, start - now), elapsedMs: 0 };
  }
  if (now < finish) {
    return { phase: 'active', remainingMs: Math.max(0, finish - now), elapsedMs: now - start };
  }
  return { phase: 'results', remainingMs: 0, elapsedMs: plan.durationMs };
}

/** Build a plan starting `leadMs` from the given server-now reference. */
export function buildPlan(
  gameKey: string,
  serverNow: number,
  opts: { leadMs?: number; countdownMs?: number; durationMs: number; matchId?: string | null },
): GamePlan {
  const { leadMs = 500, countdownMs = 3000, durationMs, matchId = null } = opts;
  return {
    gameKey,
    matchId,
    countdownStartAt: serverNow + leadMs,
    countdownMs,
    durationMs,
  };
}

/** Safely extract a GamePlan from a room's `rules` jsonb, if present/valid. */
export function parseGamePlan(rules: unknown): GamePlan | null {
  if (!rules || typeof rules !== 'object') return null;
  const raw = (rules as Record<string, unknown>).game_plan;
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (
    typeof p.gameKey === 'string' &&
    typeof p.countdownStartAt === 'number' &&
    typeof p.countdownMs === 'number' &&
    typeof p.durationMs === 'number'
  ) {
    return {
      gameKey: p.gameKey,
      matchId: typeof p.matchId === 'string' ? p.matchId : null,
      countdownStartAt: p.countdownStartAt,
      countdownMs: p.countdownMs,
      durationMs: p.durationMs,
    };
  }
  return null;
}
