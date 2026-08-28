/**
 * Unified input abstraction (PRD §15).
 * Produces a single InputState consumed by all gameplay.
 */

export interface InputState {
  moveX: number; // -1..1
  moveY: number; // -1..1
  moveZ: number; // -1..1
  lookX: number; // -1..1
  lookY: number; // -1..1
  boost: boolean;
  brake: boolean;
  interact: boolean;
  skip: boolean;
}

type KeyMap = Record<string, keyof InputState>;

const KB_MAP: KeyMap = {
  KeyW: 'moveZ',
  KeyS: 'moveZ',
  KeyA: 'moveX',
  KeyD: 'moveX',
  ShiftLeft: 'boost',
  ControlLeft: 'brake',
  Space: 'moveY',
  KeyQ: 'moveY',
  KeyE: 'interact',
  Escape: 'skip',
};

export class InputManager {
  state: InputState = {
    moveX: 0,
    moveY: 0,
    moveZ: 0,
    lookX: 0,
    lookY: 0,
    boost: false,
    brake: false,
    interact: false,
    skip: false,
  };

  private pointerLocked = false;
  private touchLeft: { id: number; x: number; y: number } | null = null;
  private touchRight: { id: number; x: number; y: number } | null = null;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('touchstart', this.onTouchStart, { passive: false });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd);
    window.addEventListener('click', this.requestPointerLock);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('click', this.requestPointerLock);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const action = KB_MAP[e.code];
    if (!action) return;
    if (action === 'moveZ') this.state.moveZ = e.code === 'KeyW' ? 1 : -1;
    else if (action === 'moveX') this.state.moveX = e.code === 'KeyA' ? -1 : 1;
    else if (action === 'moveY') this.state.moveY = e.code === 'Space' ? 1 : -1;
    else if (action === 'boost') this.state.boost = true;
    else if (action === 'brake') this.state.brake = true;
    else if (action === 'interact') this.state.interact = true;
    else if (action === 'skip') this.state.skip = true;

    if (['moveX', 'moveY', 'moveZ'].includes(action)) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const action = KB_MAP[e.code];
    if (!action) return;
    if (action === 'moveZ') this.state.moveZ = 0;
    else if (action === 'moveX') this.state.moveX = 0;
    else if (action === 'moveY') this.state.moveY = 0;
    else if (action === 'boost') this.state.boost = false;
    else if (action === 'brake') this.state.brake = false;
    else if (action === 'interact') this.state.interact = false;
    else if (action === 'skip') this.state.skip = false;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    const sensitivity = 0.002;
    this.state.lookX = -e.movementX * sensitivity;
    this.state.lookY = -e.movementY * sensitivity;
  };

  private requestPointerLock = (): void => {
    if (document.pointerLockElement === null) {
      const canvas = document.getElementById('space-canvas');
      canvas?.requestPointerLock?.();
    }
  };

  // Touch: left half = translation, right half = rotation
  private onTouchStart = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) {
      const half = t.clientX < window.innerWidth / 2 ? 'left' : 'right';
      if (half === 'left') {
        this.touchLeft = { id: t.identifier, x: t.clientX, y: t.clientY };
      } else {
        this.touchRight = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const isLeft = t.clientX < window.innerWidth / 2;
      const touch = isLeft ? this.touchLeft : this.touchRight;
      if (!touch || touch.id !== t.identifier) continue;
      const dx = t.clientX - touch.x;
      const dy = t.clientY - touch.y;
      if (isLeft) {
        this.state.moveX = Math.max(-1, Math.min(1, dx / 50));
        this.state.moveZ = Math.max(-1, Math.min(1, -dy / 50));
      } else {
        this.state.lookX = -dx * 0.003;
        this.state.lookY = -dy * 0.003;
      }
      touch.x = t.clientX;
      touch.y = t.clientY;
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) {
      if (this.touchLeft?.id === t.identifier) {
        this.touchLeft = null;
        this.state.moveX = 0;
        this.state.moveZ = 0;
      }
      if (this.touchRight?.id === t.identifier) {
        this.touchRight = null;
        this.state.lookX = 0;
        this.state.lookY = 0;
      }
    }
  };

  /** Clear look deltas each frame after reading. */
  clearLook(): void {
    this.state.lookX = 0;
    this.state.lookY = 0;
  }
}
