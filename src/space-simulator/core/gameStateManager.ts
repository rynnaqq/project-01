export const GAME_STATES = [
  'IDLE_MENU',
  'SETTINGS',
  'LAUNCH_PAD',
  'ASCENT_CINEMATIC',
  'ORBIT_APPROACH',
  'DOCKING_MINIGAME',
  'ISS_EXPLORATION',
  'MISSION_COMPLETE',
] as const;

export type GameState = (typeof GAME_STATES)[number];

export type GameEvent =
  | 'START_MISSION'
  | 'OPEN_SETTINGS'
  | 'BACK'
  | 'INITIATE_LAUNCH'
  | 'EXIT_TO_MENU'
  | 'SKIP_CUTSCENE'
  | 'STAGE_SEPARATION_COMPLETE'
  | 'ISS_IN_RANGE'
  | 'ADJUST_DOCKING'
  | 'DOCK_RETRY'
  | 'DOCK_SUCCESS'
  | 'OBJECTIVES_COMPLETE'
  | 'RETURN_TO_MENU';

const TRANSITIONS: Record<GameState, Partial<Record<GameEvent, GameState>>> = {
  IDLE_MENU: { START_MISSION: 'LAUNCH_PAD', OPEN_SETTINGS: 'SETTINGS' },
  SETTINGS: { BACK: 'IDLE_MENU' },
  LAUNCH_PAD: {
    INITIATE_LAUNCH: 'ASCENT_CINEMATIC',
    EXIT_TO_MENU: 'IDLE_MENU',
  },
  ASCENT_CINEMATIC: {
    STAGE_SEPARATION_COMPLETE: 'ORBIT_APPROACH',
    SKIP_CUTSCENE: 'ORBIT_APPROACH',
  },
  ORBIT_APPROACH: { ISS_IN_RANGE: 'DOCKING_MINIGAME' },
  DOCKING_MINIGAME: {
    ADJUST_DOCKING: 'DOCKING_MINIGAME',
    DOCK_SUCCESS: 'ISS_EXPLORATION',
    DOCK_RETRY: 'ORBIT_APPROACH',
  },
  ISS_EXPLORATION: { OBJECTIVES_COMPLETE: 'MISSION_COMPLETE' },
  MISSION_COMPLETE: { RETURN_TO_MENU: 'IDLE_MENU' },
};

export function canTransition(state: GameState, event: GameEvent): boolean {
  return TRANSITIONS[state][event] !== undefined;
}

export function transition(state: GameState, event: GameEvent): GameState {
  const next = TRANSITIONS[state][event];
  if (!next) throw new Error(`Invalid game transition: ${state} + ${event}`);
  return next;
}
