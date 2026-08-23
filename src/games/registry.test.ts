import { describe, expect, it } from 'vitest';
import { GAMES } from '../lib/games';
import {
  FALLBACK_DURATION_MS,
  GAME_REGISTRY,
  getGameComponent,
  getGameDuration,
  isGameImplemented,
} from './registry';
import TapGame from './noop/TapGame';

describe('game registry', () => {
  it('only registers keys that exist in the catalog (plus the demo game)', () => {
    const catalogKeys = new Set(GAMES.map((g) => g.key));
    for (const key of Object.keys(GAME_REGISTRY)) {
      if (key === 'noop') continue;
      expect(catalogKeys.has(key)).toBe(true);
    }
  });

  it('resolves registered games and falls back for unknown keys', () => {
    expect(getGameComponent('math-duel')).toBe(GAME_REGISTRY['math-duel'].component);
    expect(getGameComponent('does-not-exist')).toBe(TapGame);
    expect(getGameComponent(null)).toBe(TapGame);
    expect(getGameComponent(undefined)).toBe(TapGame);
  });

  it('exposes a positive duration for every entry and a fallback otherwise', () => {
    for (const [key, entry] of Object.entries(GAME_REGISTRY)) {
      expect(entry.durationMs).toBeGreaterThan(0);
      expect(getGameDuration(key)).toBe(entry.durationMs);
    }
    expect(getGameDuration('nope')).toBe(FALLBACK_DURATION_MS);
    expect(getGameDuration(null)).toBe(FALLBACK_DURATION_MS);
  });

  it('reports implementation status', () => {
    expect(isGameImplemented('math-duel')).toBe(true);
    expect(isGameImplemented('nope')).toBe(false);
    expect(isGameImplemented(null)).toBe(false);
  });
});
