// space-sim/ui/subtitles.ts
import type { CommsLine } from "../mission/engine";

export class Subtitles {
  private el: HTMLDivElement;
  private current: CommsLine | null = null;
  private hold = 0;
  private reveal = 0;

  constructor(root: HTMLElement) {
    this.el = document.createElement("div");
    this.el.className = "subtitles";
    this.el.style.display = "none";
    root.appendChild(this.el);
  }

  show(c: CommsLine): void {
    this.current = c;
    this.hold = 6;
    this.reveal = 0;
    this.el.style.display = "block";
  }

  update(dt: number): void {
    if (!this.current) return;
    this.reveal = Math.min(this.current.text.length, this.reveal + dt * 45);
    this.hold -= dt;
    if (this.hold <= 0) {
      this.current = null;
      this.el.style.display = "none";
      return;
    }
    const speaker = `<span class="speaker">${this.current.speaker}:</span>`;
    this.el.innerHTML = speaker + this.current.text.slice(0, Math.floor(this.reveal));
  }
}
