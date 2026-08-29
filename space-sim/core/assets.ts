// space-sim/core/assets.ts
import { DynamicTexture, PBRMaterial, type Scene } from "@babylonjs/core";
import { fbm2 } from "./noise";

type Ctx = CanvasRenderingContext2D;

function canvasTex(scene: Scene, name: string, w: number, h: number, draw: (ctx: Ctx) => void): DynamicTexture {
  const tex = new DynamicTexture(name, { width: w, height: h }, scene, true);
  const ctx = tex.getContext() as unknown as Ctx;
  draw(ctx);
  tex.update();
  return tex;
}

function bumpy(ctx: Ctx, w: number, h: number, scale: number, octaves: number, strength: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = fbm2((x / w) * scale, (y / h) * scale, octaves);
      const k = (y * w + x) * 4;
      const m = 1 + n * strength;
      d[k] = Math.min(255, Math.max(0, d[k] * m));
      d[k + 1] = Math.min(255, Math.max(0, d[k + 1] * m));
      d[k + 2] = Math.min(255, Math.max(0, d[k + 2] * m));
    }
  }
  ctx.putImageData(img, 0, 0);
}

function streaks(ctx: Ctx, w: number, h: number, count: number, alpha: number): void {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y0 = Math.random() * h * 0.3;
    const len = h * (0.2 + Math.random() * 0.6);
    const g = ctx.createLinearGradient(x, y0, x, y0 + len);
    g.addColorStop(0, `rgba(60,45,35,${alpha * Math.random()})`);
    g.addColorStop(1, "rgba(60,45,35,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y0, 1 + Math.random() * 2.5, len);
  }
}

export interface Assets {
  concrete(): PBRMaterial; asphalt(): PBRMaterial; grass(): PBRMaterial; marsh(): PBRMaterial;
  steelStructure(): PBRMaterial; paintedWhite(): PBRMaterial; foamOrange(): PBRMaterial;
  srbWhite(): PBRMaterial; foilGold(): PBRMaterial; solarCell(): PBRMaterial; radiator(): PBRMaterial;
  silverHull(): PBRMaterial; blackTile(): PBRMaterial; concretePad(): PBRMaterial;
  interiorWall(): PBRMaterial; handrail(): PBRMaterial; fabricBag(): PBRMaterial; laptop(): PBRMaterial;
  labelCanvas(text: string, w?: number, h?: number): DynamicTexture;
}

