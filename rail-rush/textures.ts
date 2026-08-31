/* =============================================================================
   RAIL RUSH — procedural canvas textures. Zero asset files.
   All painters moved verbatim from game.ts; createTextures() builds the set
   once at boot (renderer anisotropy passed in).
   ========================================================================== */
import * as THREE from 'three';
import { CONFIG } from './config';

const randInt = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(arr: T[]): T => arr[randInt(arr.length)];

/* Draw `draw` nine times offset by one canvas — every layer painted through
   this joins seamlessly when tiled. */
function wrapped(g: CanvasRenderingContext2D, w: number, h: number, draw: () => void) {
  for (const ox of [0, -w]) {
    for (const oy of [0, -h]) {
      g.save();
      g.translate(ox, oy);
      draw();
      g.restore();
    }
  }
}

function canvasTexture(
  aniso: number,
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d') as CanvasRenderingContext2D, w, h);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = Math.min(8, aniso);
  return tx;
}

/* Multi-scale procedural terrain: large soft tone blobs + mid mottling +
   fine grain (kept for the water-tower rust). */
function terrainTexture(aniso: number, base: string, spots: string[], density: number) {
  return canvasTexture(aniso, 512, 512, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    // Macro: big soft radial tone blobs give regions their own character.
    for (let i = 0; i < 60; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 40 + Math.random() * 90;
      const col = spots[randInt(spots.length)];
      const a = 0.18 + Math.random() * 0.24;
      const gr = g.createRadialGradient(x, y, r * 0.15, x, y, r);
      gr.addColorStop(0, col);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      wrapped(g, w, h, () => {
        g.globalAlpha = a;
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      });
    }
    // Mid: mottled ellipses break up flatness organically.
    for (let i = 0; i < 250; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const rw = 4 + Math.random() * 18;
      const rh = 3 + Math.random() * 12;
      const rot = Math.random() * Math.PI;
      const col = spots[randInt(spots.length)];
      const a = 0.08 + Math.random() * 0.12;
      wrapped(g, w, h, () => {
        g.globalAlpha = a;
        g.fillStyle = col;
        g.beginPath();
        g.ellipse(x, y, rw, rh, rot, 0, Math.PI * 2);
        g.fill();
      });
    }
    // Fine: grain on top for close-up detail.
    for (let i = 0; i < density; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const rw = 1 + Math.random() * 2;
      const rh = 1 + Math.random() * 2;
      const col = spots[randInt(spots.length)];
      const a = 0.15 + Math.random() * 0.17;
      wrapped(g, w, h, () => {
        g.globalAlpha = a;
        g.fillStyle = col;
        g.fillRect(x, y, rw, rh);
      });
    }
    g.globalAlpha = 1;
  });
}

/* Art-directed dusk ground: angular tone zones, wind ripples, gravel
   clusters with sun-side highlights, and branching cracks. */
