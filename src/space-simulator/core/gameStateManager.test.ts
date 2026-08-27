import { describe, expect, it } from 'vitest';
import {
  canTransition,
  transition,
  type GameEvent,
  type GameState,
} from './gameStateManager';

describe('transition', () => {
  it('walks the primary mission flow from PRD section 2.2', () => {
    const path: Array<[GameEvent, GameState]> = [
      ['START_MISSION', 'LAUNCH_PAD'],
      ['INITIATE_LAUNCH', 'ASCENT_CINEMATIC'],
      ['STAGE_SEPARATION_COMPLETE', 'ORBIT_APPROACH'],
      ['ISS_IN_RANGE', 'DOCKING_MINIGAME'],
      ['DOCK_SUCCESS', 'ISS_EXPLORATION'],
      ['OBJECTIVES_COMPLETE', 'MISSION_COMPLETE'],
    ];
    let state: GameState = 'IDLE_MENU';
    for (const [event, expected] of path) {
      state = transition(state, event);
      expect(state).toBe(expected);
    }
  });

  it('round-trips through settings', () => {
    expect(transition('IDLE_MENU', 'OPEN_SETTINGS')).toBe('SETTINGS');
    expect(transition('SETTINGS', 'BACK')).toBe('IDLE_MENU');
  });

  it('allows exiting the launch pad back to the menu', () => {
    expect(transition('LAUNCH_PAD', 'EXIT_TO_MENU')).toBe('IDLE_MENU');
  });

  it('skips the cutscene straight to orbit approach', () => {
    expect(transition('ASCENT_CINEMATIC', 'SKIP_CUTSCENE')).toBe(
      'ORBIT_APPROACH',
    );
  });

  it('self-loops docking adjustments', () => {
    expect(transition('DOCKING_MINIGAME', 'ADJUST_DOCKING')).toBe(
      'DOCKING_MINIGAME',
    );
  });

  it('returns a failed docking attempt to orbit approach', () => {
    expect(transition('DOCKING_MINIGAME', 'DOCK_RETRY')).toBe(
      'ORBIT_APPROACH',
    );
  });

  it('returns mission complete to the idle menu', () => {
    expect(transition('MISSION_COMPLETE', 'RETURN_TO_MENU')).toBe('IDLE_MENU');
  });

  it('rejects transitions that are not in the PRD diagram', () => {
    expect(canTransition('IDLE_MENU', 'DOCK_SUCCESS')).toBe(false);
    expect(() => transition('IDLE_MENU', 'DOCK_SUCCESS')).toThrow(/invalid/i);
    expect(() => transition('SETTINGS', 'START_MISSION')).toThrow(/invalid/i);
  });
});
