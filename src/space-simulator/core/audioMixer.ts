export type AudioBus = 'master' | 'music' | 'voice' | 'sfx' | 'ambient';

export interface BusGains {
  master: number;
  music: number;
  voice: number;
  sfx: number;
  ambient: number;
}

export class AudioMixer {
  private muted = false;
  private voiceActive = false;

  private baseGains: BusGains = {
    master: 1,
    music: 1,
    voice: 1,
    sfx: 1,
    ambient: 1,
  };

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setVoiceActive(active: boolean): void {
    this.voiceActive = active;
  }

  isVoiceActive(): boolean {
    return this.voiceActive;
  }

  getGains(): BusGains {
    if (!this.voiceActive) {
      return { ...this.baseGains };
    }
    // PRD 13.4 Ducking: Voice: 0dB (1.0), SFX: -4dB (~0.63), Music: -8dB (~0.40), Ambient: -5dB (~0.56)
    return {
      master: this.baseGains.master,
      voice: this.baseGains.voice * 1.0,
      sfx: this.baseGains.sfx * Math.pow(10, -4 / 20),
      music: this.baseGains.music * Math.pow(10, -8 / 20),
      ambient: this.baseGains.ambient * Math.pow(10, -5 / 20),
    };
  }

  getEffectiveGain(bus: AudioBus): number {
    if (this.muted) return 0;
    const gains = this.getGains();
    return gains.master * gains[bus];
  }
}
