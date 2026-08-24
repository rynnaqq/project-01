/** Central mini-game catalog and taxonomy (shared by the hub and engine). */

export type GameMode = 'Solo' | '1v1' | 'Party';
export type GameCategory = 'Puzzle' | 'Speed' | 'Trivia';

export type GameDefinition = {
  key: string;
  title: string;
  tagline: string;
  category: GameCategory;
  modes: GameMode[];
  /** Short bullet list previewing the mechanics/rules. */
  mechanics: string[];
};

export const GAMES: GameDefinition[] = [
  {
    key: 'math-duel',
    title: 'Quick Math Duel',
    tagline: 'Solve arithmetic faster than your rival.',
    category: 'Speed',
    modes: ['Solo', '1v1'],
    mechanics: [
      'Answer as many problems as you can before time runs out.',
      'Solo: beat the AI benchmark. 1v1: highest score wins.',
      'Wrong answers cost you a small time penalty.',
    ],
  },
  {
    key: 'terminal-cipher',
    title: 'Terminal Cipher',
    tagline: 'Memorise the grid, crack the code.',
    category: 'Puzzle',
    modes: ['Solo', '1v1', 'Party'],
    mechanics: [
      'A sequence flashes on a grid. Reproduce it from memory.',
      'Each round adds one more step to the sequence.',
      'Timed mode or turn-based versus mode.',
    ],
  },
  {
    key: 'typing-race',
    title: 'Typing Race',
    tagline: 'Type the passage first to win.',
    category: 'Speed',
    modes: ['1v1', 'Party'],
    mechanics: [
      'Race to type a shared passage accurately.',
      'Live progress bars show every racer’s position.',
      'Accuracy matters. Mistakes slow you down.',
    ],
  },
];

/** Look up a game definition by key. */
export function getGame(key: string): GameDefinition | undefined {
  return GAMES.find((g) => g.key === key);
}

export const ALL_MODES: GameMode[] = ['Solo', '1v1', 'Party'];
export const ALL_CATEGORIES: GameCategory[] = ['Puzzle', 'Speed', 'Trivia'];
