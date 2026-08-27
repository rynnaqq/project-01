import { AudioMixer } from './audioMixer';

export type SoundType =
  | 'beep'
  | 'countdown_high'
  | 'countdown_low'
  | 'ignition'
  | 'liftoff_rumble'
  | 'rcs_burst'
  | 'dock_latch'
  | 'dock_alert'
  | 'ambient_space'
  | 'ambient_interior'
  | 'radio_chime'
  | 'ui_click';

export class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientSpaceNode: AudioNode | null = null;
  private ambientInteriorNode: AudioNode | null = null;
  private rumbleNode: AudioNode | null = null;
  readonly mixer: AudioMixer;
  private captionCallback: ((caption: string) => void) | null = null;

  constructor(mixer?: AudioMixer) {
    this.mixer = mixer ?? new AudioMixer();
  }

  setCaptionCallback(cb: (caption: string) => void): void {
    this.captionCallback = cb;
  }

  init(): void {
    if (this.ctx) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.voiceGain = this.ctx.createGain();
      this.ambientGain = this.ctx.createGain();

      this.sfxGain.connect(this.masterGain);
      this.voiceGain.connect(this.masterGain);
      this.ambientGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.updateGains();
    } catch {
      // Graceful fallback if Web Audio is blocked or unsupported
    }
  }

  unlock(): void {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  updateGains(): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.voiceGain || !this.ambientGain) {
      return;
    }
    const gains = this.mixer.getGains();
    const t = this.ctx.currentTime;
    const isMuted = this.mixer.isMuted();

    this.masterGain.gain.setValueAtTime(isMuted ? 0 : gains.master, t);
    this.sfxGain.gain.setValueAtTime(gains.sfx, t);
    this.voiceGain.gain.setValueAtTime(gains.voice, t);
    this.ambientGain.gain.setValueAtTime(gains.ambient, t);
  }

  playCountdownTick(value: number): void {
    const caption =
      value > 0
        ? `[RADIO] Mission Control: T-minus ${value}...`
        : '[RADIO] Mission Control: LIFTOFF! All engines nominal!';
    this.captionCallback?.(caption);

    this.unlock();
    if (!this.ctx || !this.sfxGain || this.mixer.isMuted()) return;

    const isFinal = value === 0;
    const freq = isFinal ? 880 : value <= 3 ? 587.33 : 440;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isFinal ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.ctx.currentTime + (isFinal ? 0.6 : 0.18),
    );

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + (isFinal ? 0.6 : 0.2));
  }

  playIgnition(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.mixer.isMuted()) return;

    this.mixer.setVoiceActive(true);
    this.updateGains();

    const bufferSize = this.ctx.sampleRate * 2.5;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(80, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(450, this.ctx.currentTime + 2.0);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.6, this.ctx.currentTime + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 2.5);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    whiteNoise.start();
    whiteNoise.stop(this.ctx.currentTime + 2.5);

    this.captionCallback?.('[AUDIO] Main Engine Ignition Sequence Start...');

    // Ducking stays on until the ignition tail finishes — schedule the
    // duck release against the AudioContext clock instead of setTimeout to
    // keep it in lockstep with the rendered audio.
    const endT = this.ctx.currentTime + 2.5;
    const revert = () => {
      if (this.mixer.isVoiceActive()) {
        this.mixer.setVoiceActive(false);
        this.updateGains();
      }
    };
    // Schedule via a silent source that fires exactly at endT.
    const releaseOsc = this.ctx.createOscillator();
    const releaseGain = this.ctx.createGain();
    releaseGain.gain.setValueAtTime(0.0001, endT);
    releaseOsc.connect(releaseGain);
    releaseGain.connect(this.ctx.destination);
    releaseOsc.start(endT);
    releaseOsc.onended = () => {
      revert();
      releaseOsc.disconnect();
    };
    // Fallback in case onended isn't supported.
    const endMs = (endT - this.ctx.currentTime) * 1000;
    window.setTimeout(revert, endMs);
  }

  startEngineRumble(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.rumbleNode || this.mixer.isMuted()) return;

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noiseSource.start();
    this.rumbleNode = gain;
  }

  stopEngineRumble(): void {
    if (this.rumbleNode && this.ctx) {
      try {
        (this.rumbleNode as GainNode).gain.exponentialRampToValueAtTime(
          0.001,
          this.ctx.currentTime + 0.5,
        );
      } catch {
        // noop
      }
      this.rumbleNode = null;
    }
  }

  playRcsBurst(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.mixer.isMuted()) return;

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
    filter.Q.setValueAtTime(3, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    src.start();
  }

  playDockLatch(): void {
    this.captionCallback?.(
      '[RADIO] Flight Director: Hard capture confirmed! Capture ring mechanical lock complete.',
    );

    this.unlock();
    if (!this.ctx || !this.sfxGain || this.mixer.isMuted()) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  startSpaceAmbience(): void {
    this.unlock();
    if (!this.ctx || !this.ambientGain || this.ambientSpaceNode || this.mixer.isMuted()) return;

    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(55, this.ctx.currentTime);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(110, this.ctx.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(160, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);

    osc.start();
    osc2.start();
    this.ambientSpaceNode = gain;
  }

  stopSpaceAmbience(): void {
    if (this.ambientSpaceNode && this.ctx) {
      try {
        (this.ambientSpaceNode as GainNode).gain.exponentialRampToValueAtTime(
          0.001,
          this.ctx.currentTime + 0.5,
        );
      } catch {
        // noop
      }
      this.ambientSpaceNode = null;
    }
  }

  startInteriorAmbience(): void {
    this.unlock();
    if (!this.ctx || !this.ambientGain || this.ambientInteriorNode || this.mixer.isMuted()) return;

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);

    src.start();
    this.ambientInteriorNode = gain;
  }

  stopInteriorAmbience(): void {
    if (this.ambientInteriorNode && this.ctx) {
      try {
        (this.ambientInteriorNode as GainNode).gain.exponentialRampToValueAtTime(
          0.001,
          this.ctx.currentTime + 0.5,
        );
      } catch {
        // noop
      }
      this.ambientInteriorNode = null;
    }
  }

  playRadioChime(): void {
    this.unlock();
    if (!this.ctx || !this.voiceGain || this.mixer.isMuted()) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(950, this.ctx.currentTime);
    osc.frequency.setValueAtTime(750, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.voiceGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playUIClick(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.mixer.isMuted()) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  dispose(): void {
    this.stopEngineRumble();
    this.stopSpaceAmbience();
    this.stopInteriorAmbience();
    if (this.ctx && this.ctx.state !== 'closed') {
      void this.ctx.close();
    }
    this.ctx = null;
  }
}
