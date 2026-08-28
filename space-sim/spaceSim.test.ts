import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameStateMachine, type GameState } from './core/state';
import { Countdown } from './core/countdown';
import { sampleAscent, maxQ, ASCENT_DURATION_S } from './gameplay/trajectory';
import {
  DockingController,
  getDockingStatus,
  type DockingInput,
} from './gameplay/docking';
import { ZeroGController } from './gameplay/zeroG';
import { checkAABB, resolveCollisions, type BoundingBox } from './gameplay/collision';
import {
  loadProgress,
  saveProgress,
  defaultProgress,
  type Store,
} from './core/progress';
import { detectTier, getProfile, PROFILES } from './core/quality';

describe('Space Simulator — State Machine', () => {
  let gsm: GameStateMachine;

  beforeEach(() => {
    gsm = new GameStateMachine('IDLE_MENU');
  });

  it('initializes in IDLE_MENU', () => {
    expect(gsm.state).toBe('IDLE_MENU');
  });

  it('completes the full mission cycle', () => {
    const sequence: GameState[] = [
      'LAUNCH_PAD',
      'ASCENT',
      'ORBIT',
      'DOCKING',
      'ISS_EXPLORATION',
      'MISSION_COMPLETE',
      'IDLE_MENU',
    ];

    for (const next of sequence) {
      expect(gsm.transition(next)).toBe(true);
      expect(gsm.state).toBe(next);
    }
  });

  it('allows resuming at checkpoints from IDLE_MENU', () => {
    expect(gsm.transition('ORBIT')).toBe(true);
    expect(gsm.state).toBe('ORBIT');

    gsm.reset();
    expect(gsm.state).toBe('IDLE_MENU');

    expect(gsm.transition('DOCKING')).toBe(true);
    expect(gsm.state).toBe('DOCKING');
  });

  it('throws on illegal transitions', () => {
    gsm.transition('LAUNCH_PAD');
    expect(() => gsm.transition('ISS_EXPLORATION')).toThrow(/Illegal transition/);
  });

  it('notifies subscribers and allows unsubscription', () => {
    const log: string[] = [];
    const unsubscribe = gsm.onChange((next, prev) => {
      log.push(`${prev}->${next}`);
    });

    gsm.transition('LAUNCH_PAD');
    gsm.transition('ASCENT');
    unsubscribe();
    gsm.transition('ORBIT');

    expect(log).toEqual(['IDLE_MENU->LAUNCH_PAD', 'LAUNCH_PAD->ASCENT']);
  });
});

describe('Space Simulator — Countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('emits ticks and triggers liftoff at 0', () => {
    const cd = new Countdown(1000, 3);
    const ticks: number[] = [];
    let liftedOff = false;

    cd.onTick.add((v) => ticks.push(v));
    cd.onLiftoff.add(() => {
      liftedOff = true;
    });

    cd.start();
    expect(ticks).toEqual([3]);

    vi.advanceTimersByTime(1000);
    expect(ticks).toEqual([3, 2]);

    vi.advanceTimersByTime(1000);
    expect(ticks).toEqual([3, 2, 1]);

    vi.advanceTimersByTime(1000);
    expect(ticks).toEqual([3, 2, 1, 0]);
    expect(liftedOff).toBe(true);
    expect(cd.isRunning).toBe(false);
  });

  it('handles skip immediately', () => {
    const cd = new Countdown(1000, 10);
    let liftedOff = false;
    cd.onLiftoff.add(() => {
      liftedOff = true;
    });

    cd.start();
    cd.skip();

    expect(liftedOff).toBe(true);
    expect(cd.currentValue).toBe(0);
  });

  it('allows pause and reset', () => {
    const cd = new Countdown(1000, 5);
    cd.start();
    vi.advanceTimersByTime(2000);
    expect(cd.currentValue).toBe(3);

    cd.stop();
    expect(cd.isRunning).toBe(false);

    cd.reset();
    expect(cd.currentValue).toBe(5);
  });
});

