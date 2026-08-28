/**
 * Unified HUD Manager (PRD §9, §14, §19).
 * Manages reactive UI overlays for Main Menu, Launch Countdown,
 * Ascent Telemetry, Docking 6-DOF Reticle, ISS Interaction Prompts,
 * Radio Captions, Settings, and Mission Complete.
 */

import { type GameState } from '../core/state';
import { type AscentSample } from '../gameplay/trajectory';
import { type DockingState, getDockingStatus } from '../gameplay/docking';
import { type InteractionPromptInfo } from '../scenes/ISSInteriorScene';
import { type QualityTier } from '../core/quality';

export class HUDManager {
  private container: HTMLElement;

  // DOM Elements
  private menuEl!: HTMLElement;
  private launchHudEl!: HTMLElement;
  private ascentHudEl!: HTMLElement;
  private dockingHudEl!: HTMLElement;
  private issHudEl!: HTMLElement;
  private captionEl!: HTMLElement;
  private settingsModalEl!: HTMLElement;
  private missionCompleteEl!: HTMLElement;

  // Callbacks
  onStartMission?: () => void;
  onResumeCheckpoint?: (checkpoint: string) => void;
  onInitiateLaunch?: () => void;
  onSkipCutscene?: () => void;
  onRetryDocking?: () => void;
  onCycleCamera?: () => void;
  onToggleFlashlight?: () => void;
  onQualityChange?: (tier: QualityTier) => void;
  onVolumeChange?: (bus: string, vol: number) => void;
  onReducedMotionChange?: (enabled: boolean) => void;

  constructor() {
    this.container = document.getElementById('game-container') || document.body;
    this.buildHTML();
  }

