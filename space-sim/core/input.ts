// space-sim/core/input.ts
export class InputManager {
  private keys = new Set<string>();
  private dx = 0; private dy = 0;
  private holdSpace = 0;
  private escapeCbs: Array<() => void> = [];
  private interactCbs: Array<() => void> = [];
  locked = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape") { this.escapeCbs.forEach((cb) => cb()); return; }
      if (e.code === "KeyE" && !e.repeat) { this.interactCbs.forEach((cb) => cb()); }
      if (e.code === "Space") e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "Space") this.holdSpace = 0;
    });
    window.addEventListener("blur", () => this.keys.clear());
    window.addEventListener("mousemove", (e) => {
      if (this.locked) { this.dx += e.movementX; this.dy += e.movementY; }
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
  }

  thrustVector(): { x: number; y: number; z: number } {
    const k = this.keys;
    return {
      x: (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0),
      y: (k.has("Space") ? 1 : 0) - (k.has("KeyC") ? 1 : 0),
      z: (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0),
    };
  }

  mouseDelta(): { dx: number; dy: number } {
    const d = { dx: this.dx, dy: this.dy };
    this.dx = 0; this.dy = 0;
    return d;
  }

  /** Hold-to-skip: returns true once per completed 0.7 s hold of SPACE. */
  consumeHoldSpace(dt: number): boolean {
    if (this.keys.has("Space")) {
      this.holdSpace += dt;
      if (this.holdSpace >= 0.7) { this.holdSpace = -1; return true; }
      return false;
    }
    this.holdSpace = 0;
    return false;
  }

  boostHeld(): boolean { return this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"); }

  onEscape(cb: () => void): void { this.escapeCbs.push(cb); }
  onInteract(cb: () => void): void { this.interactCbs.push(cb); }

  lockPointer(): void { this.canvas.requestPointerLock().catch(() => {}); }
  unlockPointer(): void { if (document.pointerLockElement) document.exitPointerLock(); }
}