describe('Space Simulator — Ascent Trajectory', () => {
  it('starts at zero altitude and velocity', () => {
    const t0 = sampleAscent(0);
    expect(t0.altitude).toBe(0);
    expect(t0.velocity).toBe(0);
    expect(t0.pitch).toBe(0);
    expect(t0.stage).toBe(1);
  });

  it('holds vertical pitch during early ascent', () => {
    const t5 = sampleAscent(5);
    expect(t5.pitch).toBe(0);
    expect(t5.altitude).toBeGreaterThan(0);
    expect(t5.velocity).toBeGreaterThan(0);
  });

  it('executes gravity turn and reaches orbital criteria at t=42s', () => {
    const t42 = sampleAscent(ASCENT_DURATION_S);
    expect(t42.altitude).toBeCloseTo(400_000, -2);
    expect(t42.velocity).toBeCloseTo(7660, -1);
    expect(t42.pitch).toBeCloseTo(90, 0);
    expect(t42.stage).toBe(2);
  });

  it('calculates Max-Q dynamic pressure bell curve peaking near ~20s', () => {
    const q10 = maxQ(10);
    const q20 = maxQ(20);
    const q35 = maxQ(35);

    expect(q20).toBeGreaterThan(q10);
    expect(q20).toBeGreaterThan(q35);
    expect(q20).toBeCloseTo(1.0, 1);
  });
});

