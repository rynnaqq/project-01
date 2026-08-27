export type CountdownPhase = 'READY' | 'COUNTING' | 'LIFTOFF';

interface CountdownOptions {
  ticks?: number;
  tickMs?: number;
  now?: () => number;
}

export class CountdownTimer {
  private readonly ticks: number;
  private readonly tickMs: number;
  private readonly nowFn: () => number;
  private startedAt: number | null = null;
  private lastValue: number | null = null;
  private phaseValue: CountdownPhase = 'READY';
  private readonly tickCbs = new Set<(value: number) => void>();
  private readonly liftoffCbs = new Set<() => void>();

  constructor(options: CountdownOptions = {}) {
    this.ticks = options.ticks ?? 10;
    this.tickMs = options.tickMs ?? 1000;
    this.nowFn = options.now ?? (() => performance.now());
  }

  onTick(cb: (value: number) => void): void {
    this.tickCbs.add(cb);
  }

  onLiftoff(cb: () => void): void {
    this.liftoffCbs.add(cb);
  }

  get phase(): CountdownPhase {
    return this.phaseValue;
  }

  get value(): number | null {
    return this.lastValue;
  }

  start(): void {
    this.startedAt = this.nowFn();
    this.lastValue = null;
    this.phaseValue = 'COUNTING';
  }

  update(): number | null {
    if (this.startedAt === null) return null;
    if (this.phaseValue === 'LIFTOFF') return 0;
    const elapsed = this.nowFn() - this.startedAt;
    const raw = Math.ceil((this.ticks * this.tickMs - elapsed) / this.tickMs);
    const value = Math.min(this.ticks, Math.max(0, raw));
    if (value !== this.lastValue) {
      this.lastValue = value;
      this.tickCbs.forEach((cb) => cb(value));
    }
    if (value === 0) {
      this.phaseValue = 'LIFTOFF';
      this.liftoffCbs.forEach((cb) => cb());
    }
    return value;
  }
}
