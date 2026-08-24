import { describe, expect, it } from 'vitest';
import emojiMap from '../../emoji-image-map.json';
import { AVATARS } from './avatars';

/** Eager raw-import of every shipped pictogram (path -> svg text). */
const assets = import.meta.glob<string>('/public/emoji/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

type MapEntry = { src: string; alt: string; codepoint: string };
const entries = emojiMap as Record<string, MapEntry>;

/**
 * Guard: every avatar's art slug must resolve to a map entry whose SVG asset
 * actually ships in public/emoji. Fails when someone adds an avatar without
 * running `npm run emoji:generate`.
 */
describe('emoji-image-map', () => {
  it('has an entry for every avatar art slug', () => {
    for (const avatar of AVATARS) {
      expect(entries[avatar.art], `missing map entry for "${avatar.art}"`).toBeDefined();
    }
  });

  it('points every entry at an existing local SVG', () => {
    for (const [slug, entry] of Object.entries(entries)) {
      const key = `/public/emoji/${entry.codepoint}.svg`;
      expect(assets[key], `missing asset for "${slug}": ${key}`).toBeTruthy();
      expect(entry.src).toBe(`/emoji/${entry.codepoint}.svg`);
      expect(entry.alt.length).toBeGreaterThan(0);
    }
  });
});
