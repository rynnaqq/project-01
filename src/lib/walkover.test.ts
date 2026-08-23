import { describe, expect, it } from 'vitest';
import { shouldAwardWalkover } from './walkover';

const base = {
  roomStatus: 'playing',
  matchId: 'match-1',
  rosterSize: 1,
  sawMultiplayer: true,
};

describe('shouldAwardWalkover', () => {
  it('fires when a multiplayer match drops to its last player', () => {
    expect(shouldAwardWalkover(base)).toBe(true);
  });

  it('does not fire while the match has not started', () => {
    expect(shouldAwardWalkover({ ...base, roomStatus: 'waiting' })).toBe(false);
    expect(shouldAwardWalkover({ ...base, roomStatus: 'finished' })).toBe(false);
    expect(shouldAwardWalkover({ ...base, roomStatus: null })).toBe(false);
  });

  it('does not fire without a persisted match', () => {
    expect(shouldAwardWalkover({ ...base, matchId: null })).toBe(false);
    expect(shouldAwardWalkover({ ...base, matchId: undefined })).toBe(false);
  });

  it('never fires for solo rooms that started with one player', () => {
    expect(shouldAwardWalkover({ ...base, sawMultiplayer: false })).toBe(false);
  });

  it('does not fire while opponents are still in the room', () => {
    expect(shouldAwardWalkover({ ...base, rosterSize: 2 })).toBe(false);
    expect(shouldAwardWalkover({ ...base, rosterSize: 4 })).toBe(false);
  });
});
