/**
 * Input abstraction (PRD §D.15): gameplay reads InputState, never the DOM.
 * Keyboard and touch providers both write into the same state object.
 */

import { TOUCH } from './config';

export interface InputState {
  forward: number; backward: number; left: number; right: number;
  up: number; down: number;
  pitch: number; yaw: number; roll: number;
  brake: boolean;
}

export const emptyInput = (): InputState => ({
  forward: 0, backward: 0, left: 0, right: 0, up: 0, down: 0,
  pitch: 0, yaw: 0, roll: 0, brake: false,
});

export type InputAction = 'pause' | 'assist' | 'recenter' | 'dock';

/** Discrete (keydown-once) actions. */
export function keyAction(code: string): InputAction | null {
  switch (code) {
    case 'Escape': return 'pause';
    case 'KeyF': return 'assist';
    case 'KeyC': return 'recenter';
    case 'Enter': return 'dock';
    default: return null;
  }
}

/** Continuous axes. Returns false for keys this layer doesn't own. */
export function applyKey(code: string, down: boolean, s: InputState): boolean {
  switch (code) {
    case 'KeyW': case 'ArrowUp': s.forward = down ? 1 : 0; return true;
    case 'KeyS': case 'ArrowDown': s.backward = down ? 1 : 0; return true;
    case 'KeyA': case 'ArrowLeft': s.left = down ? 1 : 0; return true;
    case 'KeyD': case 'ArrowRight': s.right = down ? 1 : 0; return true;
    case 'Space': s.up = down ? 1 : 0; return true;
    case 'ShiftLeft': case 'ShiftRight': s.down = down ? 1 : 0; return true;
    case 'KeyQ': s.roll = down ? -1 : 0; return true;
    case 'KeyE': s.roll = down ? 1 : 0; return true;
    case 'KeyR': s.brake = down; return true;
    default: return false;
  }
}

export type LookHandler = (dx: number, dy: number) => void;

const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** Keyboard + mouse-drag look on the canvas. Returns dispose(). */
export function createKeyboardInput(
  canvas: HTMLCanvasElement, state: InputState,
  onAction: (a: InputAction) => void, onLook: LookHandler,
): () => void {
  const down = (e: KeyboardEvent): void => {
    const action = keyAction(e.code);
    if (action) { if (!e.repeat) onAction(action); e.preventDefault(); return; }
    if (applyKey(e.code, true, state) && PREVENT.has(e.code)) e.preventDefault();
  };
  const up = (e: KeyboardEvent): void => { applyKey(e.code, false, state); };

  let dragging = false;
  let lastX = 0; let lastY = 0;
  const pdown = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') return; // touch pointers belong to createTouchInput
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };
  const pmove = (e: PointerEvent): void => {
    if (!dragging) return;
    onLook(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
  };
  const pup = (): void => { dragging = false; };

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  canvas.addEventListener('pointerdown', pdown);
  canvas.addEventListener('pointermove', pmove);
  canvas.addEventListener('pointerup', pup);
  canvas.addEventListener('pointercancel', pup);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    canvas.removeEventListener('pointerdown', pdown);
    canvas.removeEventListener('pointermove', pmove);
    canvas.removeEventListener('pointerup', pup);
    canvas.removeEventListener('pointercancel', pup);
  };
}

/**
 * Touch controls (PRD §C.6): left half = translation joystick,
 * right half = look drag; buttons wired by element id from index.html.
 * Returns dispose().
 */
export function createTouchInput(
  canvas: HTMLCanvasElement, state: InputState,
  onAction: (a: InputAction) => void, onLook: LookHandler,
): () => void {
  const cleanups: Array<() => void> = [];
  const joy = { id: -1, ox: 0, oy: 0 };
  const look = { id: -1, lx: 0, ly: 0 };
  const RANGE = TOUCH.joystickRangePx; // px for full joystick deflection

  const down = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return;
    if (e.clientX < window.innerWidth / 2 && joy.id < 0) {
      joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY;
    } else if (look.id < 0) {
      look.id = e.pointerId; look.lx = e.clientX; look.ly = e.clientY;
    }
  };
  const move = (e: PointerEvent): void => {
    if (e.pointerId === joy.id) {
      const clamp = (v: number): number => Math.max(-1, Math.min(1, v));
      state.right = clamp((e.clientX - joy.ox) / RANGE);
      state.forward = clamp((joy.oy - e.clientY) / RANGE);
    } else if (e.pointerId === look.id) {
      onLook(e.clientX - look.lx, e.clientY - look.ly);
      look.lx = e.clientX; look.ly = e.clientY;
    }
  };
  const up = (e: PointerEvent): void => {
    if (e.pointerId === joy.id) {
      joy.id = -1; state.right = 0; state.forward = 0;
    } else if (e.pointerId === look.id) {
      look.id = -1;
    }
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  cleanups.push(() => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
  });

  // Buttons: id → action / axis. Missing elements are skipped silently.
  const bindBtn = (id: string, fn: () => void): void => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', fn);
    cleanups.push(() => el.removeEventListener('click', fn));
  };
  bindBtn('btn-pause', () => onAction('pause'));
  bindBtn('btn-assist', () => onAction('assist'));
  bindBtn('btn-recenter', () => onAction('recenter'));
  bindBtn('btn-dock', () => onAction('dock'));
  const hold = (id: string, set: (v: boolean) => void): void => {
    const el = document.getElementById(id);
    if (!el) return;
    const on = (): void => set(true);
    const off = (): void => set(false);
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointerleave', off);
    cleanups.push(() => {
      el.removeEventListener('pointerdown', on);
      el.removeEventListener('pointerup', off);
      el.removeEventListener('pointerleave', off);
    });
  };
  hold('btn-up', (v) => { state.up = v ? 1 : 0; });
  hold('btn-down', (v) => { state.down = v ? 1 : 0; });
  hold('btn-brake', (v) => { state.brake = v; });

  return () => { cleanups.forEach((fn) => fn()); };
}