  private buildHTML(): void {
    const hudWrapper = document.createElement('div');
    hudWrapper.id = 'space-hud-root';
    hudWrapper.innerHTML = `
      <!-- Radio Captions Banner -->
      <div id="hud-caption" class="hud-caption hidden">
        <span class="radio-icon">📡</span>
        <span id="caption-text"></span>
      </div>

      <!-- Main Menu -->
      <div id="hud-main-menu" class="hud-layer hud-menu-bg">
        <div class="menu-card">
          <div class="badge">SIMULATION V1.0</div>
          <h1 class="glow-title">SPACE SIMULATOR</h1>
          <h2 class="subtitle">EARTH → ISS JOURNEY</h2>
          <p class="desc">Experience human spaceflight from launch countdown to zero-gravity ISS exploration.</p>
          
          <div class="menu-actions">
            <button id="btn-start-mission" class="btn btn-primary">🚀 START MISSION</button>
            <button id="btn-resume-mission" class="btn btn-secondary hidden">RESUME CHECKPOINT</button>
            <button id="btn-open-settings" class="btn btn-outline">⚙️ SETTINGS</button>
          </div>
          
          <div class="tier-indicator">
            QUALITY: <span id="lbl-current-tier" class="tier-tag">HIGH</span>
          </div>
        </div>
      </div>

      <!-- Launch Pad HUD -->
      <div id="hud-launch" class="hud-layer hidden pointer-events-none">
        <div class="hud-top-bar pointer-events-auto">
          <div class="mission-title">MISSION: EXPEDITION ISS</div>
          <button id="btn-launch-skip" class="btn-hud-sm">SKIP ⏩</button>
        </div>

        <div class="launch-center-box pointer-events-auto">
          <div class="countdown-display" id="lbl-countdown">T-10</div>
          <div class="sub-status" id="lbl-launch-sub">STANDBY FOR AUTO SEQUENCE</div>
          <button id="btn-initiate-launch" class="btn btn-launch">🔥 IGNITION & LIFTOFF</button>
        </div>
      </div>

      <!-- Ascent HUD -->
      <div id="hud-ascent" class="hud-layer hidden pointer-events-none">
        <div class="hud-top-bar pointer-events-auto">
          <div class="mission-title">ASCENT TRAJECTORY</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button id="btn-ascent-camera" class="btn-hud-sm">🎥 CAM [C]</button>
            <button id="btn-ascent-skip" class="btn-hud-sm">SKIP ⏩</button>
          </div>
        </div>

        <div class="telemetry-panel">
          <div class="tele-row"><span>ALTITUDE</span><b id="tel-alt">0 m</b></div>
          <div class="tele-row"><span>VELOCITY</span><b id="tel-vel">0 m/s</b></div>
          <div class="tele-row"><span>PITCH</span><b id="tel-pitch">0.0°</b></div>
          <div class="tele-row"><span>STAGE</span><b id="tel-stage" class="stage-tag">STAGE 1</b></div>
          <div class="tele-row"><span>ENGINE</span><b id="tel-engine" class="status-nom">NOMINAL</b></div>
        </div>
      </div>

      <!-- Docking 6-DOF HUD -->
      <div id="hud-docking" class="hud-layer hidden pointer-events-none">
        <div class="hud-top-bar pointer-events-auto">
          <div class="mission-title">AUTOMATED DOCKING SEQUENCE</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <div id="dock-status-badge" class="dock-badge correcting">CORRECTING</div>
            <button id="btn-docking-skip" class="btn-hud-sm">SKIP ⏩</button>
          </div>
        </div>

        <!-- Center Crosshair & Alignment Ring -->
        <div class="dock-reticle-container">
          <div class="dock-outer-ring">
            <div id="dock-target-dot" class="dock-dot"></div>
          </div>
          <div class="dock-cross-h"></div>
          <div class="dock-cross-v"></div>
          <div id="dock-align-pct" class="dock-score">ALIGN: 75%</div>
        </div>

        <div class="dock-telemetry-box">
          <div class="tele-row"><span>DISTANCE</span><b id="dock-dist">45.0 m</b></div>
          <div class="tele-row"><span>REL SPEED</span><b id="dock-speed">0.60 m/s</b></div>
          <div class="tele-row"><span>YAW / PITCH</span><b id="dock-angles">-6.0° / +4.5°</b></div>
          <div class="dock-instructions">
            <b>AUTONOMOUS GUIDANCE:</b> Flight computer is aligning and dampening relative velocity for soft capture.
          </div>
        </div>
      </div>

      <!-- ISS Interior Interaction HUD -->
      <div id="hud-iss" class="hud-layer hidden pointer-events-none">
        <div class="hud-top-bar pointer-events-auto">
          <div class="mission-title">ISS INTERIOR — ZERO-G</div>
          <button id="btn-flashlight-toggle" class="btn-hud-sm">🔦 FLASHLIGHT [F]</button>
        </div>

        <div class="center-crosshair"></div>

        <div id="interaction-prompt-box" class="interaction-prompt hidden">
          <span class="key-badge">E</span>
          <span id="interaction-prompt-text">Inspect Station Module</span>
        </div>

        <div class="iss-controls-guide">
          <b>Zero-G:</b> [WASD] Move &bull; [Space/Q] Float Up/Down &bull; [Ctrl] Brake &bull; [E] Interact
        </div>
      </div>

      <!-- Mission Complete Screen -->
      <div id="hud-mission-complete" class="hud-layer hud-menu-bg hidden">
        <div class="menu-card">
          <div class="badge success">EXPEDITION COMPLETE</div>
          <h1 class="glow-title">MISSION SUCCESS</h1>
          <p class="desc">You have successfully launched from Earth, completed 6-DOF docking with the International Space Station, and explored the microgravity research laboratory.</p>
          
          <div class="stats-box">
            <div class="stat-item"><label>ORBIT ALTITUDE</label><b>408 KM</b></div>
            <div class="stat-item"><label>DOCKING ACCURACY</label><b>100%</b></div>
            <div class="stat-item"><label>STATUS</label><b>NOMINAL</b></div>
          </div>

          <div class="menu-actions">
            <button id="btn-replay-mission" class="btn btn-primary">🔄 REPLAY MISSION</button>
            <a href="/" class="btn btn-outline">RETURN TO ARCADE</a>
          </div>
        </div>
      </div>

      <!-- Settings Modal -->
      <div id="hud-settings-modal" class="modal-overlay hidden">
        <div class="modal-card">
          <div class="modal-header">
            <h3>SIMULATION SETTINGS</h3>
            <button id="btn-close-settings" class="btn-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="setting-group">
              <label>GRAPHICS QUALITY TIER</label>
              <div class="tier-buttons">
                <button class="btn-tier" data-tier="LOW">LOW</button>
                <button class="btn-tier" data-tier="MEDIUM">MEDIUM</button>
                <button class="btn-tier active" data-tier="HIGH">HIGH</button>
              </div>
            </div>

            <div class="setting-group">
              <label>MASTER AUDIO VOLUME</label>
              <input type="range" id="slider-vol-master" min="0" max="100" value="80" />
            </div>

            <div class="setting-group">
              <label>ACCESSIBILITY</label>
              <label class="checkbox-label">
                <input type="checkbox" id="chk-reduced-motion" />
                <span>Reduced Motion (Disable Screen Shake)</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(hudWrapper);

    // Cache elements
    this.menuEl = document.getElementById('hud-main-menu')!;
    this.launchHudEl = document.getElementById('hud-launch')!;
    this.ascentHudEl = document.getElementById('hud-ascent')!;
    this.dockingHudEl = document.getElementById('hud-docking')!;
    this.issHudEl = document.getElementById('hud-iss')!;
    this.captionEl = document.getElementById('hud-caption')!;
    this.settingsModalEl = document.getElementById('hud-settings-modal')!;
    this.missionCompleteEl = document.getElementById('hud-mission-complete')!;

    this.bindEvents();
  }

  private bindEvents(): void {
    document.getElementById('btn-start-mission')?.addEventListener('click', () => {
      this.onStartMission?.();
    });

    document.getElementById('btn-initiate-launch')?.addEventListener('click', () => {
      this.onInitiateLaunch?.();
    });

    document.getElementById('btn-launch-skip')?.addEventListener('click', () => {
      this.onSkipCutscene?.();
    });

    document.getElementById('btn-ascent-camera')?.addEventListener('click', () => {
      this.onCycleCamera?.();
    });

    document.getElementById('btn-ascent-skip')?.addEventListener('click', () => {
      this.onSkipCutscene?.();
    });

    document.getElementById('btn-docking-skip')?.addEventListener('click', () => {
      this.onSkipCutscene?.();
    });

    document.getElementById('btn-open-settings')?.addEventListener('click', () => {
      this.settingsModalEl.classList.remove('hidden');
    });

    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      this.settingsModalEl.classList.add('hidden');
    });

    document.getElementById('btn-flashlight-toggle')?.addEventListener('click', () => {
      this.onToggleFlashlight?.();
    });

    document.getElementById('btn-replay-mission')?.addEventListener('click', () => {
      this.onStartMission?.();
    });

    // Quality tier buttons
    const tierBtns = document.querySelectorAll('.btn-tier');
    tierBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        tierBtns.forEach((b) => b.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const tier = target.getAttribute('data-tier') as QualityTier;
        this.onQualityChange?.(tier);
        const lbl = document.getElementById('lbl-current-tier');
        if (lbl) lbl.textContent = tier;
      });
    });

    // Slider master volume
    document.getElementById('slider-vol-master')?.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10) / 100;
      this.onVolumeChange?.('master', val);
    });

    // Reduced motion checkbox
    document.getElementById('chk-reduced-motion')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this.onReducedMotionChange?.(checked);
    });
  }

  setState(state: GameState): void {
    this.menuEl.classList.add('hidden');
    this.launchHudEl.classList.add('hidden');
    this.ascentHudEl.classList.add('hidden');
    this.dockingHudEl.classList.add('hidden');
    this.issHudEl.classList.add('hidden');
    this.missionCompleteEl.classList.add('hidden');

    switch (state) {
      case 'IDLE_MENU':
        this.menuEl.classList.remove('hidden');
        break;
      case 'LAUNCH_PAD':
        this.launchHudEl.classList.remove('hidden');
        break;
      case 'ASCENT':
        this.ascentHudEl.classList.remove('hidden');
        break;
      case 'ORBIT':
      case 'DOCKING':
        this.dockingHudEl.classList.remove('hidden');
        break;
      case 'ISS_EXPLORATION':
        this.issHudEl.classList.remove('hidden');
        break;
      case 'MISSION_COMPLETE':
        this.missionCompleteEl.classList.remove('hidden');
        break;
    }
  }

  updateCountdown(val: number): void {
    const el = document.getElementById('lbl-countdown-val');
    if (el) {
      el.textContent = val === 0 ? 'LIFTOFF 🚀' : `T-${val}`;
    }
  }

  updateAscentTelemetry(s: AscentSample): void {
    const altEl = document.getElementById('tel-alt');
    const velEl = document.getElementById('tel-vel');
    const pitchEl = document.getElementById('tel-pitch');
    const stageEl = document.getElementById('tel-stage');

    if (altEl) altEl.textContent = `${Math.round(s.altitude).toLocaleString()} m`;
    if (velEl) velEl.textContent = `${Math.round(s.velocity).toLocaleString()} m/s`;
    if (pitchEl) pitchEl.textContent = `${s.pitch.toFixed(1)}°`;
    if (stageEl) stageEl.textContent = `STAGE ${s.stage}`;
  }

  updateDockingHUD(state: DockingState): void {
    const distEl = document.getElementById('dock-dist');
    const speedEl = document.getElementById('dock-speed');
    const anglesEl = document.getElementById('dock-angles');
    const scoreEl = document.getElementById('dock-align-pct');
    const badgeEl = document.getElementById('dock-status-badge');
    const dotEl = document.getElementById('dock-target-dot');

    if (distEl) distEl.textContent = `${state.distance.toFixed(1)} m`;
    if (speedEl) speedEl.textContent = `${state.relativeVelocity.toFixed(2)} m/s`;
    if (anglesEl) anglesEl.textContent = `${state.yawError >= 0 ? '+' : ''}${state.yawError.toFixed(1)}° / ${state.pitchError >= 0 ? '+' : ''}${state.pitchError.toFixed(1)}°`;
    if (scoreEl) scoreEl.textContent = `ALIGN: ${state.alignmentScore}%`;

    const status = getDockingStatus(state);
    if (badgeEl) {
      badgeEl.className = `dock-badge ${status.toLowerCase()}`;
      badgeEl.textContent = status;
    }

    if (dotEl) {
      // Offset target crosshair dot based on transverse and pitch/yaw errors
      const offsetX = Math.max(-50, Math.min(50, state.yawError * 4));
      const offsetY = Math.max(-50, Math.min(50, -state.pitchError * 4));
      dotEl.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }
  }

  updateISSPrompt(info: InteractionPromptInfo): void {
    const box = document.getElementById('interaction-prompt-box');
    const text = document.getElementById('interaction-prompt-text');
    if (!box || !text) return;

    if (info.visible) {
      text.textContent = info.prompt;
      box.classList.remove('hidden');
    } else {
      box.classList.add('hidden');
    }
  }

  showCaption(text: string): void {
    const capText = document.getElementById('caption-text');
    if (capText && this.captionEl) {
      capText.textContent = text;
      this.captionEl.classList.remove('hidden');

      setTimeout(() => {
        if (capText.textContent === text) {
          this.captionEl.classList.add('hidden');
        }
      }, 4500);
    }
  }
}
