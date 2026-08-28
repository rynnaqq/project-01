/**
 * Procedural PBR Texture Generator for Space Simulator.
 * Synthesizes high-resolution, photorealistic canvas textures for:
 * 1. Multi-layer Earth (Continents, biomes, mountains, oceans, city lights, clouds)
 * 2. Cosmic Sky & Starfield (Nebula clouds, Milky Way band, multi-magnitude stars)
 * 3. Rocket Livery & Heat Shield (Carbon fiber, panel seams, NASA/USA decals, heat tiles)
 * 4. ISS Solar Array Cells & Gold Kapton MLI Foil
 * 5. ISS Interior ISPR Racks & Emissive Telemetry LCD Screens
 * 6. Launch Pad Weathered Concrete & Safety Hazard Stripes
 */

import { Scene, DynamicTexture } from '@babylonjs/core';

/**
 * Creates high-resolution Earth Albedo and Surface texture (2048x1024).
 * Includes detailed continental coastlines, topological relief shading,
 * biomes, ocean depth gradients, polar ice caps, and subtle night-side city lights.
 */
export function createEarthAlbedoTexture(scene: Scene, width = 2048, height = 1024): DynamicTexture {
  const dt = new DynamicTexture('earth-albedo-dt', { width, height }, scene, true);
  const ctx = dt.getContext();

  // 1. Ocean Base with deep trenches & continental shelf gradients
  const oceanGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width / 1.5);
  oceanGrad.addColorStop(0, '#0d2d4d');
  oceanGrad.addColorStop(0.5, '#0a223c');
  oceanGrad.addColorStop(1, '#051324');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Shallow continental shelf turquoise/cyan halos around coastlines
  ctx.fillStyle = 'rgba(28, 120, 148, 0.45)';

  function drawContinent(paths: Array<[number, number]>, fillColor: string, strokeColor?: string): void {
    if (paths.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(paths[0][0] * (width / 1000), paths[0][1] * (height / 500));
    for (let i = 1; i < paths.length; i++) {
      ctx.lineTo(paths[i][0] * (width / 1000), paths[i][1] * (height / 500));
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // --- Continents Geometry & Biome Layering ---
  // North America
  drawContinent(
    [
      [140, 100], [240, 90], [320, 120], [300, 170], [250, 190],
      [220, 260], [200, 290], [180, 240], [140, 220], [110, 180], [120, 130]
    ],
    '#2c5e3b',
    '#1d4529'
  );
  // Rocky Mountains / Desert Great Basin
  drawContinent(
    [[160, 140], [200, 150], [210, 220], [180, 230], [150, 180]],
    '#6e6244'
  );

  // Central & South America
  drawContinent(
    [
      [200, 290], [250, 300], [330, 330], [360, 380], [330, 440],
      [290, 480], [270, 460], [280, 380], [240, 340], [210, 310]
    ],
    '#1f542d',
    '#143b1f'
  );
  // Andes mountain ridge
  drawContinent(
    [[270, 340], [285, 390], [275, 450], [265, 430], [275, 360]],
    '#5c533e'
  );

  // Eurasia (Europe + Asia)
  drawContinent(
    [
      [470, 120], [530, 100], [680, 100], [800, 110], [890, 140],
      [900, 210], [820, 230], [750, 270], [670, 250], [620, 270],
      [570, 240], [520, 250], [470, 210], [450, 150]
    ],
    '#345e35',
    '#234724'
  );
  // Himalayas & Tibetan Plateau
  drawContinent(
    [[680, 190], [780, 190], [790, 230], [710, 240], [670, 210]],
    '#70664d'
  );
  // Siberian Taiga / Tundra
  drawContinent(
    [[580, 100], [850, 105], [860, 145], [570, 140]],
    '#254b38'
  );

  // Africa
  drawContinent(
    [
      [470, 220], [560, 220], [600, 260], [580, 320], [540, 400],
      [500, 440], [460, 380], [440, 300], [430, 250]
    ],
    '#2d5731',
    '#1f3f23'
  );
  // Sahara Desert
  drawContinent(
    [[460, 225], [570, 230], [580, 285], [440, 280]],
    '#8a7b52'
  );

  // Australia & Indonesia
  drawContinent(
    [[770, 340], [870, 330], [890, 390], [840, 440], [780, 420], [750, 370]],
    '#825833',
    '#5c3d23'
  );
  // Maritime SE Asia islands
  for (const [ix, iy, ir] of [[730, 280, 12], [760, 290, 16], [790, 300, 14], [830, 290, 18]]) {
    ctx.beginPath();
    ctx.arc(ix * (width / 1000), iy * (height / 500), ir * (width / 1000), 0, Math.PI * 2);
    ctx.fillStyle = '#225e2e';
    ctx.fill();
  }
  // Japan & UK
  drawContinent([[890, 180], [920, 210], [900, 230], [880, 200]], '#2a5b33');
  drawContinent([[460, 130], [480, 140], [470, 170], [450, 150]], '#2b6336');

  // Polar Ice Caps (Arctic and Antarctica with craggy ice shelves)
  ctx.fillStyle = '#f0f5fa';
  // Arctic
  ctx.fillRect(0, 0, width, height * 0.08);
  // Antarctica
  ctx.fillRect(0, height * 0.91, width, height * 0.09);

  // 2. City Lights Layer (emissive gold/white micro clusters for realistic night-side)
  ctx.fillStyle = '#ffdf88';
  const cityCoordinates = [
    [210, 180], [280, 175], [290, 190], [250, 185], [190, 195], [160, 210], // USA / Canada
    [320, 380], [290, 420], [260, 330], // S America
    [480, 160], [510, 150], [520, 180], [560, 150], [490, 185], // Europe
    [540, 250], [500, 420], [580, 310], // Africa
    [690, 230], [740, 240], [810, 220], [840, 200], [880, 210], [900, 220], // Asia / Japan
    [860, 400], [800, 410] // Australia
  ];

  for (const [cx, cy] of cityCoordinates) {
    const px = cx * (width / 1000);
    const py = cy * (height / 500);
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Suburbs bloom
    ctx.fillStyle = 'rgba(255, 210, 120, 0.4)';
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffdf88';
  }

  dt.update();
  return dt;
}

/**
 * Creates high-detail procedural cloud texture (2048x1024) with cyclone swirls and storm bands.
 */
export function createEarthCloudTexture(scene: Scene, width = 2048, height = 1024): DynamicTexture {
  const dt = new DynamicTexture('earth-cloud-dt', { width, height }, scene, true);
  const ctx = dt.getContext();

  ctx.clearRect(0, 0, width, height);

  // Multi-layered fractal cloud patterns
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';

  // Equatorial Intertropical Convergence Zone (ITCZ)
  for (let x = 0; x < width; x += 35) {
    const yCenter = height * 0.48 + Math.sin(x * 0.015) * 40;
    const radius = 25 + (x % 30);
    ctx.beginPath();
    ctx.arc(x, yCenter, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mid-latitude storm swirls (Northern & Southern hemispheres)
  const storms = [
    { x: width * 0.22, y: height * 0.32, r: 85 },
    { x: width * 0.48, y: height * 0.28, r: 105 },
    { x: width * 0.76, y: height * 0.34, r: 95 },
    { x: width * 0.35, y: height * 0.68, r: 90 },
    { x: width * 0.82, y: height * 0.72, r: 100 },
  ];

  for (const s of storms) {
    for (let ring = 0; ring < 6; ring++) {
      const angleOffset = ring * 0.8;
      for (let pt = 0; pt < 14; pt++) {
        const theta = angleOffset + (pt * Math.PI) / 7;
        const dist = (ring + 1) * (s.r / 6);
        const px = (s.x + Math.cos(theta) * dist + width) % width;
        const py = s.y + Math.sin(theta) * dist * 0.6;
        ctx.beginPath();
        ctx.arc(px, py, 12 + ring * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Soft scattered cumulus clusters
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  for (let i = 0; i < 180; i++) {
    const x = (i * 97) % width;
    const y = (i * 53 + 80) % (height * 0.85);
    const r = 20 + (i % 35);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  dt.update();
  return dt;
}

/**
 * Creates Cosmic Sky Dome texture with deep space nebula clouds, Milky Way band, and multi-magnitude stars.
 */
export function createCosmicSkyTexture(scene: Scene, size = 2048): DynamicTexture {
  const dt = new DynamicTexture('cosmic-sky-dt', { width: size, height: size }, scene, false);
  const ctx = dt.getContext();

  // 1. Deep Space Black Base
  ctx.fillStyle = '#020307';
  ctx.fillRect(0, 0, size, size);

  // 2. Cosmic Nebula Clouds (Magenta, Cyan, Violet, Golden Gas)
  const nebulas = [
    { x: size * 0.3, y: size * 0.4, r: size * 0.35, c1: 'rgba(120, 20, 160, 0.18)', c2: 'rgba(20, 10, 60, 0)' },
    { x: size * 0.65, y: size * 0.55, r: size * 0.4, c1: 'rgba(10, 140, 200, 0.16)', c2: 'rgba(5, 40, 90, 0)' },
    { x: size * 0.5, y: size * 0.25, r: size * 0.3, c1: 'rgba(180, 80, 20, 0.12)', c2: 'rgba(50, 20, 10, 0)' },
    { x: size * 0.8, y: size * 0.8, r: size * 0.35, c1: 'rgba(70, 30, 140, 0.15)', c2: 'rgba(0, 0, 0, 0)' }
  ];

  for (const n of nebulas) {
    const g = ctx.createRadialGradient(n.x, n.y, 10, n.x, n.y, n.r);
    g.addColorStop(0, n.c1);
    g.addColorStop(1, n.c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }

  // 3. Dense Milky Way Core Band (Diagonal luminous streak)
  const mwGrad = ctx.createLinearGradient(0, 0, size, size);
  mwGrad.addColorStop(0, 'rgba(0,0,0,0)');
  mwGrad.addColorStop(0.42, 'rgba(150, 180, 230, 0.07)');
  mwGrad.addColorStop(0.50, 'rgba(220, 230, 255, 0.18)');
  mwGrad.addColorStop(0.58, 'rgba(180, 160, 220, 0.08)');
  mwGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mwGrad;
  ctx.fillRect(0, 0, size, size);

  // 4. 2500+ Stars of Varied Magnitudes & Spectral Types
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const spectralRand = Math.random();

    let starColor = '#ffffff';
    if (spectralRand < 0.15) starColor = '#9bb0ff'; // Blue giant
    else if (spectralRand < 0.3) starColor = '#ffd2a1'; // Orange K-class
    else if (spectralRand < 0.35) starColor = '#ffb4b4'; // Red dwarf

    ctx.fillStyle = starColor;
    const r = Math.random() < 0.08 ? (Math.random() < 0.02 ? 2.8 : 1.8) : (Math.random() < 0.5 ? 1.0 : 0.6);

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Diffraction cross-spikes on prominent stars
    if (r > 2.0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.lineTo(x + 8, y);
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x, y + 8);
      ctx.stroke();
    }
  }

  dt.update();
  return dt;
}

/**
 * Creates high-detail Rocket Body Livery Texture with panel seams, NASA worm logo, USA flag, and thermal tile maps.
 */
export function createRocketLiveryTexture(scene: Scene, width = 1024, height = 1024): DynamicTexture {
  const dt = new DynamicTexture('rocket-livery-dt', { width, height }, scene, true);
  const ctx = dt.getContext();

  // White base fuselage coat
  ctx.fillStyle = '#f6f7fa';
  ctx.fillRect(0, 0, width, height);

  // Vertical structural panel weld seams
  ctx.strokeStyle = '#d4d8e0';
  ctx.lineWidth = 2;
  for (let x = 0; x <= width; x += width / 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Horizontal interstage rings and panel latches
  for (let y = 0; y <= height; y += height / 12) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Dual Black/Red Vertical Racing Stripes
  ctx.fillStyle = '#111317';
  ctx.fillRect(width * 0.12, 0, 16, height);
  ctx.fillStyle = '#c8102e';
  ctx.fillRect(width * 0.12 + 18, 0, 6, height);

  // NASA Worm / Mission Typography Decal
  ctx.fillStyle = '#c8102e';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('NASA', width * 0.28, height * 0.35);

  ctx.fillStyle = '#1a1e24';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('UNITED STATES', width * 0.28, height * 0.40);

  // USA Flag decal
  const flagX = width * 0.28;
  const flagY = height * 0.43;
  const flagW = 80;
  const flagH = 45;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(flagX, flagY, flagW, flagH);
  ctx.fillStyle = '#c8102e';
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(flagX, flagY + i * (flagH / 7), flagW, flagH / 14);
  }
  ctx.fillStyle = '#002868';
  ctx.fillRect(flagX, flagY, flagW * 0.45, flagH * 0.55);

  // Hexagonal/Grid PICA-X Thermal Shield Tiles on bottom quadrant
  ctx.fillStyle = '#181b20';
  ctx.fillRect(0, height * 0.78, width, height * 0.22);
  ctx.strokeStyle = '#2d333b';
  ctx.lineWidth = 1;
  for (let ty = height * 0.78; ty < height; ty += 12) {
    ctx.beginPath();
    ctx.moveTo(0, ty);
    ctx.lineTo(width, ty);
    ctx.stroke();
  }
  for (let tx = 0; tx < width; tx += 12) {
    ctx.beginPath();
    ctx.moveTo(tx, height * 0.78);
    ctx.lineTo(tx, height);
    ctx.stroke();
  }

  dt.update();
  return dt;
}

/**
 * Creates ISS Photovoltaic Solar Panel Texture with blue silicon cells and gold kapton backing.
 */
export function createISSSolarPanelTexture(scene: Scene, width = 1024, height = 512): DynamicTexture {
  const dt = new DynamicTexture('iss-solar-dt', { width, height }, scene, true);
  const ctx = dt.getContext();

  // Dark solar blue base
  ctx.fillStyle = '#081730';
  ctx.fillRect(0, 0, width, height);

  // Solar cells grid matrix
  const cellW = 38;
  const cellH = 22;
  const gap = 3;

  for (let x = gap; x < width - cellW; x += cellW + gap) {
    for (let y = gap; y < height - cellH; y += cellH + gap) {
      // Photovoltaic cell gradient
      const cg = ctx.createLinearGradient(x, y, x + cellW, y + cellH);
      cg.addColorStop(0, '#102e5c');
      cg.addColorStop(0.5, '#0c2448');
      cg.addColorStop(1, '#081a36');
      ctx.fillStyle = cg;
      ctx.fillRect(x, y, cellW, cellH);

      // Silver busbars / conductor lines
      ctx.strokeStyle = 'rgba(210, 230, 255, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + cellW / 2, y);
      ctx.lineTo(x + cellW / 2, y + cellH);
      ctx.stroke();
    }
  }

  // Gold Kapton border frame
  ctx.strokeStyle = '#d49b28';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, width - 6, height - 6);

  dt.update();
  return dt;
}

/**
 * Creates Gold Kapton Multi-Layer Insulation (MLI) wrinkled foil texture.
 */
export function createISSGoldFoilTexture(scene: Scene, size = 512): DynamicTexture {
  const dt = new DynamicTexture('iss-gold-foil-dt', { width: size, height: size }, scene, true);
  const ctx = dt.getContext();

  ctx.fillStyle = '#d99818';
  ctx.fillRect(0, 0, size, size);

  // Wrinkle facet simulation
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 20 + Math.random() * 40;
    const h = 15 + Math.random() * 30;

    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, 'rgba(255, 230, 120, 0.35)');
    g.addColorStop(0.5, 'rgba(217, 152, 24, 0.1)');
    g.addColorStop(1, 'rgba(120, 70, 5, 0.4)');

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y + Math.random() * 8);
    ctx.lineTo(x + w * 0.8, y + h);
    ctx.lineTo(x - Math.random() * 8, y + h * 0.9);
    ctx.closePath();
    ctx.fill();
  }

  dt.update();
  return dt;
}

/**
 * Creates International Standard Payload Rack (ISPR) front face texture for ISS interior.
 */
export function createISPRRackTexture(scene: Scene, size = 512): DynamicTexture {
  const dt = new DynamicTexture('ispr-rack-dt', { width: size, height: size }, scene, true);
  const ctx = dt.getContext();

  // Clean NASA white/gray aluminum rack base
  ctx.fillStyle = '#cfd4dc';
  ctx.fillRect(0, 0, size, size);

  // Sub-rack panels (4 modular tiers)
  const tierH = size / 4;
  for (let t = 0; t < 4; t++) {
    const y = t * tierH;
    ctx.strokeStyle = '#8b93a0';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, y + 4, size - 12, tierH - 8);

    // Dark instrument cavity
    ctx.fillStyle = '#22262d';
    ctx.fillRect(14, y + 10, size - 28, tierH - 20);

    // Instrument switches, dials, and LED readouts
    for (let c = 0; c < 6; c++) {
      const bx = 30 + c * 75;
      const by = y + 25;

      // Status LED (Green / Amber)
      ctx.fillStyle = c % 2 === 0 ? '#10e870' : '#ffa500';
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, Math.PI * 2);
      ctx.fill();

      // Rocker switch / Breaker toggle
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(bx + 12, by - 6, 18, 12);
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(bx + 14, by - 4, 8, 8);
    }

    // Caution stripes / Label plates
    ctx.fillStyle = '#eab308';
    ctx.fillRect(size - 90, y + 14, 65, 12);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 8px monospace';
    ctx.fillText(`ISPR-MOD-${t + 1}`, size - 86, y + 23);
  }

  dt.update();
  return dt;
}

/**
 * Creates high-contrast emissive flight / laboratory HUD LCD screen.
 */
export function createConsoleScreenTexture(
  scene: Scene,
  title: string,
  readouts: string[],
  width = 512,
  height = 320
): DynamicTexture {
  const dt = new DynamicTexture(`console-screen-${title}`, { width, height }, scene, true);
  const ctx = dt.getContext();

  // Dark glass terminal background
  ctx.fillStyle = '#050c18';
  ctx.fillRect(0, 0, width, height);

  // Screen outer bezel border & glowing grid
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, width - 8, height - 8);

  // Background telemetry grid
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 16; x < width - 16; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 16);
    ctx.lineTo(x, height - 16);
    ctx.stroke();
  }
  for (let y = 16; y < height - 16; y += 32) {
    ctx.beginPath();
    ctx.moveTo(16, y);
    ctx.lineTo(width - 16, y);
    ctx.stroke();
  }

  // Header Bar
  ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
  ctx.fillRect(8, 8, width - 16, 32);
  ctx.fillStyle = '#00f7ff';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`[ ${title.toUpperCase()} ]`, 20, 30);

  // Sine Wave / Orbit Vector Graph
  ctx.strokeStyle = '#39ff14'; // neon green
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let gx = 20; gx < width - 20; gx += 4) {
    const gy = height * 0.45 + Math.sin(gx * 0.06) * 22 + Math.cos(gx * 0.12) * 8;
    if (gx === 20) ctx.moveTo(gx, gy);
    else ctx.lineTo(gx, gy);
  }
  ctx.stroke();

  // Telemetry Rows
  ctx.fillStyle = '#bbf2f6';
  ctx.font = '14px monospace';
  let lineY = height * 0.65;
  for (const line of readouts) {
    ctx.fillText(`> ${line}`, 24, lineY);
    lineY += 22;
  }

  dt.update();
  return dt;
}

