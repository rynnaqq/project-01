// space-sim/ui/menu.ts
export interface MenuCallbacks {
  onStart(): void;
  onRestart(): void;
  onSkip(): void;
  onExit(): void;
  onResume(): void;
  onFullscreen(): void;
}

function btn(label: string, cb: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "menu-btn";
  b.textContent = label;
  b.onclick = cb;
  return b;
}

export class Menu {
  private startCard: HTMLDivElement;
  private pauseCard: HTMLDivElement;
  private errorCard: HTMLDivElement;
  private errorText: HTMLDivElement;
  private continueBtn: HTMLButtonElement;
  private noteEl: HTMLDivElement | null = null;

  constructor(root: HTMLElement, cb: MenuCallbacks) {
    this.startCard = document.createElement("div");
    this.startCard.className = "menu-card hidden";
    const title = document.createElement("div");
    title.className = "menu-title";
    title.textContent = "Artemis Transit";
    const sub = document.createElement("div");
    sub.className = "menu-sub";
    sub.textContent = "KSC → Orbit → ISS — A cinematic mission";
    this.startCard.append(
      title, sub,
      btn("BEGIN MISSION", cb.onStart),
      btn("FULLSCREEN", cb.onFullscreen),
    );
    this.pauseCard = document.createElement("div");
    this.pauseCard.className = "menu-card hidden";
    const ptitle = document.createElement("div");
    ptitle.className = "loading-title";
    ptitle.textContent = "MISSION PAUSED";
    this.pauseCard.append(
      ptitle,
      btn("RESUME", cb.onResume),
      btn("RESTART MISSION", cb.onRestart),
      btn("SKIP CINEMATIC", cb.onSkip),
      btn("EXIT", cb.onExit),
    );
    this.errorCard = document.createElement("div");
    this.errorCard.className = "menu-card hidden";
    const etitle = document.createElement("div");
    etitle.className = "loading-title";
    etitle.textContent = "MISSION FAULT";
    this.errorText = document.createElement("div");
    this.errorText.className = "menu-error-text";
    // CONTINUE only appears for recoverable faults (missing scenery) where the
    // mission can still run; fatal boot errors keep RETRY/EXIT only.
    this.continueBtn = btn("CONTINUE MISSION", cb.onStart);
    this.continueBtn.classList.add("hidden");
    this.errorCard.append(
      etitle, this.errorText,
      this.continueBtn,
      btn("RETRY", cb.onRestart),
      btn("EXIT", cb.onExit),
    );
    root.append(this.startCard, this.pauseCard, this.errorCard);
  }

  /** Persistent note on the start card (e.g. touch-device quality notice). */
  setStartNote(text: string): void {
    if (!this.noteEl) {
      this.noteEl = document.createElement("div");
      this.noteEl.className = "menu-note";
      this.startCard.insertBefore(this.noteEl, this.startCard.children[2] ?? null);
    }
    this.noteEl.textContent = text;
  }

  showStart(): void {
    this.startCard.classList.remove("hidden");
  }

  showPause(): void {
    this.pauseCard.classList.remove("hidden");
  }

  showError(msg: string, canContinue = false): void {
    this.errorText.textContent = msg;
    this.continueBtn.classList.toggle("hidden", !canContinue);
    this.errorCard.classList.remove("hidden");
  }

  hide(): void {
    this.startCard.classList.add("hidden");
    this.pauseCard.classList.add("hidden");
    this.errorCard.classList.add("hidden");
  }
}
