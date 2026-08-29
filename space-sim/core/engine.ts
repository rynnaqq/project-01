// space-sim/core/engine.ts
import { Engine, WebGPUEngine } from "@babylonjs/core";

export type QualityTier = "high" | "medium" | "low";

export interface TierCaps {
  ssao: boolean; dof: boolean; motionBlur: boolean; gpuParticles: boolean;
  maxParticles: number; hardwareScaling: number;
}

/** Pure tier logic — unit tested. */
export function detectTier(info: { gpu: string | null; dpr: number; cores: number }): QualityTier {
  const gpu = (info.gpu ?? "").toLowerCase();
  const mobile = /mali|adreno|apple a\d|apple gpu|powervr|kirin|exynos/.test(gpu);
  const integrated = /apple m\d|iris|uhd|radeon\(tm\)|vega|arc /.test(gpu);
  if (mobile || info.gpu === null) return "low";
  if (integrated || info.cores <= 4) return "medium";
  if (info.dpr > 2.5) return "medium";
  return "high";
}

export function capsForTier(tier: QualityTier): TierCaps {
  switch (tier) {
    case "high":
      return { ssao: true, dof: true, motionBlur: true, gpuParticles: true, maxParticles: 12000, hardwareScaling: 1 };
    case "medium":
      return { ssao: false, dof: true, motionBlur: false, gpuParticles: true, maxParticles: 5000, hardwareScaling: 1 };
    case "low":
      return { ssao: false, dof: false, motionBlur: false, gpuParticles: false, maxParticles: 1800, hardwareScaling: 1.25 };
  }
}

export async function createBestEngine(canvas: HTMLCanvasElement): Promise<Engine | WebGPUEngine> {
  try {
    if (await WebGPUEngine.IsSupportedAsync) {
      const gpu = new WebGPUEngine(canvas);
      await gpu.initAsync();
      return gpu;
    }
  } catch {
    // fall through to WebGL2
  }
  return new Engine(canvas, true, { stencil: false, powerPreference: "high-performance" });
}

/** Read a GPU renderer string when available (tier detection input). */
export function gpuString(engine: Engine | WebGPUEngine): string | null {
  const gl = (engine as unknown as { _gl?: WebGL2RenderingContext })._gl;
  if (gl) {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
  }
  return null;
}
