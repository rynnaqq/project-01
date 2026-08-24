# Interactive Arcade Hub

Real-time multiplayer mini-games. Create a room, share the 6-character code, and
battle on a shared live scoreboard.

Stack: React 18 + TypeScript + Vite + Tailwind CSS + Supabase (auth, Postgres,
Realtime).

## Development

```bash
npm install
cp .env.example .env      # fill in your Supabase project values
npm run dev               # http://localhost:5173
```

Other scripts: `npm run build`, `npm run lint`, `npm test`,
`npm run validate:sql`.

## Avatar pictograms (emoji replacement)

The UI never renders platform emoji. Every avatar is a local flat SVG
(Twemoji art, CC-BY 4.0) served from `public/emoji/` and resolved through the
root mapping file `emoji-image-map.json`.

How it works:

- `src/components/Glyph.tsx` looks up an art slug (`"robot"`, `"ninja"`, ...)
  in `emoji-image-map.json` and renders a lazy-loaded, async-decoded
  `<img>` — cached by the browser, no CDN round-trips at runtime.
- Set `VITE_REPLACE_EMOJI=false` in `.env` to disable images; `<Glyph>` then
  renders a lettered chip fallback instead.

Adding or changing a pictogram:

1. Add/adjust the entry in `scripts/generate-emoji-images.mjs`
   (`id`, Twemoji `codepoint`, `alt`). Codepoints are lowercase hex, e.g.
   `1f9d9` for the mage.
2. Run `npm run emoji:generate` — downloads missing SVGs into `public/emoji/`
   and rewrites `emoji-image-map.json`. Re-run with `-- --force` to re-download
   everything.
3. Point the avatar's `art` slug (`src/lib/avatars.ts`) at the new id.

A unit guard (`src/lib/emojiMap.test.ts`) fails the suite if any avatar slug
lacks a map entry or its SVG file is missing from disk.

To swap the art style for something custom (e.g. AI-generated icons), replace
the files in `public/emoji/` keeping the same filenames — no code changes
needed; update the `CDN` constant in the generator only if you also want
re-downloads to pull the new style.
