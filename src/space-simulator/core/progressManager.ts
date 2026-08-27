export type CheckpointId =
  | 'CHECKPOINT_LAUNCH'
  | 'CHECKPOINT_ORBIT'
  | 'CHECKPOINT_DOCKED'
  | 'CHECKPOINT_ISS'
  | 'CHECKPOINT_CUPOLA';

export interface MissionProgress {
  lastCheckpoint: CheckpointId;
  dockingCompleted: boolean;
  issExplorationCompleted: boolean;
  cupolaViewed: boolean;
  flightTimeSec: number;
}

export interface SimpleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
  clear?(): void;
}

const STORAGE_KEY = 'space_sim_mission_progress_v1';

const DEFAULT_PROGRESS: MissionProgress = {
  lastCheckpoint: 'CHECKPOINT_LAUNCH',
  dockingCompleted: false,
  issExplorationCompleted: false,
  cupolaViewed: false,
  flightTimeSec: 0,
};

export class ProgressManager {
  private progress: MissionProgress;
  private readonly storage: SimpleStorage | null;

  constructor(storage?: SimpleStorage) {
    if (storage) {
      this.storage = storage;
    } else if (typeof window !== 'undefined' && window.localStorage) {
      this.storage = window.localStorage;
    } else {
      this.storage = null;
    }
    this.progress = this.load();
  }

  load(): MissionProgress {
    try {
      if (!this.storage) {
        return { ...DEFAULT_PROGRESS };
      }
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_PROGRESS };
      return { ...DEFAULT_PROGRESS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_PROGRESS };
    }
  }

  save(): void {
    try {
      if (this.storage) {
        this.storage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
      }
    } catch {
      // ignore storage errors
    }
  }

  get(): Readonly<MissionProgress> {
    return this.progress;
  }

  setCheckpoint(checkpoint: CheckpointId): void {
    this.progress.lastCheckpoint = checkpoint;
    if (checkpoint === 'CHECKPOINT_DOCKED') {
      this.progress.dockingCompleted = true;
    } else if (checkpoint === 'CHECKPOINT_ISS' || checkpoint === 'CHECKPOINT_CUPOLA') {
      this.progress.dockingCompleted = true;
      this.progress.issExplorationCompleted = true;
      if (checkpoint === 'CHECKPOINT_CUPOLA') {
        this.progress.cupolaViewed = true;
      }
    }
    this.save();
  }

  addFlightTime(dtSec: number): void {
    this.progress.flightTimeSec += dtSec;
    this.save();
  }

  reset(): void {
    this.progress = { ...DEFAULT_PROGRESS };
    this.save();
  }
}
