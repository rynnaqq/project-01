/**
 * Lightweight Web Audio controller.
 *
 * There are no bundled audio assets, so background music and SFX are synthesised
 * with oscillators. The AudioContext is created lazily and must be unlocked from
 * a user gesture (browsers block autoplay) via `unlock()`.
 */

/** Convert a MIDI note number to its frequency in Hz (A4 = 69 = 440Hz). */
export function noteToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export type SfxType = 'click' | 'success' | 'error' | 'tick';

// A short, pleasant arpeggio loop (MIDI notes) used for background music.
const MUSIC_SEQUENCE = [57, 60, 64, 67, 64, 60]; // A3 C4 E4 G4 E4 C4
const MUSIC_STEP_MS = 320;

export class AudioController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStep = 0;

  private musicEnabled = false;
  private sfxEnabled = true;
  private unlocked = false;

  /** Whether the audio context has been unlocked by a user gesture. */
  isUnlocked(): boolean {
    return this.unlocked;
  }

  /** Create/resume the AudioContext. Must be called from a user gesture. */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.unlocked = true;
    if (this.musicEnabled) this.startMusic();
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (!this.unlocked) return;
    if (enabled) this.startMusic();
    else this.stopMusic();
  }

  setSfxEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
  }

  private startMusic(): void {
    if (!this.ctx || this.musicTimer) return;
    this.musicStep = 0;
    this.musicTimer = setInterval(() => {
      const midi = MUSIC_SEQUENCE[this.musicStep % MUSIC_SEQUENCE.length];
      this.musicStep += 1;
      this.tone(noteToFreq(midi), 0.25, 'sine', 0.15);
    }, MUSIC_STEP_MS);
  }

  private stopMusic(): void {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  /** Play a short sound effect. No-op when SFX are disabled or not unlocked. */
  playSfx(type: SfxType): void {
    if (!this.sfxEnabled || !this.unlocked || !this.ctx) return;
    switch (type) {
      case 'click':
        this.tone(660, 0.08, 'square', 0.2);
        break;
      case 'tick':
        this.tone(880, 0.05, 'triangle', 0.15);
        break;
      case 'success':
        this.tone(660, 0.1, 'sine', 0.25);
        window.setTimeout(() => this.tone(990, 0.18, 'sine', 0.25), 90);
        break;
      case 'error':
        this.tone(220, 0.25, 'sawtooth', 0.25);
        break;
    }
  }

  /** Synthesise a single enveloped tone. */
  private tone(freq: number, duration: number, type: OscillatorType, gain: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(gain, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /** Release audio resources. */
  dispose(): void {
    this.stopMusic();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.unlocked = false;
  }
}

/** App-wide singleton audio controller. */
export const audioController = new AudioController();
