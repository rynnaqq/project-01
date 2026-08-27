import { describe, expect, it } from 'vitest';
import { ProgressManager } from './progressManager';

describe('ProgressManager', () => {

  it('starts with default launch progress', () => {
    const pm = new ProgressManager();
    const p = pm.getProgress();
    expect(p.lastCheckpoint).toBe('CHECKPOINT_LAUNCH');
    expect(p.missionCompleted).toBe(false);
    expect(p.checkpointsUnlocked).toContain('CHECKPOINT_LAUNCH');
  });

  it('updates checkpoint and persists completion flags', () => {
    const pm = new ProgressManager();
    pm.reachCheckpoint('CHECKPOINT_DOCKING');
    expect(pm.getProgress().lastCheckpoint).toBe('CHECKPOINT_DOCKING');
    expect(pm.getProgress().checkpointsUnlocked).toContain('CHECKPOINT_DOCKING');

    pm.reachCheckpoint('CHECKPOINT_ISS');
    expect(pm.getProgress().lastCheckpoint).toBe('CHECKPOINT_ISS');
    expect(pm.getProgress().checkpointsUnlocked).toContain('CHECKPOINT_ISS');
    expect(pm.getProgress().missionCompleted).toBe(true);

    const pm2 = new ProgressManager();
    expect(pm2.getProgress().checkpointsUnlocked).toContain('CHECKPOINT_ISS');
    expect(pm2.getProgress().missionCompleted).toBe(true);
  });

  it('resets progress cleanly', () => {
    const pm = new ProgressManager();
    pm.reachCheckpoint('CHECKPOINT_DOCKING');
    pm.resetProgress();
    expect(pm.getProgress().checkpointsUnlocked).toEqual(['CHECKPOINT_LAUNCH']);
    expect(pm.getProgress().lastCheckpoint).toBe('CHECKPOINT_LAUNCH');
    expect(pm.getProgress().missionCompleted).toBe(false);
  });

  it('records docking score', () => {
    const pm = new ProgressManager();
    pm.recordDockingScore(45.5, 12.3);
    expect(pm.getProgress().dockingBestTimeS).toBe(45.5);
    expect(pm.getProgress().dockingBestFuel).toBe(12.3);

    pm.recordDockingScore(38.2, 15.0);
    expect(pm.getProgress().dockingBestTimeS).toBe(38.2); // better time
    expect(pm.getProgress().dockingBestFuel).toBe(12.3); // keep best fuel
  });
});
