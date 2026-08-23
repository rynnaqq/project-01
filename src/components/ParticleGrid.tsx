import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Particle = { x: number; y: number; vx: number; vy: number };

/**
 * Animated grid-particle backdrop rendered on a <canvas>.
 *
 * Performance guardrails:
 *  - device pixel ratio capped at 2;
 *  - particle count scales with area but is capped;
 *  - honours prefers-reduced-motion by drawing a single static frame.
 */
export default function ParticleGrid({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let rafId = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const LINK_DISTANCE = 120;
    // Prism spectrum — each mote carries its own band of light.
    const SPECTRUM = ['67, 217, 255', '65, 242, 184', '255, 77, 136', '255, 200, 87'];

    function resize() {
      const parent = canvas!.parentElement;
      width = parent?.clientWidth ?? window.innerWidth;
      height = parent?.clientHeight ?? 320;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.min(90, Math.floor((width * height) / 12000));
      particles = Array.from({ length: target }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      }));
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${SPECTRUM[i % SPECTRUM.length]}, 0.85)`;
        ctx!.fill();
      }

      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK_DISTANCE) {
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.strokeStyle = `rgba(125, 170, 235, ${0.22 * (1 - dist / LINK_DISTANCE)})`;
            ctx!.lineWidth = 1;
            ctx!.stroke();
          }
        }
      }
    }

    function step() {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
      }
      draw();
      rafId = requestAnimationFrame(step);
    }

    resize();
    window.addEventListener('resize', resize);

    if (reducedMotion) {
      draw(); // single static frame
    } else {
      rafId = requestAnimationFrame(step);
    }

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafId);
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
