import { describe, expect, it } from 'vitest';
import { noteToFreq } from './audio';

describe('noteToFreq', () => {
  it('maps A4 (69) to 440Hz', () => {
    expect(noteToFreq(69)).toBeCloseTo(440, 5);
  });

  it('maps A5 (81) to 880Hz (one octave up)', () => {
    expect(noteToFreq(81)).toBeCloseTo(880, 5);
  });

  it('maps A3 (57) to 220Hz (one octave down)', () => {
    expect(noteToFreq(57)).toBeCloseTo(220, 5);
  });
});
