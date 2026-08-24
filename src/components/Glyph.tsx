import emojiMap from '../../emoji-image-map.json';

/**
 * Whether pictogram rendering is on. Disable with VITE_REPLACE_EMOJI=false;
 * the component then falls back to a lettered chip so the UI never breaks.
 */
const ENABLED = import.meta.env.VITE_REPLACE_EMOJI !== 'false';

type GlyphProps = {
  /** Catalog slug, e.g. "robot" — keys of emoji-image-map.json. */
  id: string;
  /** Rendered size in px (square). */
  size?: number;
  /** Accessible text; omit when the label is visible next to the glyph. */
  label?: string;
  className?: string;
};

type MapEntry = { src: string; alt: string; codepoint: string };

const entries = emojiMap as Record<string, MapEntry>;

/**
 * Static image pictogram replacing platform emoji rendering. Local, cached,
 * lazy-decoded SVG art — the same slug always resolves to the same asset.
 */
export default function Glyph({ id, size = 28, label, className = '' }: GlyphProps) {
  const entry = entries[id];

  if (!ENABLED || !entry) {
    // Graceful fallback: initial-letter chip (unknown slug or feature off).
    const letter = (label ?? entry?.alt ?? id).charAt(0).toUpperCase();
    return (
      <span
        role={label ? undefined : 'img'}
        aria-label={label}
        className={`inline-flex select-none items-center justify-center rounded-full border-2 border-arcade-ink bg-arcade-sun font-bold leading-none text-arcade-ink ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      >
        {letter}
      </span>
    );
  }

  return (
    <img
      src={entry.src}
      alt={label ?? ''}
      title={label}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      aria-hidden={label ? undefined : true}
      className={`inline-block select-none align-middle ${className}`}
    />
  );
}
