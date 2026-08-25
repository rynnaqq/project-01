import { describe, expect, it } from 'vitest';
import { applyKey, emptyInput, keyAction } from './input';

describe('keyAction', () => {
  it('maps discrete keys to actions', () => {
    expect(keyAction('Escape')).toBe('pause');
    expect(keyAction('KeyF')).toBe('assist');
    expect(keyAction('KeyC')).toBe('recenter');
    expect(keyAction('Enter')).toBe('dock');
    expect(keyAction('KeyW')).toBeNull();
  });
});

describe('applyKey', () => {
  it('sets and clears continuous axes (PRD §C.5)', () => {
    const s = emptyInput();
    expect(applyKey('KeyW', true, s)).toBe(true);
    expect(s.forward).toBe(1);
    applyKey('KeyW', false, s);
    expect(s.forward).toBe(0);

    applyKey('Space', true, s); expect(s.up).toBe(1);
    applyKey('ShiftLeft', true, s); expect(s.down).toBe(1);
    applyKey('KeyA', true, s); expect(s.left).toBe(1);
    applyKey('KeyD', true, s); expect(s.right).toBe(1);
    applyKey('KeyS', true, s); expect(s.backward).toBe(1);
    applyKey('KeyQ', true, s); expect(s.roll).toBe(-1);
    applyKey('KeyE', true, s); expect(s.roll).toBe(1);
    applyKey('KeyR', true, s); expect(s.brake).toBe(true);
    applyKey('KeyR', false, s); expect(s.brake).toBe(false);
  });
  it('accepts arrow keys as movement aliases', () => {
    const s = emptyInput();
    applyKey('ArrowUp', true, s); expect(s.forward).toBe(1);
    applyKey('ArrowLeft', true, s); expect(s.left).toBe(1);
  });
  it('returns false for unhandled keys', () => {
    const s = emptyInput();
    expect(applyKey('KeyZ', true, s)).toBe(false);
  });
});
