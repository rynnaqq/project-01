import { describe, expect, it } from 'vitest';
import { filterGames } from './gameFilters';
import { GAMES } from './games';

describe('filterGames', () => {
  it('returns all games when both filters are "All"', () => {
    expect(filterGames(GAMES, { mode: 'All', category: 'All' })).toHaveLength(GAMES.length);
  });

  it('filters by mode', () => {
    const solo = filterGames(GAMES, { mode: 'Solo', category: 'All' });
    expect(solo.every((g) => g.modes.includes('Solo'))).toBe(true);
    expect(solo.map((g) => g.key)).toContain('math-duel');
    expect(solo.map((g) => g.key)).not.toContain('typing-race');
  });

  it('filters by category', () => {
    const puzzle = filterGames(GAMES, { mode: 'All', category: 'Puzzle' });
    expect(puzzle.map((g) => g.key)).toEqual(['terminal-cipher']);
  });

  it('combines mode and category filters', () => {
    const speed1v1 = filterGames(GAMES, { mode: '1v1', category: 'Speed' });
    expect(speed1v1.map((g) => g.key).sort()).toEqual(['math-duel', 'typing-race']);
  });

  it('returns empty when nothing matches (e.g. Trivia)', () => {
    expect(filterGames(GAMES, { mode: 'All', category: 'Trivia' })).toHaveLength(0);
  });
});
