import {
  AdvancedDynamicTexture,
  Button,
  Control,
  TextBlock,
} from '@babylonjs/gui';
import type { Scene } from '@babylonjs/core/scene';
import {
  DOCK_TOLERANCES,
  type DockingState,
} from '../gameplay/docking';

export class DockingHUD {
  private readonly texture: AdvancedDynamicTexture;
  private readonly readout: TextBlock;
  private readonly status: TextBlock;
  private readonly message: TextBlock;
  private readonly actionButton: Button;

  constructor(scene: Scene) {
    this.texture = AdvancedDynamicTexture.CreateFullscreenUI(
      'space-hud',
      true,
      scene,
    );

    const title = new TextBlock('dock-title');
    title.text = 'ISS DOCKING';
    title.color = 'white';
    title.fontSize = 22;
    title.fontFamily = 'monospace';
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    title.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    title.paddingRight = '28px';
    title.paddingTop = '48px';
    this.texture.addControl(title);

    this.readout = new TextBlock('dock-readout');
    this.readout.color = '#cbd5e1';
    this.readout.fontSize = 17;
    this.readout.fontFamily = 'monospace';
    this.readout.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.readout.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.readout.paddingRight = '28px';
    this.readout.paddingTop = '92px';
    this.texture.addControl(this.readout);

    this.status = new TextBlock('dock-status');
    this.status.color = '#ef4444';
    this.status.fontSize = 19;
    this.status.fontFamily = 'monospace';
    this.status.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.status.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.status.paddingRight = '28px';
    this.status.paddingTop = '240px';
    this.texture.addControl(this.status);

    this.message = new TextBlock('center-message');
    this.message.color = 'white';
    this.message.fontSize = 26;
    this.message.fontFamily = 'monospace';
    this.message.textWrapping = true;
    this.message.resizeToFit = true;
    this.texture.addControl(this.message);
    this.message.isVisible = false;

    this.actionButton = Button.CreateSimpleButton(
      'action-button',
      '',
    );
    this.actionButton.width = '260px';
    this.actionButton.height = '56px';
    this.actionButton.cornerRadius = 8;
    this.actionButton.color = 'white';
    this.actionButton.background = '#1e293b';
    this.actionButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.actionButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.actionButton.paddingBottom = '64px';
    this.actionButton.isVisible = false;
    this.texture.addControl(this.actionButton);
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

  update(s: DockingState): void {
    const deg = (v: number) =>
      `${v >= 0 ? '+' : ''}${v.toFixed(1)}°`;
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
    this.status.color = ready
      ? '#22c55e'
      : s.alignmentScore > 50
        ? '#eab308'
        : '#ef4444';
  }

  dispose(): void {
    this.texture.dispose();
  }
}
