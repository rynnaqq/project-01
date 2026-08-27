import {
  AdvancedDynamicTexture,
  Button,
  Control,
  Ellipse,
  Line,
  Rectangle,
  TextBlock,
} from '@babylonjs/gui';
import type { Scene } from '@babylonjs/core/scene';
import {
  DOCK_TOLERANCES,
  type DockingState,
} from '../gameplay/docking';

export class DockingHUD {
  readonly texture: AdvancedDynamicTexture;
  private readonly title: TextBlock;
  private readonly readout: TextBlock;
  private readonly status: TextBlock;
  private readonly message: TextBlock;
  private readonly countdown: TextBlock;
  private readonly caption: TextBlock;
  private readonly actionButton: Button;
  private readonly interactPrompt: TextBlock;
  private readonly infoPanel: Rectangle;
  private readonly infoTitle: TextBlock;
  private readonly infoDesc: TextBlock;

  // Visual Reticle Controls
  private readonly reticleContainer: Rectangle;
  private readonly reticleRing: Ellipse;
  private readonly reticleCrossH: Line;
  private readonly reticleCrossV: Line;
  private readonly targetDot: Ellipse;

  constructor(scene: Scene) {
    this.texture = AdvancedDynamicTexture.CreateFullscreenUI(
      'space-hud',
      true,
      scene,
    );

    // Top Right Header Title
    this.title = new TextBlock('dock-title');
    this.title.text = 'SPACE SIMULATOR';
    this.title.color = 'white';
    this.title.fontSize = 20;
    this.title.fontFamily = 'monospace';
    this.title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.title.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.title.paddingRight = '24px';
    this.title.paddingTop = '24px';
    this.texture.addControl(this.title);

    // Top Right Telemetry Readout
    this.readout = new TextBlock('dock-readout');
    this.readout.color = '#cbd5e1';
    this.readout.fontSize = 15;
    this.readout.fontFamily = 'monospace';
    this.readout.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.readout.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.readout.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.readout.paddingRight = '24px';
    this.readout.paddingTop = '60px';
    this.texture.addControl(this.readout);

    // Status Line
    this.status = new TextBlock('dock-status');
    this.status.color = '#ef4444';
    this.status.fontSize = 17;
    this.status.fontFamily = 'monospace';
    this.status.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.status.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.status.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.status.paddingRight = '24px';
    this.status.paddingTop = '200px';
    this.texture.addControl(this.status);

    // Visual Docking Crosshair Reticle Container
    this.reticleContainer = new Rectangle('reticle-container');
    this.reticleContainer.width = '240px';
    this.reticleContainer.height = '240px';
    this.reticleContainer.thickness = 0;
    this.reticleContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.reticleContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.reticleContainer.isVisible = false;
    this.texture.addControl(this.reticleContainer);

    this.reticleRing = new Ellipse('reticle-ring');
    this.reticleRing.width = '200px';
    this.reticleRing.height = '200px';
    this.reticleRing.color = '#0284c7';
    this.reticleRing.thickness = 2;
    this.reticleContainer.addControl(this.reticleRing);

    this.reticleCrossH = new Line('reticle-h');
    this.reticleCrossH.x1 = 0;
    this.reticleCrossH.y1 = 120;
    this.reticleCrossH.x2 = 240;
    this.reticleCrossH.y2 = 120;
    this.reticleCrossH.color = 'rgba(2, 132, 199, 0.5)';
    this.reticleCrossH.lineWidth = 1.5;
    this.reticleContainer.addControl(this.reticleCrossH);

    this.reticleCrossV = new Line('reticle-v');
    this.reticleCrossV.x1 = 120;
    this.reticleCrossV.y1 = 0;
    this.reticleCrossV.x2 = 120;
    this.reticleCrossV.y2 = 240;
    this.reticleCrossV.color = 'rgba(2, 132, 199, 0.5)';
    this.reticleCrossV.lineWidth = 1.5;
    this.reticleContainer.addControl(this.reticleCrossV);

    this.targetDot = new Ellipse('target-dot');
    this.targetDot.width = '14px';
    this.targetDot.height = '14px';
    this.targetDot.color = '#22c55e';
    this.targetDot.background = '#22c55e';
    this.targetDot.thickness = 1;
    this.reticleContainer.addControl(this.targetDot);

    // Center Large Countdown
    this.countdown = new TextBlock('center-countdown');
    this.countdown.color = '#38bdf8';
    this.countdown.fontSize = 72;
    this.countdown.fontFamily = 'monospace';
    this.countdown.resizeToFit = true;
    this.countdown.isVisible = false;
    this.texture.addControl(this.countdown);

    // Center Message Display
    this.message = new TextBlock('center-message');
    this.message.color = 'white';
    this.message.fontSize = 22;
    this.message.fontFamily = 'monospace';
    this.message.textWrapping = true;
    this.message.resizeToFit = true;
    this.message.isVisible = false;
    this.texture.addControl(this.message);

    // Bottom Action Button
    this.actionButton = Button.CreateSimpleButton('action-button', '');
    this.actionButton.width = '280px';
    this.actionButton.height = '52px';
    this.actionButton.cornerRadius = 8;
    this.actionButton.color = 'white';
    this.actionButton.background = '#1e293b';
    this.actionButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.actionButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.actionButton.paddingBottom = '50px';
    this.actionButton.isVisible = false;
    this.texture.addControl(this.actionButton);

    // ISS Interaction Prompt
    this.interactPrompt = new TextBlock('interact-prompt');
    this.interactPrompt.color = '#38bdf8';
    this.interactPrompt.fontSize = 18;
    this.interactPrompt.fontFamily = 'monospace';
    this.interactPrompt.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.interactPrompt.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.interactPrompt.paddingTop = '80px';
    this.interactPrompt.isVisible = false;
    this.texture.addControl(this.interactPrompt);

    // Subtitle / Radio Caption at Bottom
    this.caption = new TextBlock('radio-caption');
    this.caption.color = '#fef08a';
    this.caption.fontSize = 16;
    this.caption.fontFamily = 'sans-serif';
    this.caption.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.caption.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.caption.paddingBottom = '110px';
    this.caption.isVisible = false;
    this.texture.addControl(this.caption);

    // Info Panel Popup (For terminal data inspection)
    this.infoPanel = new Rectangle('info-panel');
    this.infoPanel.width = '460px';
    this.infoPanel.height = '200px';
    this.infoPanel.cornerRadius = 10;
    this.infoPanel.color = '#38bdf8';
    this.infoPanel.thickness = 2;
    this.infoPanel.background = 'rgba(15, 23, 42, 0.92)';
    this.infoPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.infoPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.infoPanel.isVisible = false;
    this.texture.addControl(this.infoPanel);

    this.infoTitle = new TextBlock('info-title');
    this.infoTitle.color = '#38bdf8';
    this.infoTitle.fontSize = 15;
    this.infoTitle.fontFamily = 'monospace';
    this.infoTitle.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.infoTitle.paddingTop = '14px';
    this.infoTitle.paddingLeft = '18px';
    this.infoTitle.paddingRight = '18px';
    this.infoTitle.textWrapping = true;
    this.infoPanel.addControl(this.infoTitle);

    this.infoDesc = new TextBlock('info-desc');
    this.infoDesc.color = '#e2e8f0';
    this.infoDesc.fontSize = 14;
    this.infoDesc.fontFamily = 'monospace';
    this.infoDesc.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.infoDesc.paddingTop = '55px';
    this.infoDesc.paddingLeft = '18px';
    this.infoDesc.paddingRight = '18px';
    this.infoDesc.textWrapping = true;
    this.infoPanel.addControl(this.infoDesc);
  }

