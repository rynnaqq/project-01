import { describe, expect, it } from 'vitest';
import { InputManager } from './inputAdapter';

describe('InputManager', () => {
  it('initializes with default zero inputs', () => {
    const input = new InputManager();
    const state = input.poll();
    expect(state.moveX).toBe(0);
    expect(state.moveY).toBe(0);
    expect(state.moveZ).toBe(0);
    expect(state.boost).toBe(false);
    expect(state.brake).toBe(false);
    expect(state.interact).toBe(false);
  });

  it('updates state via touch inputs correctly', () => {
    const input = new InputManager();
    input.setTouchMove(0.8, -0.5, 1.0);
    input.setTouchLook(0.4, -0.2);
    input.setTouchButtons(true, false, true);

    const s = input.poll();
    expect(s.moveX).toBe(0.8);
    expect(s.moveY).toBe(-0.5);
    expect(s.moveZ).toBe(1.0);
    expect(s.lookX).toBe(0.4);
    expect(s.lookY).toBe(-0.2);
    expect(s.boost).toBe(true);
    expect(s.brake).toBe(false);
    expect(s.interact).toBe(true);
  });

  it('toggles flashlight flag', () => {
    const input = new InputManager();
    expect(input.flashlightToggled).toBe(false);
    input.toggleFlashlight();
    expect(input.flashlightToggled).toBe(true);
    input.toggleFlashlight();
    expect(input.flashlightToggled).toBe(false);
  });
});