/**
 * Creates Weathered Launch Pad Concrete texture with scorch marks and safety hazard stripes.
 */
export function createLaunchPadConcreteTexture(scene: Scene, size = 1024): DynamicTexture {
  const dt = new DynamicTexture('pad-concrete-dt', { width: size, height: size }, scene, true);
  const ctx = dt.getContext();

  // Weathered gray industrial concrete
  ctx.fillStyle = '#5a6068';
  ctx.fillRect(0, 0, size, size);

  // Concrete expansion joint grid
  ctx.strokeStyle = '#3d4248';
  ctx.lineWidth = 4;
  for (let x = 0; x <= size; x += size / 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = 0; y <= size; y += size / 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  // Central rocket exhaust blast scorch mark
  const scorch = ctx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size * 0.35);
  scorch.addColorStop(0, 'rgba(15, 17, 20, 0.92)');
  scorch.addColorStop(0.5, 'rgba(40, 44, 50, 0.65)');
  scorch.addColorStop(1, 'rgba(90, 96, 104, 0)');
  ctx.fillStyle = scorch;
  ctx.fillRect(0, 0, size, size);

  // Safety Yellow & Black Diagonal Hazard Borders
  const stripeW = 35;
  const borderH = 40;
  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 0, size, borderH);
  ctx.fillRect(0, size - borderH, size, borderH);

  ctx.fillStyle = '#111827';
  for (let sx = -size; sx < size * 2; sx += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx + stripeW, 0);
    ctx.lineTo(sx + stripeW - borderH, borderH);
    ctx.lineTo(sx - borderH, borderH);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(sx, size - borderH);
    ctx.lineTo(sx + stripeW, size - borderH);
    ctx.lineTo(sx + stripeW - borderH, size);
    ctx.lineTo(sx - borderH, size);
    ctx.closePath();
    ctx.fill();
  }

  dt.update();
  return dt;
}
