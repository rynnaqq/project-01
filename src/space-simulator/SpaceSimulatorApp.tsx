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
import { sampleAscent, ASCENT_DURATION_S, SEPARATION_TIME_S } from './gameplay/trajectory';
import { CountdownTimer } from './core/countdown';
import { InputManager } from './core/inputAdapter';
import { DockingHUD } from './ui/dockingHud';
import { buildLaunchPadScene, type LaunchPadHandles } from './scenes/launchPadScene';
import { buildOrbitScene, type OrbitHandles } from './scenes/orbitScene';
import { buildISSInteriorScene, type ISSInteriorHandles } from './scenes/issInteriorScene';
import { QualityManager, type QualityTier } from './core/qualityManager';
import { AudioMixer } from './core/audioMixer';
import { AudioSynthesizer } from './core/audioSynth';
import { ProgressManager, type CheckpointId } from './core/progressManager';
import { CameraDirector, type ShotName } from './rendering/cameraDirector';
import { ParticleManager } from './rendering/particleManager';
import { PostProcessManager } from './rendering/postProcess';
import { SpaceSimulatorUI } from './ui/SpaceSimulatorUI';

const LOCK_HOLD_S = 1.5;

export default function SpaceSimulatorApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  // React UI state
  const [fsmState, setFsmState] = useState<GameState>('IDLE_MENU');
  const [qualityTier, setQualityTier] = useState<QualityTier>('HIGH');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [masterVol, setMasterVol] = useState(1.0);
  const [sfxVol, setSfxVol] = useState(1.0);
  const [voiceVol, setVoiceVol] = useState(1.0);
  const [ambientVol, setAmbientVol] = useState(1.0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [cupolaActive, setCupolaActive] = useState(false);

  const progressMgrRef = useRef(new ProgressManager());
  const [progress, setProgress] = useState(progressMgrRef.current.getProgress());

  // Callbacks passed to 3D engine loop
  const engineActionsRef = useRef<{
    startMission: () => void;
    resumeCheckpoint: (cp: CheckpointId) => void;
    skipAscent: () => void;
    toggleFlashlight: () => void;
    setQualityTier: (tier: QualityTier) => void;
    setReducedMotion: (reduced: boolean) => void;
    setVolumes: (master: number, sfx: number, voice: number, ambient: number) => void;
    toggleMute: () => void;
    setTouchMove: (x: number, y: number, z: number) => void;
    setTouchLook: (x: number, y: number) => void;
    setTouchButtons: (boost: boolean, brake: boolean, interact: boolean) => void;
  } | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let engine: Engine | WebGPUEngine | undefined;
    let isActive = true;
    let cleanupScene: (() => void) | null = null;

    async function init() {
      try {
        const prefersReduced = window.matchMedia(
          '(prefers-reduced-motion: reduce)',
        ).matches;
        setReducedMotion(prefersReduced);

        const quality = new QualityManager(qualityTier, prefersReduced);
        const mixer = new AudioMixer();
        const synth = new AudioSynthesizer(mixer);
        const cameraDirector = new CameraDirector(prefersReduced);
        const controls = new InputManager();
        controls.attach();

        // WebGPU preferred, WebGL2 fallback
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
        const camera = new FreeCamera('main-camera', new Vector3(0, 10, -45), scene);
        camera.setTarget(new Vector3(0, 8, 0));
        camera.maxZ = 12000;

        const postProcess = new PostProcessManager(scene, camera, quality.settings);
        const particles = new ParticleManager(scene, quality.settings);
        const hud = new DockingHUD(scene);

        synth.setCaptionCallback((caption) => {
          hud.showCaption(caption);
          setTimeout(() => hud.hideCaption(), 4000);
        });

        // Scene Handles
        let launchPad: LaunchPadHandles | null = null;
        let orbitScene: OrbitHandles | null = null;
        let issInterior: ISSInteriorHandles | null = null;

        let fsm: GameState = 'IDLE_MENU';
        let dockingCtrl: DockingController | null = null;
        let zeroGCtrl: ZeroGController | null = null;
        let countdownTimer: CountdownTimer | null = null;
        let ascentTime = 0;
        let holdT = 0;
        let activeInteractableIndex = -1;
        let cupolaViewing = false;

        const syncFsm = (next: GameState) => {
          fsm = next;
          setFsmState(next);
        };

        const disposeAllScenes = () => {
          launchPad?.dispose();
          launchPad = null;
          orbitScene?.dispose();
          orbitScene = null;
          issInterior?.dispose();
          issInterior = null;
          particles.stopLaunchParticles();
          hud.setReticleVisible(false);
          hud.hideInteractPrompt();
          hud.hideInfoPanel();
        };

        // 1. Enter Main Menu / Idle
        const showMainMenu = () => {
          syncFsm('IDLE_MENU');
          disposeAllScenes();
          synth.stopEngineRumble();
          synth.stopSpaceAmbience();
          synth.stopInteriorAmbience();

          // Orbit background for menu
          orbitScene = buildOrbitScene(scene);
          camera.position.set(35, 12, -75);
          camera.setTarget(Vector3.Zero());

          hud.setTitle('');
          hud.setReadout('');
          hud.setStatus('');
          hud.hideMessage();
          hud.hideAction();
          hud.hideCountdown();
          setCupolaActive(false);
        };

        // 2. Enter Launch Pad
        const enterLaunchPad = () => {
          if (!canTransition(fsm, 'START_MISSION')) return;
          syncFsm(transition(fsm, 'START_MISSION'));
          disposeAllScenes();
          progressMgrRef.current.reachCheckpoint('CHECKPOINT_LAUNCH');
          setProgress(progressMgrRef.current.getProgress());

          launchPad = buildLaunchPadScene(scene);
          particles.createLaunchPadEffects(launchPad.rocketRoot);
          synth.startSpaceAmbience();

          camera.position.set(0, 8, -42);
          camera.setTarget(new Vector3(0, 18, 0));

          hud.setTitle('KENNEDY SPACE CENTER - PAD 39A');
          hud.setReadout('VEHICLE: CREW EXPEDITION ROCKET\nTARGET: ISS (408 KM LOW EARTH ORBIT)\nSYSTEMS: GO FOR FLIGHT');
          hud.setStatus('STANDBY FOR LAUNCH COUNTDOWN', '#38bdf8');
          hud.showMessage('MISSION: EARTH TO ISS\n\nPRESS SPACE / INITIATE LAUNCH');
          hud.onAction('INITIATE LAUNCH', startCountdown);
        };

        // 3. Initiate Countdown
        const startCountdown = () => {
          if (!canTransition(fsm, 'INITIATE_LAUNCH')) return;
          syncFsm(transition(fsm, 'INITIATE_LAUNCH'));
          synth.unlock();
          hud.hideMessage();
          hud.hideAction();
          hud.setTitle('COUNTDOWN SEQUENCE');
          hud.setStatus('TERMINAL COUNTDOWN RUNNING', '#eab308');

          launchPad?.retractServiceArm();

          countdownTimer = new CountdownTimer({ ticks: 10, tickMs: 1000 });
          countdownTimer.onTick((val) => {
            if (val > 0) {
              synth.playCountdownTick(val);
              hud.showCountdown(val);
              hud.setReadout(`T-${val} SECONDS\nGUIDANCE INTERNAL\nPRESS 'S' TO SKIP CUTSCENE`);
              if (val === 3) {
                synth.playIgnition();
                particles.triggerIgnition();
                cameraDirector.triggerPresetShake('ENGINE_IGNITION');
              }
            }
          });

          countdownTimer.onLiftoff(() => {
            synth.playCountdownTick(0);
            synth.startEngineRumble();
            particles.setThrustLevel(1.0);
            cameraDirector.triggerPresetShake('MAX_Q');
            hud.showCountdown('LIFTOFF!');
            setTimeout(() => {
              hud.hideCountdown();
            }, 1500);
          });

          countdownTimer.start();
        };

        // 4. Skip Ascent
        const skipAscent = () => {
          if (!canTransition(fsm, 'SKIP_CUTSCENE')) return;
          syncFsm(transition(fsm, 'SKIP_CUTSCENE'));
          synth.stopEngineRumble();
          enterOrbitApproach();
        };

        // 5. Enter Orbit Approach
        const enterOrbitApproach = () => {
          disposeAllScenes();
          synth.stopEngineRumble();
          synth.startSpaceAmbience();
          progressMgrRef.current.reachCheckpoint('CHECKPOINT_ORBIT');
          setProgress(progressMgrRef.current.getProgress());

          orbitScene = buildOrbitScene(scene);
          camera.position.set(22, 10, -55);
          camera.setTarget(Vector3.Zero());
          orbitScene.craftRoot.position.set(16, 5, 20);

          hud.hideCountdown();
          hud.hideMessage();
          hud.setTitle('ORBIT INSERTION CONFIRMED');
          hud.setReadout('ALTITUDE: 408.4 KM\nORBITAL VELOCITY: 7.66 KM/S\nTARGET: ISS DOCKING ADAPTER PMA-2');
          hud.setStatus('APPROACH CORRIDOR ACTIVE', '#38bdf8');
          hud.showMessage('ORBITAL RENDEZVOUS COMPLETE\n\nBEGIN MANUAL DOCKING PROCEDURE');
          hud.onAction('BEGIN DOCKING SEQUENCE', startDocking);
        };

        // 6. Start Docking Minigame
        const startDocking = () => {
          if (!canTransition(fsm, 'ISS_IN_RANGE')) return;
          syncFsm(transition(fsm, 'ISS_IN_RANGE'));
          dockingCtrl = new DockingController();
          holdT = 0;
          hud.hideMessage();
          hud.hideAction();
          hud.setReticleVisible(true);
        };

        // 7. Dock Success -> Enter ISS Interior Exploration
        const enterISSInterior = () => {
          syncFsm(transition(fsm, 'DOCK_SUCCESS'));
          disposeAllScenes();
          synth.stopSpaceAmbience();
          synth.startInteriorAmbience();
          progressMgrRef.current.reachCheckpoint('CHECKPOINT_ISS');
          setProgress(progressMgrRef.current.getProgress());

          issInterior = buildISSInteriorScene(scene);
          zeroGCtrl = new ZeroGController();
          zeroGCtrl.position.set(0, 0, -8);
          camera.position.copyFrom(zeroGCtrl.position);

          hud.setTitle('ISS DESTINY MODULE - ZERO-G');
          hud.setReadout('CABIN PRESSURE: 101.3 kPa\nGRAVITY: 0.0001 G\nSTATUS: CREW INGRESS COMPLETE');
          hud.setStatus('ZERO-G SURVEY ACTIVE', '#22c55e');
          hud.showMessage('DOCKING SUCCESSFUL!\n\nEXPLORE MODULE & VISIT CUPOLA OBSERVATION BAY');
          hud.onAction('DISMISS', () => hud.hideMessage());
        };

        // 8. Mission Complete
        const finishMission = () => {
          if (!canTransition(fsm, 'OBJECTIVES_COMPLETE')) return;
          syncFsm(transition(fsm, 'OBJECTIVES_COMPLETE'));
          synth.stopInteriorAmbience();
          synth.playRadioChime();
          progressMgrRef.current.reachCheckpoint('CHECKPOINT_ISS');
          setProgress(progressMgrRef.current.getProgress());

          hud.hideAction();
          hud.hideInteractPrompt();
          hud.hideInfoPanel();
          hud.setTitle('EXPEDITION COMPLETE');
          hud.setReadout(
            'FLIGHT REPORT:\n' +
            '&bull; Launch & Ascent: Nominal\n' +
            '&bull; Orbit Rendezvous: Target Locked\n' +
            '&bull; Precision Docking: 100% Alignment\n' +
            '&bull; ISS Systems & Cupola: Surveyed',
          );
          hud.setStatus('ALL PRIMARY OBJECTIVES ACHIEVED', '#22c55e');
          hud.showMessage('MISSION ACCOMPLISHED!\n\nCONGRATULATIONS ASTRONAUT.');
          hud.onAction('RETURN TO MAIN MENU', () => {
            if (canTransition(fsm, 'RETURN_TO_MENU')) {
              syncFsm(transition(fsm, 'RETURN_TO_MENU'));
              showMainMenu();
            }
          });
        };

        // Frame Render Loop
        scene.onBeforeRenderObservable.add(() => {
          const fps = eng.getFps();
          quality.recordFps(fps);
          eng.setHardwareScalingLevel(1 / quality.renderScale);
          const dt = Math.min(eng.getDeltaTime() / 1000, 0.05);

          progressMgrRef.current
          cameraDirector.update(dt, camera);

          if (orbitScene) {
            orbitScene.update(dt);
          }

          // State-specific Updates
          if (fsm === 'ASCENT_CINEMATIC') {
            if (countdownTimer && countdownTimer.phase !== 'LIFTOFF') {
              countdownTimer.update();
            } else {
              ascentTime += dt * 2.8;
              const ascent = sampleAscent(ascentTime);
              const altitudeKm = (ascent.altitudeM / 1000).toFixed(1);
              const speedKmh = ((ascent.speedMs * 3600) / 1000).toFixed(0);

              hud.setTitle(`STAGE ${ascent.stage} ASCENT TRAJECTORY`);
              hud.setReadout(
                `ALTITUDE:   ${altitudeKm} KM\n` +
                `VELOCITY:   ${speedKmh} KM/H\n` +
                `PITCH:      ${ascent.pitchDeg.toFixed(1)}°\n` +
                `STAGE:      ${ascent.stage}\n\n` +
                `PRESS 'S' TO SKIP CUTSCENE`,
              );
              hud.setStatus('GRAVITY TURN PROFILE NOMINAL', '#22c55e');
              hud.onAction('SKIP CUTSCENE', skipAscent);

              if (launchPad) {
                const climbHeight = (ascentTime / ASCENT_DURATION_S) * 90;
                launchPad.rocketRoot.position.set(0, climbHeight + 2.5, 0);
                launchPad.rocketRoot.rotationQuaternion = Quaternion.RotationYawPitchRoll(
                  0,
                  0,
                  (ascent.pitchDeg - 90) * (Math.PI / 180),
                );

                if (ascentTime >= SEPARATION_TIME_S && ascent.stage === 2) {
                  launchPad.separateStage1();
                  cameraDirector.triggerPresetShake('STAGE_SEPARATION');
                }

                // Dynamic Cinematic Camera Shot Selection
                let shot: ShotName = 'SHOT_01_GROUND';
                if (ascentTime < 6) shot = 'SHOT_01_GROUND';
                else if (ascentTime < 18) shot = 'SHOT_02_BOOSTER';
                else if (ascentTime < 26) shot = 'SHOT_03_COCKPIT';
                else if (ascentTime < 34) shot = 'SHOT_04_SEPARATION';
                else shot = 'SHOT_05_ORBIT';

                const shotPose = cameraDirector.computeShotCamera(
                  shot,
                  launchPad.rocketRoot.position,
                );
                camera.position.copyFrom(shotPose.position);
                camera.setTarget(shotPose.target);
              }

              if (ascentTime >= ASCENT_DURATION_S) {
                if (canTransition(fsm, 'STAGE_SEPARATION_COMPLETE')) {
                  syncFsm(transition(fsm, 'STAGE_SEPARATION_COMPLETE'));
                  enterOrbitApproach();
                }
              }
            }
          } else if (fsm === 'DOCKING_MINIGAME' && dockingCtrl && orbitScene) {
            const input = controls.poll();
            dockingCtrl.update(dt, input);

            if (input.moveX !== 0 || input.moveY !== 0 || input.moveZ !== 0) {
              synth.playRcsBurst();
            }

            orbitScene.craftRoot.position.copyFrom(dockingCtrl.position);
            if (!orbitScene.craftRoot.rotationQuaternion) {
              orbitScene.craftRoot.rotationQuaternion = Quaternion.Identity();
            }
            orbitScene.craftRoot.rotationQuaternion.copyFrom(dockingCtrl.rotation);

            const dockState = dockingCtrl.getState();
            hud.update(dockState);

            camera.position.set(
              dockingCtrl.position.x + 4.5,
              dockingCtrl.position.y + 2.8,
              dockingCtrl.position.z - 8.5,
            );
            camera.setTarget(dockingCtrl.position);

            holdT = dockingCtrl.isDockable() ? holdT + dt : 0;
            if (holdT >= LOCK_HOLD_S && canTransition(fsm, 'DOCK_SUCCESS')) {
              synth.playDockLatch();
              cameraDirector.triggerPresetShake('DOCKING_CONTACT');
              hud.showMessage('HARD CAPTURE CONFIRMED — DOCKED!');
              hud.setReticleVisible(false);
              setTimeout(() => {
                hud.hideMessage();
                enterISSInterior();
              }, 1800);
            }
          } else if (fsm === 'ISS_EXPLORATION' && zeroGCtrl && issInterior) {
            const input = controls.poll();

            if (controls.flashlightToggled !== undefined) {
              issInterior.setFlashlight(controls.flashlightToggled);
            }

            if (!cupolaViewing) {
              zeroGCtrl.update(dt, input, issInterior.colliders);
              camera.position.copyFrom(zeroGCtrl.position);

              const forward = new Vector3(0, 0, 1);
              const viewDir = Vector3.TransformNormal(forward, camera.getWorldMatrix());
              camera.setTarget(camera.position.add(viewDir));

              issInterior.updateFlashlight(camera.position, viewDir);

              // Check interactable proximity
              let nearestIdx = -1;
              let nearestDist = Infinity;
              issInterior.interactables.forEach((item, idx) => {
                const dist = Vector3.Distance(camera.position, item.position);
                if (dist < item.interactionDistance && dist < nearestDist) {
                  nearestDist = dist;
                  nearestIdx = idx;
                }
              });

              if (nearestIdx !== -1) {
                const targetObj = issInterior.interactables[nearestIdx];
                hud.showInteractPrompt(targetObj.prompt);
                if (input.interact && activeInteractableIndex !== nearestIdx) {
                  activeInteractableIndex = nearestIdx;
                  synth.playUIClick();
                  if (targetObj.isCupola) {
                    cupolaViewing = true;
                    setCupolaActive(true);
                    hud.hideInteractPrompt();
                    hud.showMessage('CUPOLA EARTH VIEW // 408 KM ORBIT\nPRESS [E] / TAP TO EXIT VIEW');
                    hud.onAction('COMPLETE MISSION', finishMission);
                  } else {
                    hud.showInfoPanel(targetObj.infoTitle, targetObj.infoDescription);
                  }
                }
              } else {
                hud.hideInteractPrompt();
                if (!input.interact) {
                  hud.hideInfoPanel();
                  activeInteractableIndex = -1;
                }
              }
            } else {
              // Cupola Observation Mode: Pan camera smoothly down towards Earth through window
              camera.position.copyFrom(issInterior.cupolaCameraPos);
              camera.setTarget(issInterior.cupolaLookTarget);

              if (input.interact) {
                cupolaViewing = false;
                setCupolaActive(false);
                hud.hideMessage();
                synth.playUIClick();
              }
            }
          }
        });

        // Global Keydown shortcuts
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

        // Expose engine actions to React
        engineActionsRef.current = {
          startMission: () => {
            enterLaunchPad();
          },
          resumeCheckpoint: (cp: CheckpointId) => {
            if (cp === 'CHECKPOINT_ORBIT') enterOrbitApproach();
            else if (cp === 'CHECKPOINT_ISS') enterISSInterior();
            else enterLaunchPad();
          },
          skipAscent,
          toggleFlashlight: () => controls.toggleFlashlight(),
          setQualityTier: (tier: QualityTier) => {
            setQualityTier(tier);
            quality.tier = tier;
            postProcess.applySettings(quality.settings);
          },
          setReducedMotion: (reduced: boolean) => {
            setReducedMotion(reduced);
            cameraDirector.setReducedMotion(reduced);
            postProcess.applySettings(quality.settings);
          },
          setVolumes: (master, sfx, voice, ambient) => {
            setMasterVol(master);
            setSfxVol(sfx);
            setVoiceVol(voice);
            setAmbientVol(ambient);
            mixer.setMuted(isMuted);
            synth.updateGains();
          },
          toggleMute: () => {
            setIsMuted((prev) => {
              const next = !prev;
              mixer.setMuted(next);
              synth.updateGains();
              return next;
            });
          },
          setTouchMove: (x, y, z) => controls.setTouchMove(x, y, z),
          setTouchLook: (x, y) => controls.setTouchLook(x, y),
          setTouchButtons: (boost, brake, interact) =>
            controls.setTouchButtons(boost, brake, interact),
        };

        cleanupScene = () => {
          window.removeEventListener('keydown', onKeyDown);
          window.removeEventListener('resize', onResize);
          controls.detach();
          synth.dispose();
          hud.dispose();
          particles.dispose();
          postProcess.dispose();
          disposeAllScenes();
          scene.dispose();
        };

        showMainMenu();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        id="space-canvas"
        className="fixed inset-0 h-full w-full touch-none bg-black"
      />

      <SpaceSimulatorUI
        gameState={fsmState}
        qualityTier={qualityTier}
        reducedMotion={reducedMotion}
        isMuted={isMuted}
        masterVolume={masterVol}
        sfxVolume={sfxVol}
        voiceVolume={voiceVol}
        ambientVolume={ambientVol}
        progress={progress}
        cupolaActive={cupolaActive}
        onStartMission={() => engineActionsRef.current?.startMission()}
        onResumeCheckpoint={() => {
          const cp = progress.lastCheckpoint;
          if (cp) engineActionsRef.current?.resumeCheckpoint(cp);
        }}
        onSetQualityTier={(tier) => engineActionsRef.current?.setQualityTier(tier)}
        onToggleReducedMotion={() =>
          engineActionsRef.current?.setReducedMotion(!reducedMotion)
        }
        onToggleMute={() => engineActionsRef.current?.toggleMute()}
        onSetVolumes={(m, s, v, a) =>
          engineActionsRef.current?.setVolumes(m, s, v, a)
        }
        onTouchMove={(x, y, z) =>
          engineActionsRef.current?.setTouchMove(x, y, z)
        }
        onTouchLook={(x, y) => engineActionsRef.current?.setTouchLook(x, y)}
        onTouchButtons={(boost, brake, interact) =>
          engineActionsRef.current?.setTouchButtons(boost, brake, interact)
        }
        onToggleFlashlight={() =>
          engineActionsRef.current?.toggleFlashlight()
        }
        onSkipCutscene={() => engineActionsRef.current?.skipAscent()}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onCloseSettings={() => setIsSettingsOpen(false)}
        isSettingsOpen={isSettingsOpen}
      />
    </div>
  );
}
