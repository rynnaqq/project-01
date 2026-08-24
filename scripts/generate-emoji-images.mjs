#!/usr/bin/env node
/**
 * generate-emoji-images.mjs
 *
 * Downloads flat SVG pictograms (Twemoji, CC-BY 4.0) for every avatar slug
 * and emits the emoji-image-map.json consumed by <Glyph> in the app.
 *
 * - Idempotent: existing files are kept unless --force is passed.
 * - Offline-safe runtime: assets are committed under public/emoji/, so the
 *   app never talks to the CDN.
 *
 * Usage:
 *   npm run emoji:generate          # fetch missing files + rewrite map
 *   npm run emoji:generate -- --force
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import path from 'node:path';

const CDN = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.0.3/assets/svg';
const OUT_DIR = path.resolve('public/emoji');
const MAP_FILE = path.resolve('emoji-image-map.json');
const FORCE = process.argv.includes('--force');

/** Canonical catalog: slug -> Twemoji codepoint (lowercase hex). */
const PICTOGRAMS = [
  { id: 'robot', codepoint: '1f916', alt: 'Robot' },
  { id: 'alien', codepoint: '1f47e', alt: 'Alien monster' },
  { id: 'ghost', codepoint: '1f47b', alt: 'Ghost' },
  { id: 'cat', codepoint: '1f431', alt: 'Cat face' },
  { id: 'fox', codepoint: '1f98a', alt: 'Fox' },
  { id: 'dragon', codepoint: '1f432', alt: 'Dragon face' },
  { id: 'wizard', codepoint: '1f9d9', alt: 'Mage' },
  { id: 'ninja', codepoint: '1f977', alt: 'Ninja' },
  { id: 'rocket', codepoint: '1f680', alt: 'Rocket' },
  { id: 'star', codepoint: '2b50', alt: 'Star' },
  { id: 'fire', codepoint: '1f525', alt: 'Fire' },
  { id: 'skull', codepoint: '1f480', alt: 'Skull' },
];

async function exists(file) {
  try {
    await access(file, FS.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function download(entry, dest) {
  const url = `${CDN}/${entry.codepoint}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const body = await res.text();
  if (!body.trimStart().startsWith('<svg')) {
    throw new Error(`Non-SVG payload for ${url}`);
  }
  await writeFile(dest, body, 'utf8');
  return body.length;
}

const forceText = FORCE ? '(force)' : '';
console.log(`Fetching ${PICTOGRAMS.length} pictograms into public/emoji ${forceText}`);

await mkdir(OUT_DIR, { recursive: true });

const map = {};
let fetched = 0;
let skipped = 0;

for (const entry of PICTOGRAMS) {
  const dest = path.join(OUT_DIR, `${entry.codepoint}.svg`);
  if (!FORCE && (await exists(dest))) {
    skipped += 1;
  } else {
    const bytes = await download(entry, dest);
    fetched += 1;
    console.log(`  ✓ ${entry.id.padEnd(8)} ${entry.codepoint}.svg (${bytes} bytes)`);
  }
  map[entry.id] = {
    src: `/emoji/${entry.codepoint}.svg`,
    alt: entry.alt,
    codepoint: entry.codepoint,
  };
}

await writeFile(MAP_FILE, `${JSON.stringify(map, null, 2)}\n`, 'utf8');

console.log(
  `\nDone. ${fetched} downloaded, ${skipped} already present.\nMap written to ${path.relative(process.cwd(), MAP_FILE)}`,
);
