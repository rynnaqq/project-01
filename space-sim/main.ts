// space-sim/main.ts
import {
  DefaultRenderingPipeline, SSAO2RenderingPipeline, Scene, UniversalCamera, Vector3,
  WebGPUEngine,
} from "@babylonjs/core";
import type { Engine } from "@babylonjs/core";
import { capsForTier, createBestEngine, detectTier, gpuString, type QualityTier } from "./core/engine";
import { createAssets } from "./core/assets";
import { SkyController } from "./effects/sky";
import { createStarfield } from "./world/space";
import { createEarth, type Earth } from "./world/earth/earth";
import type { MobileLauncher } from "./world/ksc/launcher";

const canvas = document.getElementById("render-canvas") as HTMLCanvasElement;
const fill = document.getElementById("loading-fill")!;
const stepLabel = document.getElementById("loading-step")!;

function setProgress(fraction: number, label: string): void {
  fill.style.width = `${Math.round(fraction * 100)}%`;
  stepLabel.textContent = label;
}
const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

interface World { tier: QualityTier; sky: SkyController; earth: Earth; ml: MobileLauncher }

async function boot(): Promise<World> {
  setProgress(0.05, "Detecting graphics backend...");
  const engine: Engine | WebGPUEngine = await createBestEngine(canvas);
  const tier = detectTier({
    gpu: engine instanceof WebGPUEngine ? "WebGPU-capable" : gpuString(engine),
    dpr: window.devicePixelRatio,
    cores: navigator.hardwareConcurrency || 4,
  });
  engine.setHardwareScalingLevel(capsForTier(tier).hardwareScaling);
  const scene = new Scene(engine);
  scene.clearColor.set(0.002, 0.004, 0.01, 1);
  const camera = new UniversalCamera("bootCam", new Vector3(1400, 60, 900), scene);
  camera.minZ = 0.1; camera.maxZ = 2.5e7;
  camera.setTarget(new Vector3(0, 40, 0));
  scene.activeCamera = camera;

  setProgress(0.2, "Loading materials...");
  await nextFrame();
  const assets = createAssets(scene);

  setProgress(0.4, "Loading sky and starfield...");
  await nextFrame();
  const sky = new SkyController(scene, tier);
  createStarfield(scene);

  setProgress(0.6, "Loading Earth...");
  await nextFrame();
  const earth = createEarth(scene);

  setProgress(0.7, "Loading Kennedy Space Center...");
  await nextFrame();
  const { createTerrain } = await import("./world/ksc/terrain");
  createTerrain(scene, assets);
  const { createVab, createFacilityCluster } = await import("./world/ksc/vab");
  createVab(scene, assets);
  createFacilityCluster(scene, assets);
  const { createPad } = await import("./world/ksc/pad");
  createPad(scene, assets);
  const { createMobileLauncher, createCrawler } = await import("./world/ksc/launcher");
  const ml = createMobileLauncher(scene, assets);
  createCrawler(scene, assets);

  setProgress(0.8, "Configuring cinematic pipeline...");
  await nextFrame();
  const caps = capsForTier(tier);
  const pipe = new DefaultRenderingPipeline("cinePipe", true, scene, [camera]);
  pipe.bloomEnabled = true;
  pipe.bloomThreshold = 0.85;
  pipe.bloomWeight = 0.35;
  pipe.bloomKernel = 48;
  pipe.bloomScale = 0.5;
  pipe.depthOfFieldEnabled = caps.dof;
  if (pipe.depthOfFieldEnabled) {
    pipe.depthOfField.focusDistance = 5000;
    pipe.depthOfField.fStop = 2.5e6; // aperture diameter = lensSize/fStop; 50/2.5e6 = 0.00002 (brief's dofAperture)
  }
  pipe.imageProcessingEnabled = true;
  pipe.imageProcessing.toneMappingEnabled = true;
  if (caps.ssao) {
    const ssao = new SSAO2RenderingPipeline("ssao", scene, 0.75, [camera]);
    ssao.totalStrength = 0.85;
    ssao.radius = 1.2;
  }

  setProgress(0.95, "MISSION SYSTEM READY");
  await nextFrame();
  engine.runRenderLoop(() => {
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
    sky.update(dt);
    earth.update(dt);
    // Task 12: mission.update(dt) wires here
    scene.render();
  });
  setProgress(1, "MISSION SYSTEM READY");
  await new Promise((r) => setTimeout(r, 400));
  document.getElementById("loading-screen")!.classList.add("hidden");
  return { tier, sky, earth, ml };
}

boot().catch((err: unknown) => {
  document.getElementById("loading-screen")!.classList.add("hidden");
  document.getElementById("error-screen")!.classList.remove("hidden");
  document.getElementById("error-text")!.textContent = `The simulator could not initialize graphics: ${String(err)}`;
});
