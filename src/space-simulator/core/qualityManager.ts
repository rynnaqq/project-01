export type QualityTier = 'LOW' | 'MEDIUM' | 'HIGH';

export interface QualitySettings {
  tier: QualityTier;
  shadows: boolean;
  bloom: boolean;
  motionBlur: boolean;
  screenShake: boolean;
  maxParticles: number;
}

export class QualityManager {
  tier: QualityTier;
  settings: QualitySettings;
  renderScale = 1.0;

  private fpsHistory: number[] = [];
  private readonly windowSize = 30;

  constructor(tier: QualityTier = 'MEDIUM', prefersReducedMotion = false) {
    this.tier = tier;
    this.settings = this.computeSettings(tier, prefersReducedMotion);
  }

  private computeSettings(
    tier: QualityTier,
    reducedMotion: boolean,
  ): QualitySettings {
    const isHigh = tier === 'HIGH';
    const isLow = tier === 'LOW';

    return {
      tier,
      shadows: isHigh,
      bloom: isHigh && !reducedMotion,
      motionBlur: isHigh && !reducedMotion,
      screenShake: !reducedMotion,
      maxParticles: isLow ? 1500 : isHigh ? 15000 : 5000,
    };
  }

  recordFps(fps: number): void {
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > this.windowSize) {
      this.fpsHistory.shift();
    }

    if (this.fpsHistory.length >= this.windowSize) {
      const avg =
        this.fpsHistory.reduce((sum, v) => sum + v, 0) / this.fpsHistory.length;
      if (avg < 45 && this.renderScale > 0.5) {
        this.renderScale = Math.max(0.5, Number((this.renderScale - 0.05).toFixed(2)));
      } else if (avg >= 58 && this.renderScale < 1.0) {
        this.renderScale = Math.min(1.0, Number((this.renderScale + 0.05).toFixed(2)));
      }
    }
  }
}