describe('Space Simulator — Docking Simulation', () => {
  let docking: DockingController;

  const neutralInput: DockingInput = {
    moveX: 0,
    moveY: 0,
    moveZ: 0,
    pitch: 0,
    yaw: 0,
    roll: 0,
  };

  beforeEach(() => {
    docking = new DockingController('NORMAL');
  });

  it('starts at initial offset distance', () => {
    const state = docking.getState();
    expect(state.distance).toBeGreaterThan(40);
    expect(state.alignmentScore).toBeLessThan(100);
    expect(docking.isDocked).toBe(false);
  });

  it('responds to thruster translations and angular inputs', () => {
    const input: DockingInput = {
      ...neutralInput,
      moveZ: 1.0,
      pitch: -1.0,
    };

    const nextState = docking.step(input, 0.5);
    expect(nextState.relativeVelocity).toBeGreaterThan(0);
    expect(docking.rotation.pitch).toBeLessThan(4.5);
  });

  it('slows down under active braking', () => {
    docking.velocity = { x: 1.0, y: 1.0, z: 2.0 };
    const speedBefore = docking.getState().relativeVelocity;

    docking.step({ ...neutralInput, brake: true }, 0.5);
    const speedAfter = docking.getState().relativeVelocity;

    expect(speedAfter).toBeLessThan(speedBefore);
  });

  it('evaluates status correctly (UNSAFE, CORRECTING, READY, LOCKED)', () => {
    const unsafeState = {
      distance: 30,
      relativeVelocity: 2.5,
      transverseError: 5,
      pitchError: 10,
      yawError: 10,
      rollError: 10,
      alignmentScore: 20,
    };
    expect(getDockingStatus(unsafeState)).toBe('UNSAFE');

    const correctingState = {
      distance: 10,
      relativeVelocity: 0.5,
      transverseError: 1.0,
      pitchError: 5,
      yawError: 5,
      rollError: 2,
      alignmentScore: 70,
    };
    expect(getDockingStatus(correctingState)).toBe('CORRECTING');

    const readyState = {
      distance: 1.2,
      relativeVelocity: 0.1,
      transverseError: 0.2,
      pitchError: 1.0,
      yawError: 1.0,
      rollError: 1.0,
      alignmentScore: 95,
    };
    expect(getDockingStatus(readyState)).toBe('READY');
  });

  it('locks when within capture parameters', () => {
    docking.position = { x: 0.1, y: 0.1, z: -1.0 };
    docking.velocity = { x: 0, y: 0, z: 0.05 };
    docking.rotation = { pitch: 0.5, yaw: 0.5, roll: 0.5 };

    docking.step(neutralInput, 0.1);
    expect(docking.isDocked).toBe(true);
    expect(docking.position).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('Space Simulator — Zero-G Locomotion', () => {
  let zeroG: ZeroGController;

  beforeEach(() => {
    zeroG = new ZeroGController();
  });

  it('translates forward in camera view direction', () => {
    const viewDir = { x: 0, y: 0, z: 1 };
    const delta = zeroG.step({ moveX: 0, moveY: 0, moveZ: 1 }, viewDir, 0.1);

    expect(delta.z).toBeGreaterThan(0);
    expect(delta.x).toBe(0);
  });

  it('applies drag damping when input is released', () => {
    const viewDir = { x: 0, y: 0, z: 1 };
    zeroG.step({ moveX: 0, moveY: 0, moveZ: 1 }, viewDir, 0.5);
    const speed1 = Math.abs(zeroG.velocity.z);

    zeroG.step({ moveX: 0, moveY: 0, moveZ: 0 }, viewDir, 0.5);
    const speed2 = Math.abs(zeroG.velocity.z);

    expect(speed2).toBeLessThan(speed1);
  });

  it('caps max speed', () => {
    const viewDir = { x: 1, y: 0, z: 0 };
    for (let i = 0; i < 20; i++) {
      zeroG.step({ moveX: 0, moveY: 0, moveZ: 1 }, viewDir, 0.5);
    }

    const currentSpeed = Math.sqrt(
      zeroG.velocity.x ** 2 + zeroG.velocity.y ** 2 + zeroG.velocity.z ** 2
    );
    expect(currentSpeed).toBeLessThanOrEqual(2.5001);
  });
});

describe('Space Simulator — AABB Collision Resolution', () => {
  const wallBox: BoundingBox = {
    min: { x: -2, y: -2, z: 5 },
    max: { x: 2, y: 2, z: 6 },
  };

  it('detects no collision when boxes do not overlap', () => {
    const playerBox: BoundingBox = {
      min: { x: -0.5, y: -0.5, z: 0 },
      max: { x: 0.5, y: 0.5, z: 1 },
    };

    const res = checkAABB(playerBox, wallBox);
    expect(res.collided).toBe(false);
  });

  it('detects collision and pushes player out along MTV normal', () => {
    const initialPos = { x: 0, y: 0, z: 4.8 };
    const adjustedPos = resolveCollisions(initialPos, [wallBox], 0.35);

    expect(adjustedPos.z).toBeLessThan(4.8); // pushed back away from wall
  });
});

describe('Space Simulator — Progress & Quality', () => {
  it('returns default progress when storage is empty', () => {
    const mockStore: Store = {
      getItem: () => null,
      setItem: vi.fn(),
    };

    const prog = loadProgress(mockStore);
    expect(prog).toEqual(defaultProgress());
  });

  it('persists and recovers checkpoints', () => {
    const storage: Record<string, string> = {};
    const mockStore: Store = {
      getItem: (k) => storage[k] ?? null,
      setItem: (k, v) => {
        storage[k] = v;
      },
    };

    saveProgress(
      {
        lastCheckpoint: 'CHECKPOINT_ORBIT',
        dockingCompleted: true,
        issExplorationCompleted: false,
      },
      mockStore
    );

    const loaded = loadProgress(mockStore);
    expect(loaded.lastCheckpoint).toBe('CHECKPOINT_ORBIT');
    expect(loaded.dockingCompleted).toBe(true);
  });

  it('loads valid profiles for all quality tiers', () => {
    expect(getProfile('HIGH')).toEqual(PROFILES.HIGH);
    expect(getProfile('MEDIUM')).toEqual(PROFILES.MEDIUM);
    expect(getProfile('LOW')).toEqual(PROFILES.LOW);
    expect(detectTier()).toBeDefined();
  });
});
