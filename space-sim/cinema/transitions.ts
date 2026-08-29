// space-sim/cinema/transitions.ts
export class TransitionLayer {
  private el: HTMLElement | null;
  constructor(root: HTMLElement) {
    this.el = document.getElementById("cine-fade") ?? root.querySelector<HTMLElement>("#cine-fade");
  }
  cut(kind: "cut" | "dip" | "crossfade"): void {
    const el = this.el;
    if (!el || kind === "cut") return;
    const dipMs = kind === "dip" ? 900 : 450;
    el.style.transition = "none";
    el.style.opacity = "1";
    void (el as HTMLElement).offsetWidth; // force reflow
    el.style.transition = `opacity ${dipMs}ms ease`;
    el.style.opacity = "0";
  }
}
