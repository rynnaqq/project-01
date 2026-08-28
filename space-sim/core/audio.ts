/**
 * Procedural Web Audio Engine (PRD §13).
 * Zero external audio asset dependencies — synthesizes all engine rumbles,
 * countdown beeps, RCS thruster bursts, cabin hums, docking latches, and radio effects.
 */

export type AudioBusName = 'master' | 'music' | 'voice' | 'sfx' | 'ambient' | 'ui';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private busGains: Record<AudioBusName, GainNode | null> = {
    master: null,
    music: null,
    voice: null,
    sfx: null,
    ambient: null,
    ui: null,
  };

  private muted = false;

  // Active procedural loop nodes
  private rocketNoiseNode: AudioNode | null = null;
  private rocketGainNode: GainNode | null = null;
  private rocketFilterNode: BiquadFilterNode | null = null;

  private cabinHumNode: OscillatorNode | null = null;
  private cabinGainNode: GainNode | null = null;

  private spaceAmbientOsc1: OscillatorNode | null = null;
  private spaceAmbientOsc2: OscillatorNode | null = null;
  private spaceAmbientGain: GainNode | null = null;

  constructor() {
    // Unlock on first user gesture
    const unlock = () => {
      this.initContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
  }

  private initContext(): void {
    if (this.ctx) return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.busGains.master = this.masterGain;

    const busNames: AudioBusName[] = ['music', 'voice', 'sfx', 'ambient', 'ui'];
    for (const name of busNames) {
      const gain = this.ctx.createGain();
      gain.connect(this.masterGain);
      this.busGains[name] = gain;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      const target = muted ? 0 : 1;
      this.masterGain.gain.setValueAtTime(target, this.ctx.currentTime);
    }
  }

  setBusVolume(bus: AudioBusName, volume: number): void {
    const gainNode = this.busGains[bus];
    if (gainNode && this.ctx) {
      const clamped = Math.max(0, Math.min(1, volume));
      gainNode.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
  }

  // --- Procedural Sound Effects ---

  /** Countdown Beep (PRD §5): 1000Hz normal, 2000Hz liftoff */
  playCountdownBeep(val: number): void {
    this.initContext();
    if (!this.ctx || this.muted || !this.busGains.ui) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(val === 0 ? 1800 : 950, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (val === 0 ? 0.6 : 0.15));

    osc.connect(gain);
    gain.connect(this.busGains.ui);

    osc.start(now);
    osc.stop(now + (val === 0 ? 0.65 : 0.2));
  }

  /** Continuous Rocket Engine Rumble (PRD §6) */
  startRocketRumble(initialThrottle = 0.5): void {
    this.initContext();
    if (!this.ctx || !this.busGains.sfx || this.rocketNoiseNode) return;

    // Create 2-second white noise buffer
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(80 + initialThrottle * 280, this.ctx.currentTime);
    filter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(initialThrottle * 0.45, this.ctx.currentTime + 1.0);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.busGains.sfx);

    noise.start();

    this.rocketNoiseNode = noise;
    this.rocketFilterNode = filter;
    this.rocketGainNode = gain;
  }

  setRocketThrottle(throttle: number): void {
    if (!this.ctx || !this.rocketFilterNode || !this.rocketGainNode) return;
    const clamped = Math.max(0, Math.min(1, throttle));
    const now = this.ctx.currentTime;
    this.rocketFilterNode.frequency.setTargetAtTime(70 + clamped * 320, now, 0.1);
    this.rocketGainNode.gain.setTargetAtTime(clamped * 0.45, now, 0.1);
  }

  stopRocketRumble(): void {
    if (this.rocketGainNode && this.ctx) {
      const now = this.ctx.currentTime;
      this.rocketGainNode.gain.linearRampToValueAtTime(0.001, now + 0.8);
      setTimeout(() => {
        if (this.rocketNoiseNode) {
          (this.rocketNoiseNode as AudioBufferSourceNode).stop();
          this.rocketNoiseNode.disconnect();
          this.rocketNoiseNode = null;
        }
      }, 900);
    }
  }

  /** RCS Thruster Burst (PRD §8) */
  playThrusterBurst(): void {
    this.initContext();
    if (!this.ctx || this.muted || !this.busGains.sfx) return;

    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.Q.setValueAtTime(2.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.busGains.sfx);

    noise.start(now);
    noise.stop(now + 0.18);
  }

  /** Docking Latch Clang (PRD §8) */
  playDockingLatch(): void {
    this.initContext();
    if (!this.ctx || this.muted || !this.busGains.sfx) return;

    const now = this.ctx.currentTime;
    // Resonant metallic dual osc
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(140, now);
    osc1.frequency.exponentialRampToValueAtTime(50, now + 0.4);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(320, now);
    osc2.frequency.exponentialRampToValueAtTime(80, now + 0.3);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.busGains.sfx);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.55);
    osc2.stop(now + 0.55);
  }

  /** ISS Interior Ventilation Hum (PRD §10, §13) */
  startCabinHum(): void {
    this.initContext();
    if (!this.ctx || !this.busGains.ambient || this.cabinHumNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now); // Low ventilation frequency

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 2.0);

    osc.connect(gain);
    gain.connect(this.busGains.ambient);

    osc.start(now);
    this.cabinHumNode = osc;
    this.cabinGainNode = gain;
  }

  stopCabinHum(): void {
    if (this.cabinGainNode && this.ctx) {
      const now = this.ctx.currentTime;
      this.cabinGainNode.gain.linearRampToValueAtTime(0.001, now + 1.0);
      setTimeout(() => {
        if (this.cabinHumNode) {
          this.cabinHumNode.stop();
          this.cabinHumNode.disconnect();
          this.cabinHumNode = null;
        }
      }, 1100);
    }
  }

  /** Ambient Space Music Pad (PRD §13) */
  startSpaceAmbient(): void {
    this.initContext();
    if (!this.ctx || !this.busGains.music || this.spaceAmbientOsc1) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(220, now); // A3
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(329.63, now); // E4

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 3.0);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.busGains.music);

    osc1.start(now);
    osc2.start(now);

    this.spaceAmbientOsc1 = osc1;
    this.spaceAmbientOsc2 = osc2;
    this.spaceAmbientGain = gain;
  }

  stopSpaceAmbient(): void {
    if (this.spaceAmbientGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.spaceAmbientGain.gain.linearRampToValueAtTime(0.001, now + 2.0);
      setTimeout(() => {
        if (this.spaceAmbientOsc1) {
          this.spaceAmbientOsc1.stop();
          this.spaceAmbientOsc1.disconnect();
          this.spaceAmbientOsc1 = null;
        }
        if (this.spaceAmbientOsc2) {
          this.spaceAmbientOsc2.stop();
          this.spaceAmbientOsc2.disconnect();
          this.spaceAmbientOsc2 = null;
        }
      }, 2100);
    }
  }

  /** Radio Transmission Beep / Quip with Speech Synthesis or Tones */
  playRadioTransmission(text: string, onCaption?: (caption: string) => void): void {
    this.initContext();
    if (onCaption) onCaption(text);

    if (!this.ctx || this.muted || !this.busGains.voice) return;

    const now = this.ctx.currentTime;
    // Squelch intro
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.setValueAtTime(1200, now + 0.04);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.busGains.voice);
    osc.start(now);
    osc.stop(now + 0.09);

    // Audio ducking: duck music and ambient during transmission
    if (this.busGains.music && this.busGains.ambient) {
      this.busGains.music.gain.setValueAtTime(0.02, now);
      this.busGains.ambient.gain.setValueAtTime(0.04, now);
      setTimeout(() => {
        if (this.ctx && this.busGains.music && this.busGains.ambient) {
          this.busGains.music.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 1.0);
          this.busGains.ambient.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 1.0);
        }
      }, 3500);
    }

    // Optional browser SpeechSynthesis if supported
    if ('speechSynthesis' in window && !this.muted) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 0.95;
        utterance.volume = this.muted ? 0 : 0.8;
        window.speechSynthesis.speak(utterance);
      } catch {
        // SpeechSynthesis unsupported in some environments
      }
    }
  }

  dispose(): void {
    this.stopRocketRumble();
    this.stopCabinHum();
    this.stopSpaceAmbient();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
