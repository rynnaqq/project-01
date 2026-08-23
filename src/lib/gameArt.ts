/** Memphis duotone tile classes per game key, shared by cards across the hub. */
const GAME_TILE_GRADIENTS: Record<string, string> = {
  'math-duel': 'from-[#ff71ce] to-[#ffb03a]',
  'terminal-cipher': 'from-[#86ccca] to-[#6a7bb4]',
  'typing-race': 'from-[#ffce5c] to-[#ff71ce]',
};

export function gameTileGradient(gameKey: string | null | undefined): string {
  return (gameKey && GAME_TILE_GRADIENTS[gameKey]) || 'from-[#86ccca] to-[#ff71ce]';
}