function artGroundTexture(aniso: number) {
  const spots = ['#6b5882', '#322844', '#4e3f63', '#66506b'];
  return canvasTexture(aniso, 512, 512, (g, w, h) => {
    g.fillStyle = '#54406b';
    g.fillRect(0, 0, w, h);

    // Macro zones: irregular soft-edged polygons — terrain regions, not bubbles.
    for (let i = 0; i < 15; i += 1) {
      const cx = Math.random() * w;
      const cy = Math.random() * h;
      const n = 7 + randInt(4);
      const rBase = 60 + Math.random() * 110;
      const pts: number[][] = [];
      for (let k = 0; k < n; k += 1) {
        const ang = (k / n) * Math.PI * 2;
        const rr = rBase * (0.55 + Math.random() * 0.7);
        pts.push([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]);
      }
      const col = pick(spots);
      const a = 0.14 + Math.random() * 0.16;
      wrapped(g, w, h, () => {
        g.globalAlpha = a;
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < n; k += 1) g.lineTo(pts[k][0], pts[k][1]);
        g.closePath();
        g.fill();
      });
    }

    // Wind ripples: long wavy strokes drifting at a slight diagonal.
    g.filter = 'blur(1.5px)';
    for (let i = 0; i < 38; i += 1) {
      const col = Math.random() < 0.5 ? '#6b5882' : '#322844';
      const a = 0.08 + Math.random() * 0.12;
      const lw = 2 + Math.random() * 4;
      const y0 = Math.random() * h;
      const drift = (Math.random() - 0.3) * 90;
      const amp = 4 + Math.random() * 10;
      const span = w + 20;
      const segs = 8;
      wrapped(g, w, h, () => {
        g.globalAlpha = a;
        g.strokeStyle = col;
        g.lineWidth = lw;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-10, y0);
        let py = y0;
        for (let s = 1; s <= segs; s += 1) {
          const x = -10 + (span / segs) * s;
          const yy = y0 + (drift * s) / segs + (s % 2 ? amp : -amp) * 0.9;
          g.quadraticCurveTo(x - span / segs / 2, py + (s % 2 ? -amp : amp), x, yy);
          py = yy;
        }
        g.stroke();
      });
    }
    g.filter = 'none';

    // Gravel clusters: pebbles with a sun-side highlight.
    for (let c = 0; c < 60; c += 1) {
      const cx = Math.random() * w;
      const cy = Math.random() * h;
      const count = 4 + randInt(6);
      for (let k = 0; k < count; k += 1) {
        const x = cx + (Math.random() - 0.5) * 46;
        const y = cy + (Math.random() - 0.5) * 30;
        const r = 1 + Math.random() * 2.2;
        const base = pick(spots);
        wrapped(g, w, h, () => {
          g.globalAlpha = 0.5;
          g.fillStyle = base;
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
          g.globalAlpha = 0.45;
          g.fillStyle = '#8a76a0';
          g.beginPath();
          g.arc(x - r * 0.35, y - r * 0.35, r * 0.45, 0, Math.PI * 2);
          g.fill();
        });
      }
    }

    // Cracks: branching random walks, cracked-earth hint.
    for (let i = 0; i < 10; i += 1) {
      let x = Math.random() * w;
      let y = Math.random() * h;
      let ang = Math.random() * Math.PI * 2;
      wrapped(g, w, h, () => {
        g.globalAlpha = 0.25;
        g.strokeStyle = '#2e2440';
        g.lineWidth = 1.4;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x, y);
        for (let s = 0; s < 9; s += 1) {
          ang += (Math.random() - 0.5) * 0.9;
          x += Math.cos(ang) * (6 + Math.random() * 12);
          y += Math.sin(ang) * (6 + Math.random() * 12);
          g.lineTo(x, y);
          if (Math.random() < 0.25) {
            g.moveTo(x, y);
            const fa = ang + (Math.random() - 0.5) * 1.6;
            g.lineTo(x + Math.cos(fa) * 10, y + Math.sin(fa) * 10);
            g.moveTo(x, y);
          }
        }
        g.stroke();
      });
    }

    // Light grain so close-ups stay lively under the structure.
    for (let i = 0; i < 1200; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      wrapped(g, w, h, () => {
        g.globalAlpha = 0.12 + Math.random() * 0.14;
        g.fillStyle = pick(spots);
        g.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
      });
    }
    g.globalAlpha = 1;
  });
}

/* Art-directed ballast: worn longitudinal bands plus real rounded stones —
   each pebble gets a lit edge toward the sun and a shade edge away from it,
   which is what makes gravel read as gravel instead of noise. */
