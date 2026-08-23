import { useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

type TiltCardProps = {
  children: ReactNode;
  className?: string;
  /** Max rotation in degrees at the card edges. */
  maxTilt?: number;
};

/**
 * A card that tilts in 3D toward the pointer on hover. Disabled (renders a
 * static card) when the user prefers reduced motion.
 */
export default function TiltCard({ children, className = '', maxTilt = 10 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotion();
  const [transform, setTransform] = useState<string>('');

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reducedMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height; // 0..1
    const rotateY = (px - 0.5) * 2 * maxTilt;
    const rotateX = -(py - 0.5) * 2 * maxTilt;
    setTransform(`perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`);
  }

  function handleLeave() {
    setTransform('');
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ transform, transition: 'transform 150ms ease-out', transformStyle: 'preserve-3d' }}
      className={className}
    >
      {children}
    </div>
  );
}
