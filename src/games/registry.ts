import type { ComponentType } from 'react';
import type { GameComponentProps } from './types';
import MathDuel from './mathDuel/MathDuel';
import TerminalCipher from './terminalCipher/TerminalCipher';
import TypingRace from './typingRace/TypingRace';
import TapGame from './noop/TapGame';

/**
 * Registry that plugs each mini-game into the shared lifecycle (P4.1).
 *
 * Keys match `src/lib/games.ts` (the catalog shown in the hub). Anything not
 * listed here falls back to the no-op tap game, so a room can never get stuck
 * on an unimplemented selection.
 *
 * Kept JSX-free (`.ts`) on purpose: the file exports lookup helpers rather than
 * components, which keeps `react-refresh/only-export-components` quiet.
 */
export type GameRegistryEntry = {
  component: ComponentType<GameComponentProps>;
  /** Match length used when the host starts this game. */
  durationMs: number;
};

export const FALLBACK_DURATION_MS = 15_000;

export const GAME_REGISTRY: Record<string, GameRegistryEntry> = {
  'math-duel': { component: MathDuel, durationMs: 60_000 },
  'terminal-cipher': { component: TerminalCipher, durationMs: 90_000 },
  'typing-race': { component: TypingRace, durationMs: 75_000 },
  noop: { component: TapGame, durationMs: FALLBACK_DURATION_MS },
};

/** Resolve the component for a game key (falls back to the no-op game). */
export function getGameComponent(gameKey: string | null | undefined): ComponentType<GameComponentProps> {
  return (gameKey && GAME_REGISTRY[gameKey]?.component) || TapGame;
}

/** Match duration for a game key (falls back to the demo duration). */
export function getGameDuration(gameKey: string | null | undefined): number {
  return (gameKey && GAME_REGISTRY[gameKey]?.durationMs) || FALLBACK_DURATION_MS;
}

/** True when a catalog entry has a playable implementation. */
export function isGameImplemented(gameKey: string | null | undefined): boolean {
  return Boolean(gameKey && gameKey in GAME_REGISTRY);
}
