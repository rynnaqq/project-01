import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Confetto = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  shape: 0 | 1 | 2;
  color: string;
};

const COLORS = ['#ff71ce', '#ffce5c', '#86ccca', '#6a7bb4'];

/**
 * Memphis confetti backdrop rendered on a <canvas>: squares, circles and
 * triangles tumbling slowly across the frame.
 *
 * Performance guardrails:
 *  - device pixel ratio capped at 2;
 *  - piece count scales with area but is capped;
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
    let pieces: Confetto[] = [];
    let rafId = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const parent = canvas!.parentElement;
      width = parent?.clientWidth ?? window.innerWidth;
      height = parent?.clientHeight ?? 320;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.min(64, Math.floor((width * height) / 16000));
      pieces = Array.from({ length: target }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.02,
        size: 7 + Math.random() * 9,
        shape: Math.floor(Math.random() * 3) as 0 | 1 | 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      }));
    }

    function drawPiece(p: Confetto) {
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.color;
      ctx!.strokeStyle = '#1a1611';
      ctx!.lineWidth = 2;
      if (p.shape === 0) {
        // Square
        ctx!.beginPath();
        ctx!.rect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx!.fill();
        ctx!.stroke();
      } else if (p.shape === 1) {
        // Circle
        ctx!.beginPath();
        ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.stroke();
      } else {
        // Triangle
        ctx!.beginPath();
        ctx!.moveTo(0, -p.size / 2);
        ctx!.lineTo(p.size / 2, p.size / 2);
        ctx!.lineTo(-p.size / 2, p.size / 2);
        ctx!.closePath();
        ctx!.fill();
        ctx!.stroke();
      }
      ctx!.restore();
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);
      for (const p of pieces) drawPiece(p);
    }

    function step() {
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.x < -20 || p.x > width + 20) p.vx *= -1;
        if (p.y < -20 || p.y > height + 20) p.vy *= -1;
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
