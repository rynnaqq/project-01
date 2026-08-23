import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/** Respect the OS reduce-motion setting and skip pointer-only effects on touch. */
function motionAllowed(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return true;
}

function finePointer(): boolean {
  return window.matchMedia('(pointer: fine)').matches;
}

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Sibling order for the stagger (each step adds 45ms of delay). */
  index?: number;
};

/**
 * Scroll/mount reveal: fades and slides an element in when it enters the
 * viewport. Compositor-only (opacity + translate3d), staggers via --reveal-i,
 * observes once then disconnects, and drops will-change after settling.
 */
export function Reveal({ children, className = '', index = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--reveal-i', String(index));

    if (!motionAllowed()) {
      el.classList.add('is-visible');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          const cleanup = () => {
            entry.target.classList.add('revealed');
          };
          entry.target.addEventListener('transitionend', cleanup, { once: true });
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -5% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}

type SpotlightProps = {
  children: ReactNode;
  className?: string;
  /** Tint of the light blob (any CSS color). */
  color?: string;
};

/**
 * Spotlight border/glow: a clipped radial light follows the cursor inside a
 * card. The beam is a fixed-size layer moved with translate3d only — zero
 * layout work, zero re-renders (styles are written imperatively).
 */
export function Spotlight({ children, className = '', color = 'rgba(255,255,255,0.30)' }: SpotlightProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const card = ref.current;
    if (!card || !motionAllowed() || !finePointer()) return;

    const beam = document.createElement('span');
    beam.className = 'spotlight-beam';
    beam.style.backgroundImage = `radial-gradient(closest-side, ${color}, transparent 72%)`;
    beam.setAttribute('aria-hidden', 'true');
    card.appendChild(beam);

    let raf = 0;
    const move = (event: PointerEvent) => {
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Beam is centered at its own origin by CSS; translate it to the cursor.
        beam.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    };

    const enter = () => {
      beam.style.opacity = '1';
      card.style.willChange = 'transform';
    };
    const leave = () => {
      beam.style.opacity = '0';
      card.style.willChange = 'auto';
    };

    card.addEventListener('pointermove', move);
    card.addEventListener('pointerenter', enter);
    card.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(raf);
      card.removeEventListener('pointermove', move);
      card.removeEventListener('pointerenter', enter);
      card.removeEventListener('pointerleave', leave);
      beam.remove();
    };
  }, [color]);

  return (
    <div ref={ref} className={`spotlight ${className}`}>
      {children}
    </div>
  );
}

type MagneticProps = {
  children: ReactNode;
  className?: string;
  /** Max pull distance in px at the element edge. */
  max?: number;
  style?: CSSProperties;
};

/**
 * Magnetic hover: the wrapper drifts toward the cursor (max `max` px) while it
 * is hovered, then springs back with overshoot. Transform-only; listeners are
 * bound only for fine pointers.
 */
export function Magnetic({ children, className = '', max = 7, style }: MagneticProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !motionAllowed() || !finePointer()) return;

    const move = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const dx = (event.clientX - rect.left) / rect.width - 0.5;
      const dy = (event.clientY - rect.top) / rect.height - 0.5;
      el.style.transition = 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)';
      el.style.transform = `translate3d(${dx * max * 2}px, ${dy * max * 2}px, 0)`;
    };
    const leave = () => {
      el.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
      el.style.transform = 'translate3d(0, 0, 0)';
    };

    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, [max]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
