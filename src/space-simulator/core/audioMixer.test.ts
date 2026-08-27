import { describe, expect, it } from 'vitest';
import { AudioMixer } from './audioMixer';

describe('AudioMixer', () => {
  it('initializes default bus gains at nominal levels', () => {
    const mixer = new AudioMixer();
    expect(mixer.getGains()).toEqual({
      master: 1,
      music: 1,
      voice: 1,
      sfx: 1,
      ambient: 1,
    });
  });

  it('applies PRD 13.4 ducking rules when voice-over starts', () => {
    const mixer = new AudioMixer();
    mixer.setVoiceActive(true);
    const gains = mixer.getGains();
    // Voice: 0 dB (1.0), SFX: -4 dB (~0.63), Music: -8 dB (~0.40), Ambient: -5 dB (~0.56)
    expect(gains.voice).toBeCloseTo(1.0, 2);
    expect(gains.sfx).toBeCloseTo(0.63, 2);
    expect(gains.music).toBeCloseTo(0.4, 2);
    expect(gains.ambient).toBeCloseTo(0.56, 2);
  });

  it('restores gains when voice-over stops', () => {
    const mixer = new AudioMixer();
    mixer.setVoiceActive(true);
    mixer.setVoiceActive(false);
    expect(mixer.getGains()).toEqual({
      master: 1,
      music: 1,
      voice: 1,
      sfx: 1,
      ambient: 1,
    });
  });

  it('mutes all channels when master is muted', () => {
    const mixer = new AudioMixer();
    mixer.setMuted(true);
    expect(mixer.getEffectiveGain('music')).toBe(0);
    expect(mixer.getEffectiveGain('sfx')).toBe(0);
  });
});
