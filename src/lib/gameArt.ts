/** Spectrum-band gradient tile classes per game key, shared by cards across the hub. */
const GAME_TILE_GRADIENTS: Record<string, string> = {
  'math-duel': 'from-fuchsia-500 to-rose-500',
  'terminal-cipher': 'from-cyan-400 to-blue-600',
  'typing-race': 'from-amber-400 to-orange-500',
};

export function gameTileGradient(gameKey: string | null | undefined): string {
  return (gameKey && GAME_TILE_GRADIENTS[gameKey]) || 'from-cyan-400 to-fuchsia-500';
}
