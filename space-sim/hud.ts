// space-sim/hud.ts
/**
 * PRESENTATION layer: Babylon GUI HUD (PRD §C.3/C.4). Reads MissionState;
 * never computes physics. Telemetry updates are throttled by the caller
 * (main.ts calls update ~10 Hz).
 */
import { Scene } from '@babylonjs/core';
import {
  AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock,
} from '@babylonjs/gui';
import type { MissionState } from './state';
import { alignmentPct, type ApproachState } from './docking';

export interface Hud {
  update(state: MissionState, approach: ApproachState, canDock: boolean): void;
  /** Projected ISS marker position in pixels; null hides it. */
  setMarker(screenX: number | null, screenY: number | null): void;
  setHint(text: string): void;
  dispose(): void;
}

const APPROACH_COLOR: Record<ApproachState, string> = {
  SAFE: '#7dd87d',
  CAUTION: '#ffd24d',
  CRITICAL: '#ff6b5e',
  DOCKING_READY: '#6be1ff',
};

function label(panel: StackPanel, name: string): TextBlock {
  const t = new TextBlock(name, '—');
  t.color = 'white';
  t.fontSize = 16;
  t.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  t.height = '22px';
  panel.addControl(t);
  return t;
}

export function createHud(scene: Scene): Hud {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI('hud', true, scene);

  // Top telemetry row.
  const top = new StackPanel('top');
  top.isVertical = false;
  top.top = '12px';
  ui.addControl(top);
  const alt = new TextBlock('alt', 'ALT 0 KM');
  const spd = new TextBlock('spd', 'SPD 0 M/S');
  const timer = new TextBlock('timer', 'T+ 00:00');
  for (const t of [alt, spd, timer]) {
    t.color = 'white';
    t.fontSize = 18;
    t.width = '220px';
    top.addControl(t);
  }

  // Bottom-left docking panel.
  const dockPanel = new Rectangle('dockPanel');
  dockPanel.width = '260px';
  dockPanel.height = '150px';
  dockPanel.background = 'rgba(0,0,0,0.45)';
  dockPanel.cornerRadius = 8;
  dockPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  dockPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  dockPanel.left = '12px';
  dockPanel.top = '-12px';
  ui.addControl(dockPanel);
  const dockStack = new StackPanel('dockStack');
  dockPanel.addControl(dockStack);
  const dist = label(dockStack, 'dist');
  const rel = label(dockStack, 'rel');
  const align = label(dockStack, 'align');
  const approach = label(dockStack, 'approach');
  const fuelBar = label(dockStack, 'fuel');
  const o2 = label(dockStack, 'o2');

  // Center hint line.
  const hint = new TextBlock('hint', '');
  hint.color = '#ffd24d';
  hint.fontSize = 18;
  hint.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  hint.top = '-170px';
  ui.addControl(hint);

  // ISS target marker.
  const marker = new TextBlock('marker', '◈ ISS');
  marker.color = '#6be1ff';
  marker.fontSize = 16;
  marker.isVisible = false;
  ui.addControl(marker);

  const fmtTime = (s: number): string => {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };
  const bar = (v: number): string => {
    const filled = Math.round((Math.max(0, Math.min(100, v)) / 100) * 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
  };

  return {
    update(state, approachState, canDockNow) {
      alt.text = `ALT ${state.altitudeKm.toFixed(0)} KM`;
      spd.text = `SPD ${state.speedMps.toFixed(1)} M/S`;
      timer.text = `T+ ${fmtTime(state.missionTimeS)}`;
      dist.text = `ISS DIST ${state.distanceToISSm.toFixed(0)} m`;
      rel.text = `REL SPEED ${state.relativeVelocityMps.toFixed(2)} m/s`;
      align.text = `ALIGNMENT ${alignmentPct(state.alignmentDeg)}%`;
      approach.text = canDockNow ? 'DOCK NOW [Enter]' : `APPROACH ${approachState.replace('_', ' ')}`;
      approach.color = APPROACH_COLOR[approachState];
      fuelBar.text = `FUEL ${bar(state.fuel)} ${state.fuel.toFixed(0)}`;
      o2.text = `O₂ ${bar(state.oxygen)}`;
    },
    setMarker(x, y) {
      if (x === null || y === null) { marker.isVisible = false; return; }
      marker.isVisible = true;
      marker.left = `${x}px`;
      marker.top = `${y}px`;
    },
    setHint(text) {
      hint.text = text;
    },
    dispose() {
      ui.dispose();
    },
  };
}
