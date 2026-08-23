import { describe, expect, it } from 'vitest';
import { activeAt, buildPlan, endAt, phaseAt, type GamePlan } from './gameLifecycle';

const plan: GamePlan = {
  gameKey: 'noop',
  matchId: null,
  countdownStartAt: 1_000_000,
  countdownMs: 3000,
  durationMs: 10_000,
};

describe('phaseAt', () => {
  it('is lobby with no plan', () => {
    expect(phaseAt(123, null).phase).toBe('lobby');
  });

  it('is countdown before active time', () => {
    const s = phaseAt(activeAt(plan) - 1500, plan);
    expect(s.phase).toBe('countdown');
    expect(s.remainingMs).toBe(1500);
  });

  it('is active during the play window', () => {
    const s = phaseAt(activeAt(plan) + 4000, plan);
    expect(s.phase).toBe('active');
    expect(s.elapsedMs).toBe(4000);
    expect(s.remainingMs).toBe(6000);
  });

  it('is active exactly at start', () => {
    expect(phaseAt(activeAt(plan), plan).phase).toBe('active');
  });

  it('is results at/after end', () => {
    expect(phaseAt(endAt(plan), plan).phase).toBe('results');
    expect(phaseAt(endAt(plan) + 5000, plan).phase).toBe('results');
  });
});

describe('buildPlan', () => {
  it('anchors countdown ahead of server-now and sets durations', () => {
    const p = buildPlan('math-duel', 500_000, { leadMs: 200, countdownMs: 3000, durationMs: 8000 });
    expect(p.countdownStartAt).toBe(500_200);
    expect(activeAt(p)).toBe(503_200);
    expect(endAt(p)).toBe(511_200);
    expect(p.gameKey).toBe('math-duel');
  });

  it('two clients with different local clocks agree on phase using server time', () => {
    // Same server-anchored plan evaluated at the same *server* instant yields
    // the same phase regardless of each client's local Date.now().
    const serverInstant = activeAt(plan) + 2000;
    const clientAOffset = 4000; // client A clock is 4s ahead
    const clientBOffset = -2500; // client B clock is 2.5s behind
    const a = phaseAt(serverInstant - clientAOffset + clientAOffset, plan);
    const b = phaseAt(serverInstant - clientBOffset + clientBOffset, plan);
    expect(a.phase).toBe('active');
    expect(b.phase).toBe('active');
    expect(a.remainingMs).toBe(b.remainingMs);
  });
});
