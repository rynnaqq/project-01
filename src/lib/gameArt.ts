/** Gradient tile classes per game key, shared by cards across the hub. */
const GAME_TILE_GRADIENTS: Record<string, string> = {
  'math-duel': 'from-violet-500 to-fuchsia-500',
  'terminal-cipher': 'from-cyan-500 to-blue-600',
  'typing-race': 'from-rose-500 to-orange-500',
};

export function gameTileGradient(gameKey: string | null | undefined): string {
  return (gameKey && GAME_TILE_GRADIENTS[gameKey]) || 'from-violet-500 to-cyan-500';
}