export function createAssets(scene: Scene): Assets {
  const cache = new Map<string, PBRMaterial>();
  const memo = (key: string, make: () => PBRMaterial): PBRMaterial => {
    let m = cache.get(key);
    if (!m) { m = make(); cache.set(key, m); }
    return m;
  };
  const tex = (name: string, w: number, h: number, draw: (c: Ctx) => void): DynamicTexture =>
    canvasTex(scene, name, w, h, draw);
  const pbr = (name: string): PBRMaterial => {
    const m = new PBRMaterial(name, scene);
    m.metallic = 0; m.roughness = 0.9;
    return m;
  };

  const concrete = (): PBRMaterial => memo("concrete", () => {
    const m = pbr("concrete");
    m.albedoTexture = tex("concrete_alb", 512, 512, (c) => {
      c.fillStyle = "#8f8d86"; c.fillRect(0, 0, 512, 512);
      bumpy(c, 512, 512, 24, 5, 0.25);
    });
    return m;
  });

  const concretePad = (): PBRMaterial => memo("concretePad", () => {
    const m = pbr("concretePad");
    m.albedoTexture = tex("pad_alb", 1024, 1024, (c) => {
      c.fillStyle = "#77746c"; c.fillRect(0, 0, 1024, 1024);
      bumpy(c, 1024, 1024, 14, 5, 0.3);
      c.strokeStyle = "rgba(20,20,20,0.55)"; c.lineWidth = 3;
      for (let i = 0; i <= 8; i++) {
        c.beginPath(); c.moveTo((i * 1024) / 8, 0); c.lineTo((i * 1024) / 8, 1024); c.stroke();
        c.beginPath(); c.moveTo(0, (i * 1024) / 8); c.lineTo(1024, (i * 1024) / 8); c.stroke();
      }
      const g = c.createRadialGradient(512, 512, 60, 512, 512, 340);
      g.addColorStop(0, "rgba(25,18,14,0.9)"); g.addColorStop(1, "rgba(25,18,14,0)");
      c.fillStyle = g; c.fillRect(0, 0, 1024, 1024);
    });
    return m;
  });

  const asphalt = (): PBRMaterial => memo("asphalt", () => {
    const m = pbr("asphalt");
    m.albedoTexture = tex("asphalt_alb", 512, 512, (c) => {
      c.fillStyle = "#3c3d3f"; c.fillRect(0, 0, 512, 512);
      bumpy(c, 512, 512, 48, 4, 0.35);
    });
    return m;
  });

  const grass = (): PBRMaterial => memo("grass", () => {
    const m = pbr("grass");
    m.albedoTexture = tex("grass_alb", 512, 512, (c) => {
      c.fillStyle = "#5a6b3a"; c.fillRect(0, 0, 512, 512);
      bumpy(c, 512, 512, 30, 5, 0.5);
    });
    return m;
  });

  const marsh = (): PBRMaterial => memo("marsh", () => {
    const m = pbr("marsh");
    m.albedoTexture = tex("marsh_alb", 512, 512, (c) => {
      c.fillStyle = "#4c5d44"; c.fillRect(0, 0, 512, 512);
      bumpy(c, 512, 512, 12, 5, 0.45);
      c.fillStyle = "rgba(50,80,90,0.35)";
      for (let i = 0; i < 40; i++) {
        c.beginPath();
        c.ellipse(Math.random() * 512, Math.random() * 512, 8 + Math.random() * 30, 6 + Math.random() * 18, Math.random() * 3, 0, Math.PI * 2);
        c.fill();
      }
    });
    return m;
  });

  const steelStructure = (): PBRMaterial => memo("steelStructure", () => {
    const m = pbr("steelStructure");
    m.albedoTexture = tex("steel_alb", 256, 256, (c) => {
      c.fillStyle = "#7a7d80"; c.fillRect(0, 0, 256, 256);
      streaks(c, 256, 256, 30, 0.25);
      bumpy(c, 256, 256, 40, 3, 0.15);
    });
    m.metallic = 0.85; m.roughness = 0.55;
    return m;
  });

  const paintedWhite = (): PBRMaterial => memo("paintedWhite", () => {
    const m = pbr("paintedWhite");
    m.albedoTexture = tex("pw_alb", 256, 256, (c) => {
      c.fillStyle = "#d8d9d4"; c.fillRect(0, 0, 256, 256);
      bumpy(c, 256, 256, 20, 3, 0.08);
      streaks(c, 256, 256, 12, 0.15);
    });
    m.metallic = 0.1; m.roughness = 0.65;
    return m;
  });

  const foamOrange = (): PBRMaterial => memo("foamOrange", () => {
    const m = pbr("foamOrange");
    m.albedoTexture = tex("foam_alb", 512, 1024, (c) => {
      c.fillStyle = "#c2571f"; c.fillRect(0, 0, 512, 1024);
      c.strokeStyle = "rgba(120,50,18,0.6)"; c.lineWidth = 2;
      for (let x = 0; x <= 512; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 1024); c.stroke(); }
      bumpy(c, 512, 1024, 18, 4, 0.12);
      streaks(c, 512, 1024, 60, 0.35);
      const g = c.createLinearGradient(0, 1024, 0, 700);
      g.addColorStop(0, "rgba(40,25,15,0.5)"); g.addColorStop(1, "rgba(40,25,15,0)");
      c.fillStyle = g; c.fillRect(0, 700, 512, 324);
    });
    m.metallic = 0.02; m.roughness = 0.78;
    return m;
  });

  const srbWhite = (): PBRMaterial => memo("srbWhite", () => {
    const m = pbr("srbWhite");
    m.albedoTexture = tex("srb_alb", 512, 1024, (c) => {
      c.fillStyle = "#dcdcda"; c.fillRect(0, 0, 512, 1024);
      c.strokeStyle = "rgba(70,70,70,0.8)"; c.lineWidth = 4;
      for (const y of [170, 340, 512, 680, 850]) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); }
      streaks(c, 512, 1024, 40, 0.25);
      bumpy(c, 512, 1024, 16, 3, 0.07);
    });
    m.metallic = 0.08; m.roughness = 0.6;
    return m;
  });

  const foilGold = (): PBRMaterial => memo("foilGold", () => {
    const m = pbr("foilGold");
    m.albedoTexture = tex("foil_alb", 256, 256, (c) => {
      c.fillStyle = "#b98a2e"; c.fillRect(0, 0, 256, 256);
      bumpy(c, 256, 256, 10, 3, 0.55);
    });
    m.metallic = 0.9; m.roughness = 0.35;
    return m;
  });

  const solarCell = (): PBRMaterial => memo("solarCell", () => {
    const m = pbr("solarCell");
    m.albedoTexture = tex("solar_alb", 512, 256, (c) => {
      c.fillStyle = "#1a2f52"; c.fillRect(0, 0, 512, 256);
      c.strokeStyle = "#c9a13b"; c.lineWidth = 2;
      for (let x = 0; x <= 512; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 256); c.stroke(); }
      for (let y = 0; y <= 256; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); }
      c.fillStyle = "rgba(160,190,230,0.18)";
      for (let x = 0; x < 512; x += 32) for (let y = 0; y < 256; y += 32) if (Math.random() < 0.2) c.fillRect(x + 4, y + 4, 24, 24);
    });
    m.metallic = 0.4; m.roughness = 0.25;
    return m;
  });

  const radiator = (): PBRMaterial => memo("radiator", () => {
    const m = pbr("radiator");
    m.albedoTexture = tex("rad_alb", 256, 256, (c) => {
      c.fillStyle = "#e8e9ea"; c.fillRect(0, 0, 256, 256);
      c.strokeStyle = "rgba(120,125,130,0.8)"; c.lineWidth = 2;
      for (let y = 12; y < 256; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(256, y); c.stroke(); }
    });
    m.metallic = 0.3; m.roughness = 0.35;
    return m;
  });

  const silverHull = (): PBRMaterial => memo("silverHull", () => {
    const m = pbr("silverHull");
    m.metallic = 0.95; m.roughness = 0.3;
    return m;
  });

  const blackTile = (): PBRMaterial => memo("blackTile", () => {
    const m = pbr("blackTile");
    m.albedoTexture = tex("tile_alb", 256, 256, (c) => {
      c.fillStyle = "#14161a"; c.fillRect(0, 0, 256, 256);
      c.strokeStyle = "rgba(60,60,60,0.6)"; c.lineWidth = 1.5;
      for (let i = 0; i < 256; i += 24) {
        c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.stroke();
        c.beginPath(); c.moveTo(0, i); c.lineTo(256, i); c.stroke();
      }
    });
    return m;
  });

  const interiorWall = (): PBRMaterial => memo("interiorWall", () => {
    const m = pbr("interiorWall");
    m.albedoTexture = tex("wall_alb", 512, 512, (c) => {
      c.fillStyle = "#c8cdd0"; c.fillRect(0, 0, 512, 512);
      c.strokeStyle = "rgba(90,100,105,0.9)"; c.lineWidth = 3;
      for (let y = 0; y <= 512; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); }
      for (let i = 0; i < 120; i++) {
        c.fillStyle = `rgba(70,75,80,${Math.random() * 0.18})`;
        c.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 40, 1 + Math.random() * 3);
      }
      bumpy(c, 512, 512, 16, 3, 0.05);
    });
    m.metallic = 0.15; m.roughness = 0.7;
    return m;
  });

  const handrail = (): PBRMaterial => memo("handrail", () => {
    const m = pbr("handrail");
    m.albedoTexture = tex("rail_alb", 64, 64, (c) => {
      c.fillStyle = "#b9bec2"; c.fillRect(0, 0, 64, 64);
      bumpy(c, 64, 64, 8, 2, 0.12);
    });
    m.metallic = 0.8; m.roughness = 0.45;
    return m;
  });

  const fabricBag = (): PBRMaterial => memo("fabricBag", () => {
    const m = pbr("fabricBag");
    m.albedoTexture = tex("bag_alb", 256, 256, (c) => {
      c.fillStyle = "#7a7357"; c.fillRect(0, 0, 256, 256);
      bumpy(c, 256, 256, 40, 4, 0.4);
      c.strokeStyle = "rgba(40,38,25,0.7)"; c.lineWidth = 3;
      c.strokeRect(12, 12, 232, 232);
    });
    return m;
  });

  const laptop = (): PBRMaterial => memo("laptop", () => {
    const m = pbr("laptop");
    m.albedoTexture = tex("laptop_alb", 256, 256, (c) => {
      c.fillStyle = "#9aa0a4"; c.fillRect(0, 0, 256, 256);
      c.fillStyle = "#20262b"; c.fillRect(24, 24, 208, 130);
      c.fillStyle = "#31556e"; c.fillRect(30, 30, 196, 118);
      c.fillStyle = "#b9bec2"; c.fillRect(24, 170, 208, 70);
      for (let y = 176; y < 236; y += 10) for (let x = 30; x < 226; x += 12) c.fillRect(x, y, 8, 6);
    });
    m.emissiveTexture = tex("laptop_emi", 256, 256, (c) => {
      c.fillStyle = "#000"; c.fillRect(0, 0, 256, 256);
      c.fillStyle = "#5f9fd8"; c.fillRect(30, 30, 196, 118);
      c.fillStyle = "#cfe6f7";
      c.fillRect(40, 40, 90, 8); c.fillRect(40, 56, 140, 6); c.fillRect(40, 70, 110, 6);
    });
    m.emissiveIntensity = 0.7;
    m.metallic = 0.3; m.roughness = 0.5;
    return m;
  });

  const labelCanvas = (text: string, w = 256, h = 64): DynamicTexture =>
    tex(`label_${text}`, w, h, (c) => {
      c.fillStyle = "#d8dde0"; c.fillRect(0, 0, w, h);
      c.fillStyle = "#10161a";
      c.font = `bold ${Math.floor(h * 0.42)}px monospace`;
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(text, w / 2, h / 2);
      c.strokeStyle = "#10161a"; c.lineWidth = 3; c.strokeRect(2, 2, w - 4, h - 4);
    });

  return {
    concrete, asphalt, grass, marsh, steelStructure, paintedWhite, foamOrange, srbWhite,
    foilGold, solarCell, radiator, silverHull, blackTile, concretePad,
    interiorWall, handrail, fabricBag, laptop, labelCanvas,
  };
}