function artBallastTexture(aniso: number) {
  const stoneCols = ['#6a625c', '#463f3d', '#5d5854', '#6e6659', '#524b47'];
  return canvasTexture(aniso, 512, 512, (g, w, h) => {
    g.fillStyle = '#55504e';
    g.fillRect(0, 0, w, h);

    // Longitudinal wear bands along the travel axis.
    for (let i = 0; i < 6; i += 1) {
      const bx = Math.random() * w;
      const bw = 30 + Math.random() * 70;
      const col = Math.random() < 0.5 ? '#494542' : '#5f5955';
      const a = 0.12 + Math.random() * 0.08;
      wrapped(g, w, h, () => {
        g.globalAlpha = a;
        g.fillStyle = col;
        g.fillRect(bx, 0, bw, h);
      });
    }

    const pebble = (x: number, y: number, r: number, rot: number) => {
      // Interior stones skip the wrap copies — keeps boot cost low.
      if (x > 8 && x < w - 8 && y > 8 && y < h - 8) {
        drawPebble(g, x, y, r, rot, stoneCols);
      } else {
        wrapped(g, w, h, () => drawPebble(g, x, y, r, rot, stoneCols));
      }
    };
    for (let i = 0; i < 900; i += 1) {
      pebble(Math.random() * w, Math.random() * h, 1 + Math.random() * 1.8, Math.random() * Math.PI);
    }
    for (let i = 0; i < 30; i += 1) {
      pebble(Math.random() * w, Math.random() * h, 3 + Math.random() * 1.6, Math.random() * Math.PI);
    }

    // Sparse grain between stones.
    for (let i = 0; i < 600; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      wrapped(g, w, h, () => {
        g.globalAlpha = 0.1 + Math.random() * 0.12;
        g.fillStyle = pick(stoneCols);
        g.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
      });
    }
    g.globalAlpha = 1;
  });
}

function drawPebble(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, stoneCols: string[]) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.globalAlpha = 0.9;
  g.fillStyle = stoneCols[randInt(stoneCols.length)];
  g.beginPath();
  g.ellipse(0, 0, r, r * 0.72, 0, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 0.5;
  g.strokeStyle = '#7d756e'; // lit edge
  g.lineWidth = Math.max(0.8, r * 0.28);
  g.beginPath();
  g.arc(0, 0, r * 0.82, Math.PI * 0.9, Math.PI * 1.75);
  g.stroke();
  g.strokeStyle = '#332f2c'; // shade edge
  g.beginPath();
  g.arc(0, 0, r * 0.82, Math.PI * -0.05, Math.PI * 0.7);
  g.stroke();
  g.restore();
}

export type Textures = ReturnType<typeof createTextures>;

export function createTextures(maxAnisotropy: number) {
  const aniso = Math.min(8, maxAnisotropy);

  const groundTex = artGroundTexture(aniso);
  const ballastTex = artBallastTexture(aniso);
  const rustTex = terrainTexture(aniso, '#7a4a3a', ['#5e362c', '#8f5a46', '#4a2b24'], 1600);

  const hazardTexture = canvasTexture(aniso, 128, 128, (g, w, h) => {
    g.fillStyle = '#fff3dc';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff8a3d';
    for (let x = -h; x < w + h; x += 32) {
      g.beginPath();
      g.moveTo(x, 0); g.lineTo(x + 16, 0); g.lineTo(x + 16 - h, h); g.lineTo(x - h, h);
      g.closePath(); g.fill();
    }
  });
  const glowTexture = canvasTexture(aniso, 64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,226,170,1)');
    gr.addColorStop(0.4, 'rgba(255,190,110,0.45)');
    gr.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  const cloudShadowTexture = canvasTexture(aniso, 128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(22,13,36,0.55)');
    gr.addColorStop(0.6, 'rgba(22,13,36,0.24)');
    gr.addColorStop(1, 'rgba(22,13,36,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  const skyTexture = canvasTexture(aniso, 64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, CONFIG.sky.zenith);
    gr.addColorStop(0.42, CONFIG.sky.band1);
    gr.addColorStop(0.68, CONFIG.sky.band2);
    gr.addColorStop(0.84, CONFIG.sky.horizon);
    gr.addColorStop(1, CONFIG.sky.groundGlow);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });

  // Tiling setup (values in CONFIG.textureRepeats).
  groundTex.repeat.set(...CONFIG.textureRepeats.ground);
  ballastTex.repeat.set(...CONFIG.textureRepeats.ballast);
  rustTex.repeat.set(...CONFIG.textureRepeats.rust);
  [groundTex, ballastTex, rustTex].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });

  return {
    ground: groundTex,
    ballast: ballastTex,
    rust: rustTex,
    hazard: hazardTexture,
    glow: glowTexture,
    cloudShadow: cloudShadowTexture,
    sky: skyTexture,
  };
}
