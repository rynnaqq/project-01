import { describe, expect, it } from 'vitest';
import { QualityManager } from './qualityManager';

describe('QualityManager', () => {
  it('defaults to requested tier or MEDIUM', () => {
    const qm = new QualityManager('HIGH');
    expect(qm.tier).toBe('HIGH');
    expect(qm.settings.shadows).toBe(true);
    expect(qm.settings.bloom).toBe(true);
  });

  it('provides LOW tier settings with minimal features', () => {
    const qm = new QualityManager('LOW');
    expect(qm.settings.shadows).toBe(false);
    expect(qm.settings.bloom).toBe(false);
    expect(qm.settings.maxParticles).toBeLessThanOrEqual(2000);
  });

  it('downgrades resolution scale when FPS stays low', () => {
    const qm = new QualityManager('HIGH');
    expect(qm.renderScale).toBe(1.0);

    // Feed low FPS samples (< 45 FPS)
    for (let i = 0; i < 30; i++) {
      qm.recordFps(35);
    }
    expect(qm.renderScale).toBeLessThan(1.0);
    expect(qm.renderScale).toBeGreaterThanOrEqual(0.5);
  });

  it('disables bloom/motion blur when prefersReducedMotion is enabled', () => {
    const qm = new QualityManager('HIGH', true);
    expect(qm.settings.screenShake).toBe(false);
    expect(qm.settings.motionBlur).toBe(false);
  });
});
