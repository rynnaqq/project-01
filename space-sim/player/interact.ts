// space-sim/player/interact.ts
import { Vector3, type Mesh, type Scene, type UniversalCamera } from "@babylonjs/core";

interface Interactable { mesh: Mesh; label: string; onUse: () => void }

const REACH = 2.5;
const PUSH_DURATION = 1.5;
const PUSH_MAX = 0.7;
const PUSH_CLEARANCE = 0.55;
const CAPTION_TIME = 2.6;

export class InteractionSystem {
  private target: Interactable | null = null;
  private entries: Interactable[] = [];
  private prompt: HTMLDivElement;
  private caption: HTMLDivElement;
  private captionTimer = 0;
  private push: { dir: Vector3; dist: number; t: number } | null = null;

  constructor(private scene: Scene, private camera: UniversalCamera, root: HTMLElement) {
    this.prompt = document.createElement("div");
    this.prompt.className = "interact-prompt";
    this.prompt.style.display = "none";
    root.appendChild(this.prompt);
    this.caption = document.createElement("div");
    this.caption.className = "interact-caption";
    this.caption.style.display = "none";
    root.appendChild(this.caption);
  }

  register(mesh: Mesh, label: string, onUse: () => void): void {
    this.entries.push({ mesh, label, onUse });
  }

  /** Timed status line below the prompt (interaction feedback). */
  showCaption(text: string): void {
    this.caption.textContent = text;
    this.caption.style.display = "block";
    this.captionTimer = CAPTION_TIME;
  }

  /** Short eased camera push toward `target` (clone live positions before calling), then return. */
  pushToward(target: Vector3): void {
    if (this.push) return;
    const to = target.subtract(this.camera.position);
    const dist = Math.min(PUSH_MAX, to.length() - PUSH_CLEARANCE);
    if (dist <= 0.05) return;
    this.push = { dir: to.normalize(), dist, t: 0 };
  }

  update(): void {
    const dt = Math.min(0.05, this.scene.getEngine().getDeltaTime() / 1000);
    // Center-screen ray, 2.5 m reach
    const ray = this.scene.createPickingRay(
      this.scene.getEngine().getRenderWidth() / 2,
      this.scene.getEngine().getRenderHeight() / 2,
      null,
      this.camera,
    );
    ray.length = REACH;
    const pick = this.scene.pickWithRay(ray, (m) => this.entries.some((e) => e.mesh === m || m.name.startsWith(e.mesh.name)));
    const found = pick?.pickedMesh
      ? this.entries.find((e) => pick.pickedMesh === e.mesh || pick.pickedMesh!.name.startsWith(e.mesh.name)) ?? null
      : null;
    this.target = found;
    if (found) {
      this.prompt.style.display = "block";
      this.prompt.textContent = `[E] ${found.label}`;
    } else {
      this.prompt.style.display = "none";
    }
    if (this.captionTimer > 0) {
      this.captionTimer -= dt;
      if (this.captionTimer <= 0) this.caption.style.display = "none";
    }
    // Applied after the controller writes the base camera position: sin^2 bell
    // eases in and out, returning the offset to zero at the end of the push.
    if (this.push) {
      this.push.t += dt;
      const phase = Math.min(1, this.push.t / PUSH_DURATION);
      const d = this.push.dist * Math.sin(Math.PI * phase) ** 2;
      this.camera.position.addInPlaceFromFloats(this.push.dir.x * d, this.push.dir.y * d, this.push.dir.z * d);
      if (phase >= 1) this.push = null;
    }
  }

  use(): void { this.target?.onUse(); }

  dispose(): void { this.prompt.remove(); this.caption.remove(); }
}
