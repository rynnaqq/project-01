/**
 * Mission progress persistence (PRD §18) using localStorage.
 * Pure logic with an injected storage so it is unit-testable.
 */

export interface MissionProgress {
  lastCheckpoint: 'CHECKPOINT_LAUNCH' | 'CHECKPOINT_ORBIT' | 'CHECKPOINT_DOCKED' | 'CHECKPOINT_ISS' | null;
  dockingCompleted: boolean;
  issExplorationCompleted: boolean;
}

export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const STORAGE_KEY = 'space-sim:progress';

export function defaultProgress(): MissionProgress {
  return { lastCheckpoint: null, dockingCompleted: false, issExplorationCompleted: false };
}

export function loadProgress(store: Store = localStorage): MissionProgress {
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as Partial<MissionProgress>;
    return {
      lastCheckpoint: parsed.lastCheckpoint ?? null,
      dockingCompleted: parsed.dockingCompleted ?? false,
      issExplorationCompleted: parsed.issExplorationCompleted ?? false,
    };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress: MissionProgress, store: Store = localStorage): void {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Private mode or quota; game remains playable without persistence.
  }
}