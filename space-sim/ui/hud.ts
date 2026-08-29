// space-sim/ui/hud.ts
export interface TelemetryView {
  range: number;
  closure: number;
  alignErrorDeg: number;
  phase: string;
}

const STAGES = [
  "01 LAUNCH PREPARATION",
  "02 ASCENT",
  "03 ORBIT",
  "04 ISS APPROACH",
  "05 DOCKING",
  "06 ISS EXPLORATION",
];

export class Hud {
  private phaseEl: HTMLDivElement;
  private metEl: HTMLDivElement;
  private teleEl: HTMLDivElement;
  private skipEl: HTMLDivElement;
  private stageEls: HTMLDivElement[] = [];
  private met = 0;
  private countingDown = false;
  private telemetry: TelemetryView | null = null;

  constructor(root: HTMLElement) {
    const wrap = document.createElement("div");
    wrap.className = "hud";
    this.phaseEl = document.createElement("div");
    this.phaseEl.className = "hud-phase";
    this.metEl = document.createElement("div");
    this.metEl.className = "hud-met";
    this.teleEl = document.createElement("div");
    this.teleEl.className = "hud-telemetry";
    this.teleEl.style.display = "none";
    this.skipEl = document.createElement("div");
    this.skipEl.className = "hud-skip";
    this.skipEl.textContent = "HOLD SPACE TO SKIP";
    this.skipEl.style.opacity = "0";
    const progress = document.createElement("div");
    progress.className = "hud-progress";
    for (const s of STAGES) {
      const el = document.createElement("div");
      el.className = "hud-stage";
      el.textContent = s;
      progress.appendChild(el);
      this.stageEls.push(el);
    }
    wrap.prepend(this.phaseEl, this.metEl, this.teleEl, this.skipEl, progress);
    root.appendChild(wrap);
  }

  setPhase(p: string): void {
    this.phaseEl.textContent = p;
  }

  setMet(seconds: number, countingDown: boolean): void {
    this.met = seconds;
    this.countingDown = countingDown;
  }

  setTelemetry(t: TelemetryView | null): void {
    this.telemetry = t;
    this.teleEl.style.display = t ? "grid" : "none";
  }

  setProgress(stage: 1 | 2 | 3 | 4 | 5 | 6): void {
    this.stageEls.forEach((el, i) => el.classList.toggle("active", i === stage - 1));
  }

  setSkipHint(on: boolean): void {
    this.skipEl.style.opacity = on ? "1" : "0";
  }

  private fmt(): string {
    const total = Math.max(0, Math.round(this.met));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const core = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return this.countingDown ? `T-${core}` : `T+${core}`;
  }

  update(dt: number): void {
    if (!this.countingDown) this.met += dt; // countdown mode: setMet() drives the value each frame
    this.metEl.textContent = this.fmt();
    if (this.telemetry) {
      const t = this.telemetry;
      this.teleEl.innerHTML =
        `<span>RANGE</span><span>${t.range < 1000 ? `${t.range.toFixed(1)} M` : `${(t.range / 1000).toFixed(1)} KM`}</span>` +
        `<span>CLOSURE</span><span>${(t.closure * 100).toFixed(1)} CM/S</span>` +
        `<span>ALIGN</span><span>${t.alignErrorDeg.toFixed(2)}°</span>` +
        `<span>MODE</span><span>${t.phase.toUpperCase()}</span>`;
    }
  }
}
