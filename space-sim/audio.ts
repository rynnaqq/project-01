// space-sim/audio.ts
/**
 * PRESENTATION layer: procedural audio (PRD §D.17) — no asset files.
 * Thruster hiss tracks thrust level; one-shot cues for warning and docking.
 * Created on the START click so autoplay policies are satisfied.
 */

export interface AudioManager {
  /** Continuous thruster loop, 0..1 intensity (call every frame). */
  setThrust(level: number): void;
  /** Approach-state warning blip (SAFE passes through silently). */
  warn(state: 'CAUTION' | 'CRITICAL' | 'DOCKING_READY'): void;
  /** Docking confirmation chime. */
  dock(): void;
  setPaused(paused: boolean): void;
  dispose(): void;
}

export function createAudio(): AudioManager {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) {
    // No WebAudio (very old browser): silent no-op keeps the game running (§E.1).
    return { setThrust() {}, warn() {}, dock() {}, setPaused() {}, dispose() {} };
  }
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);

  // Thruster: filtered noise whose gain/cutoff track thrust level.
  const len = ctx.sampleRate; // 1 s of white noise, looping
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 200;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0;
  noise.connect(noiseFilter).connect(noiseGain).connect(master);
  noise.start();

  let lastWarnAt = 0;

  return {
    setThrust(level) {
      if (ctx.state !== 'running') return;
      noiseGain.gain.setTargetAtTime(level * 0.35, ctx.currentTime, 0.60);
      noiseFilter.frequency.setTargetAtTime(200 + level * 900, ctx.currentTime, 0.08);
    },
    warn(state) {
      if (ctx.state !== 'running') return;
      const now = performance.now();
      const gapMs = state === 'CRITICAL' ? 350 : state === 'DOCKING_READY' ? 800 : 1500;
      if (now - lastWarnAt < gapMs) return;
      lastWarnAt = now;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = state === 'DOCKING_READY' ? 880 : state === 'CAUTION' ? 520 : 392;
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      osc.connect(g).connect(master);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    },
    dock() {
      if (ctx.state !== 'running') return;
      [523, 659, 784].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.frequency.value = f;
        const t0 = ctx.currentTime + i * 0.12;
        g.gain.setValueAtTime(0.15, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
        osc.connect(g).connect(master);
        osc.start(t0);
        osc.stop(t0 + 0.32);
      });
    },
    setPaused(paused) {
      if (paused) ctx.suspend().catch(() => {});
      else ctx.resume().catch(() => {});
    },
    dispose() {
      ctx.close().catch(() => {});
    },
  };
}
