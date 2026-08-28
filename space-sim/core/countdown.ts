/**
 * Event-driven countdown (PRD §5). Pure — emits ticks to subscribers.
 */

export class Countdown {
  private value: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  readonly onTick = new Set<(value: number) => void>();
  readonly onLiftoff = new Set<() => void>();

  constructor(
    private readonly intervalMs: number = 1000,
    private readonly startFrom: number = 10
  ) {
    this.value = startFrom;
  }

  get currentValue(): number {
    return this.value;
  }

  get isRunning(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer) return;
    this.emitTick();
    this.timer = setInterval(() => {
      this.value -= 1;
      if (this.value <= 0) {
        this.emitTick();
        this.stop();
        for (const fn of this.onLiftoff) fn();
        return;
      }
      this.emitTick();
    }, this.intervalMs);
  }

  skip(): void {
    this.stop();
    this.value = 0;
    this.emitTick();
    for (const fn of this.onLiftoff) fn();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  reset(): void {
    this.stop();
    this.value = this.startFrom;
  }

  private emitTick(): void {
    for (const fn of this.onTick) fn(this.value);
  }
}