  setTitle(title: string): void {
    this.title.text = title;
  }

  setReadout(text: string): void {
    this.readout.text = text;
  }

  setStatus(text: string, color = '#cbd5e1'): void {
    this.status.text = text;
    this.status.color = color;
  }

  showCountdown(value: string | number): void {
    this.countdown.text = String(value);
    this.countdown.isVisible = true;
  }

  hideCountdown(): void {
    this.countdown.isVisible = false;
  }

  onAction(label: string, handler: () => void): void {
    if (this.actionButton.textBlock) {
      this.actionButton.textBlock.text = label;
    }
    this.actionButton.isVisible = true;
    this.actionButton.onPointerUpObservable.clear();
    this.actionButton.onPointerUpObservable.add(handler);
  }

  hideAction(): void {
    this.actionButton.isVisible = false;
  }

  showMessage(text: string): void {
    this.message.text = text;
    this.message.isVisible = true;
  }

  hideMessage(): void {
    this.message.isVisible = false;
  }

  showCaption(text: string): void {
    this.caption.text = text;
    this.caption.isVisible = true;
  }

  hideCaption(): void {
    this.caption.isVisible = false;
  }

  showInteractPrompt(prompt: string): void {
    this.interactPrompt.text = prompt;
    this.interactPrompt.isVisible = true;
  }

  hideInteractPrompt(): void {
    this.interactPrompt.isVisible = false;
  }

  showInfoPanel(title: string, desc: string): void {
    this.infoTitle.text = title;
    this.infoDesc.text = desc;
    this.infoPanel.isVisible = true;
  }

  hideInfoPanel(): void {
    this.infoPanel.isVisible = false;
  }

  setReticleVisible(visible: boolean): void {
    this.reticleContainer.isVisible = visible;
  }

  update(s: DockingState): void {
    this.setReticleVisible(true);
    this.title.text = 'ISS DOCKING INTERFACE';
    const deg = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}°`;
    this.readout.text =
      `DISTANCE     ${s.distance.toFixed(1)} m\n` +
      `REL SPEED    ${s.relativeVelocity.toFixed(2)} m/s\n` +
      `YAW          ${deg(s.yawError)}\n` +
      `PITCH        ${deg(s.pitchError)}\n` +
      `ROLL         ${deg(s.rollError)}\n` +
      `ALIGNMENT      ${Math.round(s.alignmentScore)}%`;

    const ready =
      s.distance < DOCK_TOLERANCES.distance &&
      s.relativeVelocity < DOCK_TOLERANCES.speed &&
      s.yawError < DOCK_TOLERANCES.yaw &&
      s.pitchError < DOCK_TOLERANCES.pitch &&
      s.rollError < DOCK_TOLERANCES.roll;

    this.status.text = ready ? 'DOCK READY — HOLD' : 'CORRECTING';
    const color = ready
      ? '#22c55e'
      : s.alignmentScore > 50
        ? '#eab308'
        : '#ef4444';
    this.status.color = color;
    this.reticleRing.color = color;

    // Offset reticle target dot according to yaw & pitch error
    const offsetX = Math.max(-80, Math.min(80, s.yawError * 15));
    const offsetY = Math.max(-80, Math.min(80, s.pitchError * 15));
    this.targetDot.left = `${offsetX}px`;
    this.targetDot.top = `${offsetY}px`;
    this.targetDot.color = color;
    this.targetDot.background = color;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
