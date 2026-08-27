import { beforeEach, describe, expect, it } from 'vitest';
import { ProgressManager, type SimpleStorage } from './progressManager';

class MemoryStorage implements SimpleStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

describe('ProgressManager', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('starts with default launch progress', () => {
    const pm = new ProgressManager(storage);
    const p = pm.get();
    expect(p.lastCheckpoint).toBe('CHECKPOINT_LAUNCH');
    expect(p.dockingCompleted).toBe(false);
    expect(p.issExplorationCompleted).toBe(false);
  });

  it('updates checkpoint and persists completion flags', () => {
    const pm = new ProgressManager(storage);
    pm.setCheckpoint('CHECKPOINT_DOCKED');
    expect(pm.get().lastCheckpoint).toBe('CHECKPOINT_DOCKED');
    expect(pm.get().dockingCompleted).toBe(true);

    pm.setCheckpoint('CHECKPOINT_CUPOLA');
    expect(pm.get().cupolaViewed).toBe(true);
    expect(pm.get().issExplorationCompleted).toBe(true);

    const pm2 = new ProgressManager(storage);
    expect(pm2.get().cupolaViewed).toBe(true);
    expect(pm2.get().dockingCompleted).toBe(true);
  });

  it('resets progress cleanly', () => {
    const pm = new ProgressManager(storage);
    pm.setCheckpoint('CHECKPOINT_DOCKED');
    pm.reset();
    expect(pm.get().dockingCompleted).toBe(false);
    expect(pm.get().lastCheckpoint).toBe('CHECKPOINT_LAUNCH');
  });

  it('accumulates flight time', () => {
    const pm = new ProgressManager(storage);
    pm.addFlightTime(15);
    expect(pm.get().flightTimeSec).toBe(15);
    pm.addFlightTime(30);
    expect(pm.get().flightTimeSec).toBe(45);
  });
});
