/**
 * Space Simulator: Earth to ISS Journey — Main Application Orchestrator
 * (PRD §1, §2, §3, §21).
 */

import { Scene } from '@babylonjs/core';
import { createBestEngine, setupContextLossRecovery } from './core/engine';
import { GameStateMachine, type GameState } from './core/state';
import { AudioManager, type AudioBusName } from './core/audio';
import { InputManager } from './core/input';
import { HUDManager } from './ui/HUDManager';
import { CameraDirector } from './cameras/CameraDirector';
import { detectTier, type QualityTier } from './core/quality';
import { saveProgress } from './core/progress';

import { LaunchPadScene } from './scenes/LaunchPadScene';
import { AscentScene } from './scenes/AscentScene';
import { OrbitDockingScene } from './scenes/OrbitDockingScene';
import { ISSInteriorScene } from './scenes/ISSInteriorScene';

class SpaceSimulatorApp {
  private engine!: import('@babylonjs/core').Engine;
  private scene!: Scene;
  private gsm: GameStateMachine;
  private audio: AudioManager;
  private input: InputManager;
  private hud: HUDManager;
  private cameraDirector!: CameraDirector;
  tier: QualityTier;

  // Scene instances
  private launchScene: LaunchPadScene | null = null;
  private ascentScene: AscentScene | null = null;
  private dockingScene: OrbitDockingScene | null = null;
  private issScene: ISSInteriorScene | null = null;

  constructor() {
    this.gsm = new GameStateMachine('IDLE_MENU');
    this.audio = new AudioManager();
    this.input = new InputManager();
    this.hud = new HUDManager();
    this.tier = detectTier();
  }

  async init(): Promise<void> {
    const canvas = document.getElementById('space-canvas') as HTMLCanvasElement;
    const fallback = document.getElementById('fallback-screen') as HTMLElement;

    try {
      const initRes = await createBestEngine(canvas);
      this.engine = initRes.engine;

      this.scene = new Scene(this.engine);
      this.cameraDirector = new CameraDirector(this.scene);

      // WebGL context loss recovery (PRD §17)
      setupContextLossRecovery(
        this.engine,
        () => console.warn('WebGL context lost'),
        () => this.rebuildCurrentScene()
      );

      // Window resize listener
      window.addEventListener('resize', () => {
        this.engine.resize();
      });

      // Hook UI & HUD callbacks
      this.setupHUDCallbacks();

      // State machine transitions
      this.gsm.onChange((nextState) => {
        this.handleStateChange(nextState);
      });

      // Load initial scene
      this.handleStateChange('IDLE_MENU');

      // Main Engine Render Loop
      this.engine.runRenderLoop(() => {
        const dt = this.engine.getDeltaTime() / 1000;
        this.update(dt);
        this.scene.render();
        this.input.clearLook();
      });

    } catch (err) {
      console.error('Fatal 3D Engine Initialization Error:', err);
      if (canvas) canvas.classList.add('hidden');
      if (fallback) fallback.classList.remove('hidden');
    }
  }

