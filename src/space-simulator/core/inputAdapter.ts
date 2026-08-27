import type { InputState } from '../gameplay/docking';

const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'];
const LOOK_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export class InputManager {
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

  flashlightToggled = false;
  private readonly keys = new Set<string>();
  private readonly removers: Array<() => void> = [];

  // Touch virtual inputs
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchMoveZ = 0;
  private touchLookX = 0;
  private touchLookY = 0;
  private touchBoost = false;
  private touchBrake = false;
  private touchInteract = false;

  attach(): void {
    const onKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (MOVE_KEYS.includes(e.code) || LOOK_KEYS.includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === 'KeyF') {
        this.flashlightToggled = !this.flashlightToggled;
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

  setTouchMove(x: number, y: number, z: number): void {
    this.touchMoveX = x;
    this.touchMoveY = y;
    this.touchMoveZ = z;
  }

  setTouchLook(x: number, y: number): void {
    this.touchLookX = x;
    this.touchLookY = y;
  }

  setTouchButtons(boost: boolean, brake: boolean, interact: boolean): void {
    this.touchBoost = boost;
    this.touchBrake = brake;
    this.touchInteract = interact;
  }

  toggleFlashlight(): void {
    this.flashlightToggled = !this.flashlightToggled;
  }

  poll(): InputState {
    const k = this.keys;
    const s = this.state;

    // Keyboard inputs
    const kbMoveX = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    const kbMoveY = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
    const kbMoveZ = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const kbLookX = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0);
    const kbLookY = (k.has('ArrowDown') ? 1 : 0) - (k.has('ArrowUp') ? 1 : 0);
    const kbBoost = k.has('ShiftLeft') || k.has('ShiftRight');
    const kbBrake = k.has('ControlLeft') || k.has('ControlRight') || k.has('KeyX');
    const kbInteract = k.has('KeyE') || k.has('Space') || k.has('Enter');

    // Combine keyboard and touch
    s.moveX = kbMoveX !== 0 ? kbMoveX : this.touchMoveX;
    s.moveY = kbMoveY !== 0 ? kbMoveY : this.touchMoveY;
    s.moveZ = kbMoveZ !== 0 ? kbMoveZ : this.touchMoveZ;
    s.lookX = kbLookX !== 0 ? kbLookX : this.touchLookX;
    s.lookY = kbLookY !== 0 ? kbLookY : this.touchLookY;
    s.boost = kbBoost || this.touchBoost;
    s.brake = kbBrake || this.touchBrake;
    s.interact = kbInteract || this.touchInteract;

    return s;
  }

  detach(): void {
    this.removers.forEach((off) => off());
    this.removers.length = 0;
    this.keys.clear();
  }
}

// Backward compatibility alias
export { InputManager as KeyboardMouseInput };
