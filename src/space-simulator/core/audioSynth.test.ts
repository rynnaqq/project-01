import { describe, expect, it } from 'vitest';
import { AudioSynthesizer } from './audioSynth';
import { AudioMixer } from './audioMixer';

describe('AudioSynthesizer', () => {
  it('instantiates with custom or default mixer', () => {
    const mixer = new AudioMixer();
    const synth = new AudioSynthesizer(mixer);
    expect(synth.mixer).toBe(mixer);
  });

  it('triggers caption callback on countdown tick and latch', () => {
    const synth = new AudioSynthesizer();
    const captions: string[] = [];
    synth.setCaptionCallback((c) => captions.push(c));

    synth.playCountdownTick(5);
    expect(captions.length).toBe(1);
    expect(captions[0]).toContain('T-minus 5');

    synth.playCountdownTick(0);
    expect(captions.length).toBe(2);
    expect(captions[1]).toContain('LIFTOFF');

    synth.playDockLatch();
    expect(captions.length).toBe(3);
    expect(captions[2]).toContain('Hard capture confirmed');
  });

  it('handles dispose safely without exceptions', () => {
    const synth = new AudioSynthesizer();
    expect(() => {
      synth.dispose();
    }).not.toThrow();
  });
});
