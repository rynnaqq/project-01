// space-sim/main.ts
import { WebGPUEngine } from "@babylonjs/core";
import type { Engine } from "@babylonjs/core";
import { capsForTier, createBestEngine, detectTier, gpuString } from "./core/engine";

const canvas = document.getElementById("render-canvas") as HTMLCanvasElement;
const fill = document.getElementById("loading-fill")!;
const stepLabel = document.getElementById("loading-step")!;

export function setProgress(fraction: number, label: string): void {
  fill.style.width = `${Math.round(fraction * 100)}%`;
  stepLabel.textContent = label;
}

async function boot(): Promise<void> {
  setProgress(0.1, "Detecting graphics backend...");
  const engine: Engine | WebGPUEngine = await createBestEngine(canvas);
  const tier = detectTier({
    gpu: engine instanceof WebGPUEngine ? "WebGPU-capable" : gpuString(engine),
    dpr: window.devicePixelRatio,
    cores: navigator.hardwareConcurrency || 4,
  });
  engine.setHardwareScalingLevel(capsForTier(tier).hardwareScaling);
  setProgress(0.4, `Graphics ready — ${tier.toUpperCase()} tier`);
  await new Promise((r) => setTimeout(r, 400));
  setProgress(1, "MISSION SYSTEM READY");
  await new Promise((r) => setTimeout(r, 500));
  document.getElementById("loading-screen")!.classList.add("hidden");
  void engine;
}

boot().catch((err: unknown) => {
  document.getElementById("loading-screen")!.classList.add("hidden");
  document.getElementById("error-screen")!.classList.remove("hidden");
  document.getElementById("error-text")!.textContent = `The simulator could not initialize graphics: ${String(err)}`;
});
