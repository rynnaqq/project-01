import { useEffect, useRef, useState } from 'react';
import { Engine } from '@babylonjs/core/Engines/engine';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.dynamicTexture';
import '@babylonjs/core/Engines/Extensions/engine.dynamicTexture';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import {
  canTransition,
  transition,
  type GameState,
} from './core/gameStateManager';
import { DockingController } from './gameplay/docking';
import { KeyboardMouseInput } from './core/inputAdapter';
import { DockingHUD } from './ui/dockingHud';
import { buildOrbitScene } from './scenes/orbitScene';
import { QualityManager, type QualityTier } from './core/qualityManager';
import { AudioMixer } from './core/audioMixer';
import { PostProcessManager } from './rendering/postProcess';

const LOCK_HOLD_S = 1;

export default function SpaceSimulatorApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let engine: Engine | WebGPUEngine | undefined;
    let isActive = true;
    let cleanupScene: (() => void) | null = null;

    async function init() {
      try {
        const prefersReducedMotion = window.matchMedia(
          '(prefers-reduced-motion: reduce)',
        ).matches;
        const initialTier: QualityTier = 'HIGH';
        const quality = new QualityManager(initialTier, prefersReducedMotion);
        const audio = new AudioMixer();

        const webgpuSupported = await WebGPUEngine.IsSupportedAsync;
        if (webgpuSupported) {
          const webgpu = new WebGPUEngine(canvas);
          await webgpu.initAsync();
          engine = webgpu;
        } else {
          engine = new Engine(canvas, true);
        }

        if (!isActive) {
          engine.dispose();
          return;
        }
        const eng = engine;

        const scene = new Scene(eng);
        const camera = new FreeCamera(
          'chase-cam',
          new Vector3(26, 14, -64),
          scene,
        );
        camera.setTarget(Vector3.Zero());
        camera.maxZ = 8000;

        const postProcess = new PostProcessManager(scene, camera, quality.settings);
        const orbit = buildOrbitScene(scene);
        const hud = new DockingHUD(scene);
        const controls = new KeyboardMouseInput();
        controls.attach();

        let fsm: GameState = 'ORBIT_APPROACH';
        let controller: DockingController | null = null;
        let holdT = 0;

        const beginApproach = () => {
          if (!canTransition(fsm, 'ISS_IN_RANGE')) return;
          fsm = transition(fsm, 'ISS_IN_RANGE');
          controller = new DockingController();
          holdT = 0;
          hud.hideMessage();
          hud.hideAction();
        };

        const showIntro = () => {
          hud.showMessage(
            'SPACE SIMULATOR\nEARTH → ISS JOURNEY\n\nEARTH ORBIT — PRESS ENTER TO BEGIN APPROACH',
          );
          hud.onAction('BEGIN APPROACH', beginApproach);
        };

        const restart = () => {
          fsm = transition(fsm, 'RETURN_TO_MENU');
          fsm = transition(fsm, 'START_MISSION');
          fsm = transition(fsm, 'INITIATE_LAUNCH');
          fsm = transition(fsm, 'SKIP_CUTSCENE');
          controller = null;
          camera.position.set(26, 14, -64);
          camera.setTarget(Vector3.Zero());
          showIntro();
        };

        const completeMission = () => {
          if (!canTransition(fsm, 'OBJECTIVES_COMPLETE')) return;
          fsm = transition(fsm, 'OBJECTIVES_COMPLETE');
          audio.setVoiceActive(false);
          hud.showMessage('MISSION COMPLETE\nEARTH → ISS JOURNEY');
          hud.onAction('RESTART MISSION', () => {
            if (fsm !== 'MISSION_COMPLETE') return;
            restart();
          });
        };

        scene.onBeforeRenderObservable.add(() => {
          const fps = eng.getFps();
          quality.recordFps(fps);
          eng.setHardwareScalingLevel(1 / quality.renderScale);

          if (fsm !== 'DOCKING_MINIGAME' || !controller) return;
          const dt = Math.min(eng.getDeltaTime() / 1000, 0.05);
          controller.update(dt, controls.poll());

          orbit.craftRoot.position.copyFrom(controller.position);
          if (!orbit.craftRoot.rotationQuaternion) {
            orbit.craftRoot.rotationQuaternion = Quaternion.Identity();
          }
          orbit.craftRoot.rotationQuaternion.copyFrom(controller.rotation);

          hud.update(controller.getState());

          camera.position.set(
            controller.position.x + 6,
            controller.position.y + 4,
            controller.position.z - 10,
          );
          camera.setTarget(controller.position);

          holdT = controller.isDockable() ? holdT + dt : 0;
          if (holdT >= LOCK_HOLD_S && canTransition(fsm, 'DOCK_SUCCESS')) {
            fsm = transition(fsm, 'DOCK_SUCCESS');
            audio.setVoiceActive(true);
            hud.showMessage('MECHANICAL LOCK — DOCKED');
            hud.onAction('CONTINUE', completeMission);
          }
        });

        const onKeyDown = (e: KeyboardEvent) => {
          if (e.code === 'Enter') beginApproach();
        };
        const onPointerDown = () => beginApproach();
        window.addEventListener('keydown', onKeyDown);
        canvas.addEventListener('pointerdown', onPointerDown);

        eng.runRenderLoop(() => {
          if (isActive) scene.render();
        });

        const onResize = () => eng.resize();
        window.addEventListener('resize', onResize);

        cleanupScene = () => {
          window.removeEventListener('keydown', onKeyDown);
          window.removeEventListener('resize', onResize);
          canvas.removeEventListener('pointerdown', onPointerDown);
          controls.detach();
          hud.dispose();
          postProcess.dispose();
          orbit.dispose();
          scene.dispose();
        };

        showIntro();
      } catch (err) {
        if (isActive) {
          setError(
            err instanceof Error ? err.message : '3D_ENGINE_UNAVAILABLE',
          );
        }
      }
    }

    void init();

    return () => {
      isActive = false;
      cleanupScene?.();
      engine?.dispose();
      cleanupScene = null;
    };
  }, []);

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black p-8 text-center text-white">
        <h2 className="mb-4 text-2xl font-bold text-red-500">
          3D ENGINE UNAVAILABLE
        </h2>
        <p className="text-gray-300">
          Your browser/device cannot run this 3D experience.
        </p>
        <p className="mt-4 text-sm text-gray-500">{error}</p>
        <a
          href="/"
          className="mt-8 rounded bg-gray-800 px-6 py-2 hover:bg-gray-700"
        >
          Return to Hub
        </a>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      id="space-canvas"
      className="fixed inset-0 h-full w-full touch-none bg-black"
    />
  );
}
