import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import type { Scene } from '@babylonjs/core/scene';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { QualitySettings } from '../core/qualityManager';

export class PostProcessManager {
  private glowLayer: GlowLayer | null = null;
  private pipeline: DefaultRenderingPipeline;

  constructor(
    private readonly scene: Scene,
    camera: Camera,
    settings: QualitySettings,
  ) {
    this.pipeline = new DefaultRenderingPipeline(
      'default-pipeline',
      true,
      scene,
      [camera],
    );
    this.applySettings(settings);
  }

  applySettings(settings: QualitySettings): void {
    if (settings.bloom && !this.glowLayer) {
      this.glowLayer = new GlowLayer('glow', this.scene, {
        mainTextureRatio: 0.5,
        blurKernelSize: 32,
      });
      this.glowLayer.intensity = 0.6;
    } else if (!settings.bloom && this.glowLayer) {
      this.glowLayer.dispose();
      this.glowLayer = null;
    }

    // PRD 12.4: Vignette is enabled on all tiers, minimal on LOW
    this.pipeline.imageProcessingEnabled = true;
    this.pipeline.imageProcessing.vignetteEnabled = true;
    this.pipeline.imageProcessing.vignetteWeight = settings.tier === 'LOW' ? 1.5 : 3.0;
  }

  dispose(): void {
    if (this.glowLayer) {
      this.glowLayer.dispose();
      this.glowLayer = null;
    }
    this.pipeline.dispose();
  }
}