  private setupHUDCallbacks(): void {
    this.hud.onStartMission = () => {
      this.gsm.transition('LAUNCH_PAD');
    };

    this.hud.onInitiateLaunch = () => {
      if (this.launchScene) {
        this.launchScene.startCountdown();
      }
    };

    this.hud.onSkipCutscene = () => {
      if (this.gsm.state === 'LAUNCH_PAD' && this.launchScene) {
        this.launchScene.skipToAscent();
      } else if (this.gsm.state === 'ASCENT' && this.ascentScene) {
        this.ascentScene.skip();
      } else if ((this.gsm.state === 'ORBIT' || this.gsm.state === 'DOCKING') && this.dockingScene) {
        this.dockingScene.skip();
      }
    };

    this.hud.onCycleCamera = () => {
      if (this.ascentScene) {
        this.ascentScene.cycleCamera();
      }
    };

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyC') {
        if (this.ascentScene) {
          this.ascentScene.cycleCamera();
        }
      }
    });

    this.hud.onQualityChange = (tier) => {
      this.tier = tier;
    };

    this.hud.onVolumeChange = (bus, vol) => {
      this.audio.setBusVolume(bus as AudioBusName, vol);
    };

    this.hud.onReducedMotionChange = (enabled) => {
      if (this.cameraDirector) {
        this.cameraDirector.reducedMotion = enabled;
      }
    };

    this.hud.onToggleFlashlight = () => {
      if (this.issScene) {
        this.issScene.toggleFlashlight();
      }
    };
  }

  private handleStateChange(state: GameState): void {
    this.hud.setState(state);
    this.clearCurrentScenes();

    switch (state) {
      case 'IDLE_MENU':
        // Show launch pad in background of main menu
        this.launchScene = new LaunchPadScene(
          this.scene,
          this.cameraDirector,
          this.audio,
          () => this.gsm.transition('ASCENT')
        );
        break;

      case 'LAUNCH_PAD':
        this.launchScene = new LaunchPadScene(
          this.scene,
          this.cameraDirector,
          this.audio,
          () => this.gsm.transition('ASCENT')
        );
        this.launchScene.countdown.onTick.add((val) => {
          this.hud.updateCountdown(val);
        });
        break;

      case 'ASCENT':
        saveProgress({ lastCheckpoint: 'CHECKPOINT_LAUNCH', dockingCompleted: false, issExplorationCompleted: false });
        this.ascentScene = new AscentScene(
          this.scene,
          this.cameraDirector,
          this.audio,
          (telemetry) => this.hud.updateAscentTelemetry(telemetry),
          () => this.gsm.transition('ORBIT')
        );
        break;

      case 'ORBIT':
      case 'DOCKING':
        saveProgress({ lastCheckpoint: 'CHECKPOINT_ORBIT', dockingCompleted: false, issExplorationCompleted: false });
        this.dockingScene = new OrbitDockingScene(
          this.scene,
          this.cameraDirector,
          this.audio,
          (dockState) => this.hud.updateDockingHUD(dockState),
          () => {
            saveProgress({ lastCheckpoint: 'CHECKPOINT_DOCKED', dockingCompleted: true, issExplorationCompleted: false });
            this.gsm.transition('ISS_EXPLORATION');
          }
        );
        break;

      case 'ISS_EXPLORATION':
        saveProgress({ lastCheckpoint: 'CHECKPOINT_ISS', dockingCompleted: true, issExplorationCompleted: false });
        this.issScene = new ISSInteriorScene(
          this.scene,
          this.cameraDirector,
          this.audio,
          (promptInfo) => this.hud.updateISSPrompt(promptInfo),
          () => {
            saveProgress({ lastCheckpoint: 'CHECKPOINT_ISS', dockingCompleted: true, issExplorationCompleted: true });
            this.gsm.transition('MISSION_COMPLETE');
          }
        );
        break;

      case 'MISSION_COMPLETE':
        this.audio.startSpaceAmbient();
        break;
    }
  }

  private clearCurrentScenes(): void {
    if (this.launchScene) {
      this.launchScene.dispose();
      this.launchScene = null;
    }
    if (this.ascentScene) {
      this.ascentScene.dispose();
      this.ascentScene = null;
    }
    if (this.dockingScene) {
      this.dockingScene.dispose();
      this.dockingScene = null;
    }
    if (this.issScene) {
      this.issScene.dispose();
      this.issScene = null;
    }
  }

  private rebuildCurrentScene(): void {
    this.handleStateChange(this.gsm.state);
  }

  private update(dt: number): void {
    if (this.launchScene) {
      this.launchScene.update(dt);
    } else if (this.ascentScene) {
      this.ascentScene.update(dt);
    } else if (this.dockingScene) {
      this.dockingScene.update(dt);
    } else if (this.issScene) {
      this.issScene.update(dt, this.input.state);
    }
  }
}

// Bootstrap app on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  const app = new SpaceSimulatorApp();
  app.init();
});
