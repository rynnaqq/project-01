/**
 * Memphis decoration kit — squiggles, zigzags, starbursts and friends.
 * All shapes draw with `currentColor` so parent text-* utilities color them.
 * Decorative only: every component sets aria-hidden.
 */

type ShapeProps = { className?: string };

/** Wavy hand-drawn line. */
export function Squiggle({ className }: ShapeProps) {
  return (
    <svg viewBox="0 0 96 32" fill="none" aria-hidden className={className}>
      <path
        d="M4 22c8-16 16-16 24 0s16 16 24 0 16-16 24 0 12 10 16 6"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Horizontal zigzag band. */
export function ZigzagBand({ className }: ShapeProps) {
  return (
    <svg viewBox="0 0 120 14" preserveAspectRatio="none" aria-hidden className={className}>
      <path
        d="M0 12 L10 2 L20 12 L30 2 L40 12 L50 2 L60 12 L70 2 L80 12 L90 2 L100 12 L110 2 L120 12"
        stroke="currentColor"
        strokeWidth="5"
        fill="none"
      />
    </svg>
  );
}

/** Four-point sparkle. */
export function Sparkle({ className }: ShapeProps) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <path
        d="M16 1c1.6 8.2 6.8 13.4 15 15-8.2 1.6-13.4 6.8-15 15-1.6-8.2-6.8-13.4-15-15C9.2 14.4 14.4 9.2 16 1Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Bold plus/cross mark. */
export function PlusMark({ className }: ShapeProps) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden className={className}>
      <path
        d="M11 2h6v9h9v6h-9v9h-6v-9H2v-6h9V2Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Solid triangle. */
export function TriShape({ className }: ShapeProps) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <path d="M16 3 30 29H2L16 3Z" fill="currentColor" />
    </svg>
  );
}

/** Half donut (open ring). */
export function HalfRing({ className }: ShapeProps) {
  return (
    <svg viewBox="0 0 40 20" fill="none" aria-hidden className={className}>
      <path
        d="M4 18a16 16 0 0 1 32 0"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Cluster of polka dots. */
export function DotCluster({ className }: ShapeProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={className}>
      <circle cx="8" cy="8" r="5" fill="currentColor" />
      <circle cx="30" cy="14" r="4" fill="currentColor" />
      <circle cx="14" cy="32" r="4" fill="currentColor" />
      <circle cx="38" cy="38" r="5" fill="currentColor" />
    </svg>
  );
}
