import type { InputState } from '../gameplay/docking';

const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'];
const LOOK_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export class KeyboardMouseInput {
  readonly state: InputState = {
    moveX: 0,
    moveY: 0,
    moveZ: 0,
    lookX: 0,
    lookY: 0,
    boost: false,
    brake: false,
    interact: false,
  };

  private readonly keys = new Set<string>();
  private readonly removers: Array<() => void> = [];

  attach(): void {
    const onKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (MOVE_KEYS.includes(e.code) || LOOK_KEYS.includes(e.code)) {
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    this.removers.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    });
  }

  poll(): InputState {
    const k = this.keys;
    const s = this.state;
    s.moveX = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    s.moveY = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
    s.moveZ = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    s.lookX = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0);
    s.lookY = (k.has('ArrowDown') ? 1 : 0) - (k.has('ArrowUp') ? 1 : 0);
    s.boost = k.has('ShiftLeft') || k.has('ShiftRight');
    s.brake =
      k.has('ControlLeft') || k.has('ControlRight') || k.has('KeyX');
    return s;
  }

  detach(): void {
    this.removers.forEach((off) => off());
    this.removers.length = 0;
    this.keys.clear();
  }
}
