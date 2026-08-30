// space-sim/core/input.ts
const TOUCH_SENSITIVITY = 1.6; // finger drags are smaller arcs than mouse sweeps
const TAP_MAX_MS = 300;        // anything longer is a drag, not a tap
const TAP_MAX_PX = 8;          // ...and so is anything that moved further than this

export class InputManager {
  private keys = new Set<string>();
  private dx = 0; private dy = 0;
  private holdSpace = 0;
  private escapeCbs: Array<() => void> = [];
  private interactCbs: Array<() => void> = [];
  locked = false;
  /** Touch-drag look-around is only active when the player rig is live AND on a coarse pointer. */
  touchLookActive = false;
  // Touch-drag tracking (only meaningful when touchLookActive is true)
  private touchActive = false;
  private touchLastX = 0;
  private touchLastY = 0;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartT = 0;
  private touchMoved = false;

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

    // Touch look-around fallback: pointer lock is desktop-only, so on coarse-pointer
    // devices we route single-finger drag deltas into the same dx/dy that mouseDelta
    // exposes. The director still drives the cinematic camera (touchLookActive is
    // gated by the player rig in main.ts), so this only affects the zero-G leg.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse) this.wireTouch();
  }

  private wireTouch(): void {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch") return;
      this.touchActive = true;
      this.touchLastX = e.clientX; this.touchLastY = e.clientY;
      this.touchStartX = e.clientX; this.touchStartY = e.clientY;
      this.touchStartT = performance.now();
      this.touchMoved = false;
      // Capture so we keep getting moves even if the finger leaves the canvas
      try { c.setPointerCapture(e.pointerId); } catch { /* best effort */ }
    });
    c.addEventListener("pointermove", (e) => {
      if (!this.touchActive || e.pointerType !== "touch") return;
      // movementX/Y on touch is unreliable across browsers — derive from client delta.
      const dx = e.clientX - this.touchLastX;
      const dy = e.clientY - this.touchLastY;
      this.touchLastX = e.clientX; this.touchLastY = e.clientY;
      if (Math.abs(e.clientX - this.touchStartX) > TAP_MAX_PX || Math.abs(e.clientY - this.touchStartY) > TAP_MAX_PX) {
        this.touchMoved = true;
      }
      if (this.touchLookActive) {
        this.dx += dx * TOUCH_SENSITIVITY;
        this.dy += dy * TOUCH_SENSITIVITY;
      }
    });
    const endTouch = (e: PointerEvent): void => {
      if (!this.touchActive || e.pointerType !== "touch") return;
      this.touchActive = false;
      try { c.releasePointerCapture(e.pointerId); } catch { /* best effort */ }
      // Tap = short + didn't move: fire the interact callback (the E-tap equivalent)
      if (!this.touchMoved && performance.now() - this.touchStartT < TAP_MAX_MS) {
        this.interactCbs.forEach((cb) => cb());
      }
    };
    c.addEventListener("pointerup", endTouch);
    c.addEventListener("pointercancel", endTouch);
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
