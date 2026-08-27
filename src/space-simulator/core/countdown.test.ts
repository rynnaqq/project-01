import { describe, expect, it } from 'vitest';
import { CountdownTimer } from './countdown';

function fakeClock() {
  let now = 0;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('CountdownTimer', () => {
  it('stays ready until started', () => {
    const c = new CountdownTimer({ now: () => 0 });
    expect(c.phase).toBe('READY');
    expect(c.value).toBeNull();
    expect(c.update()).toBeNull();
  });

  it('counts 10 to 0 then lifts off exactly once', () => {
    const clock = fakeClock();
    const c = new CountdownTimer({ now: clock.now });
    const ticks: number[] = [];
    let liftoffs = 0;
    c.onTick((v) => ticks.push(v));
    c.onLiftoff(() => {
      liftoffs += 1;
    });
    c.start();

    const returned: number[] = [];
    for (let i = 0; i <= 11; i += 1) {
      const v = c.update();
      if (v !== null) returned.push(v);
      clock.advance(1000);
    }

    expect(returned).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0]);
    expect(ticks).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    expect(c.phase).toBe('LIFTOFF');
    expect(liftoffs).toBe(1);
  });

  it('emits each tick value only once per window', () => {
    const clock = fakeClock();
    const c = new CountdownTimer({ now: clock.now });
    const ticks: number[] = [];
    c.onTick((v) => ticks.push(v));
    c.start();

    for (let i = 0; i < 4; i += 1) {
      c.update();
      clock.advance(300);
    }

    expect(ticks).toEqual([10]);
    expect(c.phase).toBe('COUNTING');
  });

  it('supports custom tick length and count', () => {
    const clock = fakeClock();
    const c = new CountdownTimer({ now: clock.now, ticks: 3, tickMs: 500 });
    const ticks: number[] = [];
    c.onTick((v) => ticks.push(v));
    c.start();

    for (let i = 0; i < 5; i += 1) {
      c.update();
      clock.advance(500);
    }

    expect(ticks).toEqual([3, 2, 1, 0]);
    expect(c.phase).toBe('LIFTOFF');
  });
});
