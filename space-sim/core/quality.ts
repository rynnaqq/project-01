/**
 * Quality tiers and device detection.
 * Detection is heuristic: hardwareConcurrency, deviceMemory, GPU renderer.
 */

export type QualityTier = 'HIGH' | 'MEDIUM' | 'LOW';

export type QualityProfile = {
  tier: QualityTier;
  particleCount: number;
  shadowMapSize: number;
  postProcessing: 'full' | 'basic' | 'none';
  dynamicResolution: boolean;
};

export const PROFILES: Record<QualityTier, QualityProfile> = {
  HIGH: {
    tier: 'HIGH',
    particleCount: 6000,
    shadowMapSize: 2048,
    postProcessing: 'full',
    dynamicResolution: true,
  },
  MEDIUM: {
    tier: 'MEDIUM',
    particleCount: 2000,
    shadowMapSize: 1024,
    postProcessing: 'basic',
    dynamicResolution: true,
  },
  LOW: {
    tier: 'LOW',
    particleCount: 600,
    shadowMapSize: 512,
    postProcessing: 'none',
    dynamicResolution: false,
  },
};

let cachedTier: QualityTier | null = null;

export function detectTier(): QualityTier {
  if (cachedTier) return cachedTier;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

  if (!isMobile && cores >= 8 && memory >= 8) {
    cachedTier = 'HIGH';
  } else if (isMobile && (cores < 4 || memory < 4)) {
    cachedTier = 'LOW';
  } else if (isMobile) {
    cachedTier = 'MEDIUM';
  } else {
    cachedTier = cores >= 6 && memory >= 6 ? 'MEDIUM' : 'LOW';
  }
  return cachedTier;
}

export function getProfile(tier?: QualityTier): QualityProfile {
  return PROFILES[tier ?? detectTier()];
}