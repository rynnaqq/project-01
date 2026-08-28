import { Engine } from '@babylonjs/core';

export interface EngineInitResult {
  engine: Engine;
  isWebGPU: boolean;
}

export async function createBestEngine(canvas: HTMLCanvasElement): Promise<EngineInitResult> {
  // WebGL2 Engine
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    disableWebGL2Support: false,
    powerPreference: 'high-performance',
  });

  const caps = engine.getCaps();
  if (!caps.maxTextureSize) {
    throw new Error('3D WebGL context creation failed or unsupported');
  }

  return { engine, isWebGPU: false };
}

export function setupContextLossRecovery(
  engine: Engine,
  onLost: () => void,
  onRestored: () => void
): () => void {
  const canvas = engine.getRenderingCanvas();
  if (!canvas) return () => {};

  const handleLost = (event: Event) => {
    event.preventDefault();
    console.warn('WebGL Context Lost');
    onLost();
  };

  const handleRestored = () => {
    console.log('WebGL Context Restored');
    onRestored();
  };

  canvas.addEventListener('webglcontextlost', handleLost);
  canvas.addEventListener('webglcontextrestored', handleRestored);

  return () => {
    canvas.removeEventListener('webglcontextlost', handleLost);
    canvas.removeEventListener('webglcontextrestored', handleRestored);
  };
}
