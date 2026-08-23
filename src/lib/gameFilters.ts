import type { GameCategory, GameDefinition, GameMode } from './games';

export type GameFilter = {
  mode: GameMode | 'All';
  category: GameCategory | 'All';
};

/** Filter the catalog by mode and category. 'All' matches everything. */
export function filterGames(games: GameDefinition[], filter: GameFilter): GameDefinition[] {
  return games.filter((game) => {
    const modeOk = filter.mode === 'All' || game.modes.includes(filter.mode);
    const categoryOk = filter.category === 'All' || game.category === filter.category;
    return modeOk && categoryOk;
  });
}
