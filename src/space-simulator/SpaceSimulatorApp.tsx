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
import { ZeroGController } from './gameplay/zeroG';
import { sampleAscent, ASCENT_DURATION_S } from './gameplay/trajectory';
import { CountdownTimer } from './core/countdown';
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

        let fsm: GameState = 'LAUNCH_PAD';
        let dockingCtrl: DockingController | null = null;
        let zeroGCtrl: ZeroGController | null = null;
        let countdownTimer: CountdownTimer | null = null;
        let ascentTime = 0;
        let holdT = 0;

        const showLaunchPad = () => {
          fsm = 'LAUNCH_PAD';
          dockingCtrl = null;
          zeroGCtrl = null;
          ascentTime = 0;
          holdT = 0;

          camera.position.set(0, 5, -20);
          camera.setTarget(new Vector3(0, 4, 0));
          orbit.craftRoot.position.set(0, 0, 0);
          orbit.craftRoot.rotationQuaternion = Quaternion.Identity();

          hud.setTitle('CAPE CANAVERAL - PAD 39A');
          hud.setReadout('TARGET: ISS (408 KM ORBIT)\nSTATUS: PRE-LAUNCH SYSTEMS GO');
          hud.setStatus('READY FOR LAUNCH', '#22c55e');
          hud.showMessage('MISSION: EARTH TO ISS\n\nPRESS SPACE / CLICK TO INITIATE COUNTDOWN');
          hud.onAction('INITIATE LAUNCH', startCountdown);
        };

        const startCountdown = () => {
          if (!canTransition(fsm, 'INITIATE_LAUNCH')) return;
          fsm = transition(fsm, 'INITIATE_LAUNCH');
          hud.hideMessage();
          hud.hideAction();
          hud.setTitle('T-MINUS COUNTDOWN');
          hud.setStatus('IGNITION SEQUENCE START', '#eab308');

          countdownTimer = new CountdownTimer({ ticks: 5, tickMs: 1000 });
          countdownTimer.onTick((val) => {
            if (val > 0) {
              hud.showCountdown(val);
              hud.setReadout(`T-${val} SECONDS\nENGINES ARMED\nPRESS 'S' TO SKIP TO ORBIT`);
            }
          });
          countdownTimer.onLiftoff(() => {
            hud.showCountdown('LIFTOFF!');
            setTimeout(() => {
              hud.hideCountdown();
            }, 1200);
          });
          countdownTimer.start();
        };

        const skipAscent = () => {
          if (!canTransition(fsm, 'SKIP_CUTSCENE')) return;
          fsm = transition(fsm, 'SKIP_CUTSCENE');
          enterOrbitApproach();
        };

        const enterOrbitApproach = () => {
          hud.hideCountdown();
          hud.hideMessage();
          camera.position.set(26, 14, -64);
          camera.setTarget(Vector3.Zero());
          orbit.craftRoot.position.set(0, 0, 0);

          hud.setTitle('ORBIT INSERTION COMPLETE');
          hud.setReadout('ALTITUDE: 408 KM\nVELOCITY: 7.66 KM/S\nTARGET LOCK: ISS DOCKING ADAPTER');
          hud.setStatus('PROXIMITY RADAR ACTIVE', '#38bdf8');
          hud.showMessage('ORBITAL RENDEZVOUS COMPLETE\n\nREADY FOR TERMINAL APPROACH & DOCKING');
          hud.onAction('BEGIN DOCKING SEQUENCE', startDocking);
        };

        const startDocking = () => {
          if (!canTransition(fsm, 'ISS_IN_RANGE')) return;
          fsm = transition(fsm, 'ISS_IN_RANGE');
          dockingCtrl = new DockingController();
          holdT = 0;
          hud.hideMessage();
          hud.hideAction();
        };

        const enterISSSurvey = () => {
          fsm = transition(fsm, 'DOCK_SUCCESS');
          zeroGCtrl = new ZeroGController();
          zeroGCtrl.position.set(0, 2, -15);
          hud.setTitle('ISS ZERO-G EXPLORATION');
          hud.setReadout('USE W/A/S/D/Q/E TO FLY AROUND ISS\nARROW KEYS TO ROTATE CAMERA\nSHIFT: BOOST | CTRL/X: BRAKE');
          hud.setStatus('ZERO-G SURVEY IN PROGRESS', '#22c55e');
          hud.showMessage('DOCKING SUCCESSFUL!\n\nPERFORM EXTERIOR INSPECTION OF ISS');
          hud.onAction('COMPLETE MISSION', finishMission);
        };

        const finishMission = () => {
          if (!canTransition(fsm, 'OBJECTIVES_COMPLETE')) return;
          fsm = transition(fsm, 'OBJECTIVES_COMPLETE');
          audio.setVoiceActive(false);
          hud.hideAction();
          hud.setTitle('MISSION ACCOMPLISHED');
          hud.setReadout('EARTH TO ISS TRAJECTORY FLIGHT LOG ARCHIVED');
          hud.setStatus('100% FLIGHT OBJECTIVES MET', '#22c55e');
          hud.showMessage('MISSION COMPLETE!\nCONGRATULATIONS ASTRONAUT.');
          hud.onAction('RESTART MISSION', restart);
        };

        const restart = () => {
          if (canTransition(fsm, 'RETURN_TO_MENU')) {
            fsm = transition(fsm, 'RETURN_TO_MENU');
            if (canTransition(fsm, 'START_MISSION')) {
              fsm = transition(fsm, 'START_MISSION');
            }
          }
          showLaunchPad();
        };

        scene.onBeforeRenderObservable.add(() => {
          const fps = eng.getFps();
          quality.recordFps(fps);
          eng.setHardwareScalingLevel(1 / quality.renderScale);
          const dt = Math.min(eng.getDeltaTime() / 1000, 0.05);

          if (fsm === 'ASCENT_CINEMATIC') {
            if (countdownTimer && countdownTimer.phase !== 'LIFTOFF') {
              countdownTimer.update();
            } else {
              ascentTime += dt * 3.5;
              const ascent = sampleAscent(ascentTime);
              const altitudeKm = (ascent.altitudeM / 1000).toFixed(1);
              const speedKmh = ((ascent.speedMs * 3600) / 1000).toFixed(0);

              hud.setTitle(`STAGE ${ascent.stage} ASCENT PROFILE`);
              hud.setReadout(
                `ALTITUDE:   ${altitudeKm} KM\n` +
                `VELOCITY:   ${speedKmh} KM/H\n` +
                `PITCH:      ${ascent.pitchDeg.toFixed(1)}°\n` +
                `STAGE:      ${ascent.stage}\n\n` +
                `PRESS 'S' OR CLICK BUTTON TO SKIP CUTSCENE`,
              );
              hud.setStatus('ASCENT TRAJECTORY NOMINAL', '#22c55e');
              hud.onAction('SKIP CUTSCENE', skipAscent);

              const climbHeight = (ascentTime / ASCENT_DURATION_S) * 40;
              orbit.craftRoot.position.set(0, climbHeight, 0);
              orbit.craftRoot.rotationQuaternion = Quaternion.RotationYawPitchRoll(0, 0, (ascent.pitchDeg - 90) * (Math.PI / 180));

              camera.position.set(15, climbHeight + 6, -30);
              camera.setTarget(orbit.craftRoot.position);

              if (ascentTime >= ASCENT_DURATION_S) {
                if (canTransition(fsm, 'STAGE_SEPARATION_COMPLETE')) {
                  fsm = transition(fsm, 'STAGE_SEPARATION_COMPLETE');
                  enterOrbitApproach();
                }
              }
            }
          } else if (fsm === 'DOCKING_MINIGAME' && dockingCtrl) {
            dockingCtrl.update(dt, controls.poll());

            orbit.craftRoot.position.copyFrom(dockingCtrl.position);
            if (!orbit.craftRoot.rotationQuaternion) {
              orbit.craftRoot.rotationQuaternion = Quaternion.Identity();
            }
            orbit.craftRoot.rotationQuaternion.copyFrom(dockingCtrl.rotation);

            hud.update(dockingCtrl.getState());

            camera.position.set(
              dockingCtrl.position.x + 6,
              dockingCtrl.position.y + 4,
              dockingCtrl.position.z - 10,
            );
            camera.setTarget(dockingCtrl.position);

            holdT = dockingCtrl.isDockable() ? holdT + dt : 0;
            if (holdT >= LOCK_HOLD_S && canTransition(fsm, 'DOCK_SUCCESS')) {
              audio.setVoiceActive(true);
              hud.showMessage('MECHANICAL LOCK — DOCKED!');
              setTimeout(() => {
                hud.hideMessage();
                enterISSSurvey();
              }, 1500);
            }
          } else if (fsm === 'ISS_EXPLORATION' && zeroGCtrl) {
            zeroGCtrl.update(dt, controls.poll());
            camera.position.copyFrom(zeroGCtrl.position);
            const forward = new Vector3(0, 0, 1);
            const viewDir = Vector3.TransformNormal(forward, camera.getWorldMatrix());
            camera.setTarget(camera.position.add(viewDir));
          }
        });

        const onKeyDown = (e: KeyboardEvent) => {
          if (e.code === 'Space' || e.code === 'Enter') {
            if (fsm === 'LAUNCH_PAD') startCountdown();
            else if (fsm === 'ORBIT_APPROACH') startDocking();
          } else if (e.code === 'KeyS' && fsm === 'ASCENT_CINEMATIC') {
            skipAscent();
          }
        };

        window.addEventListener('keydown', onKeyDown);

        eng.runRenderLoop(() => {
          if (isActive) scene.render();
        });

        const onResize = () => eng.resize();
        window.addEventListener('resize', onResize);

        cleanupScene = () => {
          window.removeEventListener('keydown', onKeyDown);
          window.removeEventListener('resize', onResize);
          controls.detach();
          hud.dispose();
          postProcess.dispose();
          orbit.dispose();
          scene.dispose();
        };

        showLaunchPad();
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
