// space-sim/core/audio.ts
// Procedural Web Audio bus: engine bed, ascent rumble, vent ambience, UI beeps,
// docking clunks, and SpeechSynthesis radio comms. Speech cannot route through the
// Web Audio graph (browser limitation), so a squelch burst + heterodyne bed are
// played around each utterance instead. Every path fails silently when Web Audio
// or SpeechSynthesis is unavailable — audio must never break the mission.
import type { CommsLine } from "../mission/engine";

function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else d[i] = w;
  }
  return buf;
}

const SPEAKER_PROFILES: Record<string, { rate: number; pitch: number }> = {
  CAPCOM: { rate: 1.05, pitch: 0.9 },
  COMMANDER: { rate: 1.0, pitch: 0.8 },
  PILOT: { rate: 1.08, pitch: 1.05 },
  PAO: { rate: 0.95, pitch: 1.0 },
};

export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private radio: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOscGain: GainNode | null = null;
  private rumbleGain: GainNode | null = null;
  private ventGain: GainNode | null = null;
  private muted = false;

  /** Create/resume the AudioContext. Must be called from a user gesture. */
  async unlock(): Promise<void> {
    if (this.ctx) {
      try { await this.ctx.resume(); } catch { /* resume is best-effort */ }
      return;
    }
    if (typeof AudioContext === "undefined") return;
    try {
      const ctx = new AudioContext();
      const master = ctx.createGain(); master.gain.value = 0.9;
      master.connect(ctx.destination);
      const duck = ctx.createGain(); duck.gain.value = 1; duck.connect(master);
      const sfx = ctx.createGain(); sfx.gain.value = 0.8; sfx.connect(duck);
      const amb = ctx.createGain(); amb.gain.value = 0.6; amb.connect(duck);
      const radio = ctx.createGain(); radio.gain.value = 0.9; radio.connect(duck);
      // Engine bed: brown-noise loop + 38 Hz sub oscillator with a slow LFO breathing
      // on its level (series gain keeps the LFO relative to the ramped engine level).
      const engSrc = ctx.createBufferSource();
      engSrc.buffer = noiseBuffer(ctx, 3, true);
      engSrc.loop = true;
      const engFilter = ctx.createBiquadFilter(); engFilter.type = "lowpass"; engFilter.frequency.value = 120;
      const engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engSrc.connect(engFilter).connect(engineGain).connect(sfx);
      engSrc.start();
      const sub = ctx.createOscillator(); sub.type = "sine"; sub.frequency.value = 38;
      const engineOscGain = ctx.createGain(); engineOscGain.gain.value = 0;
      const engineOscLfo = ctx.createGain(); engineOscLfo.gain.value = 1;
      const lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.3;
      const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.15;
      lfo.connect(lfoDepth); lfoDepth.connect(engineOscLfo.gain);
      sub.connect(engineOscGain).connect(engineOscLfo).connect(sfx);
      sub.start();
      lfo.start();
      // Rumble path: shared brown noise through a low bandpass.
      const rumSrc = ctx.createBufferSource();
      rumSrc.buffer = noiseBuffer(ctx, 3, true);
      rumSrc.loop = true;
      const rumFilter = ctx.createBiquadFilter(); rumFilter.type = "bandpass"; rumFilter.frequency.value = 50; rumFilter.Q.value = 0.6;
      const rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0;
      rumSrc.connect(rumFilter).connect(rumbleGain).connect(sfx);
      rumSrc.start();
      // Vent ambience: filtered white noise, the ISS air-handling hum.
      const ventSrc = ctx.createBufferSource();
      ventSrc.buffer = noiseBuffer(ctx, 2, false);
      ventSrc.loop = true;
      const ventFilter = ctx.createBiquadFilter(); ventFilter.type = "bandpass"; ventFilter.frequency.value = 900; ventFilter.Q.value = 0.7;
      const ventGain = ctx.createGain(); ventGain.gain.value = 0;
      ventSrc.connect(ventFilter).connect(ventGain).connect(amb);
      ventSrc.start();
      this.master = master; this.sfx = sfx; this.radio = radio;
      this.engineGain = engineGain; this.engineOscGain = engineOscGain;
      this.rumbleGain = rumbleGain; this.ventGain = ventGain;
      this.ctx = ctx;
    } catch {
      // Audio unavailable (or construction failed) — run the mission silent.
      this.ctx = null;
    }
  }

  private ramp(param: AudioParam | undefined, v: number, t = 0.4): void {
    if (!param || !this.ctx) return;
    param.cancelScheduledValues(this.ctx.currentTime);
    param.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, t);
  }

  engine(on: boolean): void {
    this.ramp(this.engineGain?.gain, on ? 0.55 : 0, 1.2);
    this.ramp(this.engineOscGain?.gain, on ? 0.3 : 0, 1.2);
  }
  engineLevel(v: number): void { this.ramp(this.engineGain?.gain, 0.55 * v, 0.8); }
  rumble(intensity: number): void { this.ramp(this.rumbleGain?.gain, 0.5 * intensity, 0.3); }
  vent(on: boolean): void { this.ramp(this.ventGain?.gain, on ? 0.06 : 0, 1.5); }
  duck(level: number): void { this.ramp(this.master?.gain, 0.9 * level, 0.2); }
  setMuted(m: boolean): void { this.muted = m; if (this.master && this.ctx) this.ramp(this.master.gain, m ? 0 : 0.9, 0.1); }

  /** Mute-while-paused: silence the master bus and cancel in-flight radio speech. */
  setPaused(p: boolean): void {
    this.duck(p ? 0 : 1);
    if (!p || typeof speechSynthesis === "undefined") return;
    try { speechSynthesis.cancel(); } catch { /* best effort */ }
  }

  beep(kind: "soft" | "alert"): void {
    if (!this.ctx || !this.sfx || this.muted) return;
    const ctx = this.ctx;
    const sfx = this.sfx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = kind === "soft" ? "sine" : "square";
    osc.frequency.value = kind === "soft" ? 880 : 620;
    if (kind === "alert") osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.2);
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === "soft" ? 0.08 : 0.2));
    osc.connect(g).connect(sfx);
    osc.start(); osc.stop(ctx.currentTime + 0.25);
  }

  clunk(): void {
    if (!this.ctx || !this.sfx || this.muted) return;
    const ctx = this.ctx;
    const sfx = this.sfx;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 0.15, false);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
    src.connect(f).connect(g).connect(sfx);
    src.start();
    const thump = ctx.createOscillator(); thump.type = "sine"; thump.frequency.value = 90;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.3, ctx.currentTime);
    tg.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    thump.connect(tg).connect(sfx);
    thump.start(); thump.stop(ctx.currentTime + 0.15);
  }

  /** Squelch + SpeechSynthesis + heterodyne bed. Fails silently when unsupported. */
  speak(c: CommsLine): void {
    try {
      if (!this.ctx || !this.radio || this.muted) return;
      const ctx = this.ctx;
      const radio = this.radio;
      const squelch = ctx.createBufferSource();
      squelch.buffer = noiseBuffer(ctx, 0.08, false);
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800;
      const sg = ctx.createGain(); sg.gain.value = 0.12;
      squelch.connect(bp).connect(sg).connect(radio);
      squelch.start();
      if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return;
      const profile = SPEAKER_PROFILES[c.speaker] ?? { rate: 1, pitch: 1 };
      const u = new SpeechSynthesisUtterance(c.text);
      u.rate = profile.rate; u.pitch = profile.pitch; u.volume = 0.9;
      // Heterodyne bed under the utterance (speech itself cannot enter the graph).
      const bed = ctx.createBufferSource();
      bed.buffer = noiseBuffer(ctx, 1, false);
      bed.loop = true;
      const bedF = ctx.createBiquadFilter(); bedF.type = "bandpass"; bedF.frequency.value = 1400;
      const bedG = ctx.createGain(); bedG.gain.value = 0.015;
      bed.connect(bedF).connect(bedG).connect(radio);
      bed.start();
      const stopBed = (): void => {
        try { bed.stop(); } catch { /* already stopped */ }
      };
      u.onend = stopBed;
      u.onerror = stopBed;
      speechSynthesis.speak(u);
    } catch {
      // SpeechSynthesis quirks must never break the mission.
    }
  }
}
