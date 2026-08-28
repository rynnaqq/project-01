/**
 * Game state machine. Pure — no Babylon imports — so it is unit-testable.
 *
 * Flow per PRD §2: IDLE_MENU → LAUNCH_PAD → ASCENT → ORBIT → DOCKING →
 * ISS_EXPLORATION → MISSION_COMPLETE.
 */

export type GameState =
  | 'IDLE_MENU'
  | 'LAUNCH_PAD'
  | 'ASCENT'
  | 'ORBIT'
  | 'DOCKING'
  | 'ISS_EXPLORATION'
  | 'MISSION_COMPLETE';

const TRANSITIONS: Record<GameState, GameState[]> = {
  IDLE_MENU: ['LAUNCH_PAD', 'ORBIT', 'DOCKING', 'ISS_EXPLORATION', 'MISSION_COMPLETE'],
  LAUNCH_PAD: ['ASCENT', 'IDLE_MENU'],
  ASCENT: ['ORBIT', 'IDLE_MENU'],
  ORBIT: ['DOCKING', 'IDLE_MENU'],
  DOCKING: ['ISS_EXPLORATION', 'ORBIT', 'IDLE_MENU'],
  ISS_EXPLORATION: ['MISSION_COMPLETE', 'IDLE_MENU'],
  MISSION_COMPLETE: ['IDLE_MENU'],
};

export class GameStateMachine {
  private current: GameState = 'IDLE_MENU';
  private listeners: Array<(next: GameState, prev: GameState) => void> = [];

  constructor(initialState: GameState = 'IDLE_MENU') {
    this.current = initialState;
  }

  get state(): GameState {
    return this.current;
  }

  onChange(fn: (next: GameState, prev: GameState) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  transition(next: GameState): boolean {
    if (next === this.current) return false;
    const allowed = TRANSITIONS[this.current];
    if (!allowed || !allowed.includes(next)) {
      throw new Error(`Illegal transition: ${this.current} -> ${next}`);
    }
    const prev = this.current;
    this.current = next;
    for (const fn of this.listeners) fn(next, prev);
    return true;
  }

  reset(): void {
    const prev = this.current;
    this.current = 'IDLE_MENU';
    if (prev !== 'IDLE_MENU') {
      for (const fn of this.listeners) fn('IDLE_MENU', prev);
    }
  }
}