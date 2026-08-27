export type CheckpointId = 
  | 'CHECKPOINT_LAUNCH'
  | 'CHECKPOINT_ASCENT'
  | 'CHECKPOINT_ORBIT'
  | 'CHECKPOINT_DOCKING'
  | 'CHECKPOINT_ISS';

export interface MissionProgress {
  lastCheckpoint: CheckpointId | null;
  checkpointsUnlocked: CheckpointId[];
  dockingBestTimeS: number | null;
  dockingBestFuel: number | null;
  missionCompleted: boolean;
}

const STORAGE_KEY = 'space_simulator_progress_v2';

export class ProgressManager {
  private progress: MissionProgress;
  private onProgressUpdate?: (progress: MissionProgress) => void;

  constructor(onProgressUpdate?: (progress: MissionProgress) => void) {
    this.onProgressUpdate = onProgressUpdate;
    this.progress = this.loadProgress();
  }

  private loadProgress(): MissionProgress {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load mission progress', e);
    }
    
    // Default initial progress
    return {
      lastCheckpoint: 'CHECKPOINT_LAUNCH',
      checkpointsUnlocked: ['CHECKPOINT_LAUNCH'],
      dockingBestTimeS: null,
      dockingBestFuel: null,
      missionCompleted: false,
    };
  }

  private saveProgress(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
      if (this.onProgressUpdate) {
        this.onProgressUpdate({ ...this.progress });
      }
    } catch (e) {
      console.warn('Failed to save mission progress', e);
    }
  }

  public getProgress(): MissionProgress {
    return { ...this.progress };
  }

  public reachCheckpoint(id: CheckpointId): void {
    this.progress.lastCheckpoint = id;
    if (!this.progress.checkpointsUnlocked.includes(id)) {
      this.progress.checkpointsUnlocked.push(id);
    }
    // Completing ISS exploration marks the mission complete
    if (id === 'CHECKPOINT_ISS') {
      this.progress.missionCompleted = true;
    }
    this.saveProgress();
  }

  public completeMission(): void {
    this.progress.missionCompleted = true;
    this.saveProgress();
  }

  public recordDockingScore(timeS: number, fuelUsed: number): void {
    if (this.progress.dockingBestTimeS === null || timeS < this.progress.dockingBestTimeS) {
      this.progress.dockingBestTimeS = timeS;
    }
    if (this.progress.dockingBestFuel === null || fuelUsed < this.progress.dockingBestFuel) {
      this.progress.dockingBestFuel = fuelUsed;
    }
    this.saveProgress();
  }

  public resetProgress(): void {
    this.progress = {
      lastCheckpoint: 'CHECKPOINT_LAUNCH',
      checkpointsUnlocked: ['CHECKPOINT_LAUNCH'],
      dockingBestTimeS: null,
      dockingBestFuel: null,
      missionCompleted: false,
    };
    this.saveProgress();
  }
}
