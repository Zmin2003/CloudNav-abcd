import React, { useEffect, useRef } from 'react';

// ---- Types ----

type PetalType = 'flower' | 'single' | 'tiny';

interface Petal {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  swingAmplitude: number;
  swingSpeed: number;
  phase: number;
  type: PetalType;
  colorIdx: number;
  tilt3d: number;       // simulate 3D tilt for depth
  tiltSpeed: number;
}

// ---- Config ----

const PETAL_COUNT = 40;

const PALETTE = [
  { outer: '#ffb7c5', inner: '#ffe0e6', center: '#fff5f7', glow: 'rgba(255,183,197,0.4)' },
  { outer: '#ff9bb3', inner: '#ffd1dc', center: '#fff0f3', glow: 'rgba(255,155,179,0.35)' },
  { outer: '#ffa5ba', inner: '#ffdbe4', center: '#fff8fa', glow: 'rgba(255,165,186,0.3)' },
  { outer: '#f7a0b5', inner: '#fcc8d5', center: '#fff2f5', glow: 'rgba(247,160,181,0.35)' },
  { outer: '#ffcad4', inner: '#ffe8ed', center: '#fffbfc', glow: 'rgba(255,202,212,0.3)' },
];

// ---- Helpers ----

function createPetal(w: number, h: number, fromTop: boolean): Petal {
  const types: PetalType[] = ['flower', 'single', 'single', 'single', 'tiny', 'tiny'];
  const type = types[Math.floor(Math.random() * types.length)];
  const baseSize = type === 'flower' ? 14 + Math.random() * 10 : type === 'single' ? 8 + Math.random() * 10 : 4 + Math.random() * 5;

  return {
    x: Math.random() * w,
    y: fromTop ? -30 - Math.random() * 60 : Math.random() * h,
    size: baseSize,
    speedY: 0.25 + Math.random() * 0.6,
    speedX: -0.15 + Math.random() * 0.3,
    rotation: Math.random() * 360,
    rotationSpeed: -0.6 + Math.random() * 1.2,
    opacity: type === 'tiny' ? 0.4 + Math.random() * 0.3 : 0.6 + Math.random() * 0.4,
    swingAmplitude: 15 + Math.random() * 35,
    swingSpeed: 0.008 + Math.random() * 0.015,
    phase: Math.random() * Math.PI * 2,
    type,
    colorIdx: Math.floor(Math.random() * PALETTE.length),
    tilt3d: Math.random() * Math.PI * 2,
    tiltSpeed: 0.01 + Math.random() * 0.02,
  };
}

/** Draw a single petal shape (leaf-like) */
function drawSinglePetal(ctx: CanvasRenderingContext2D, s: number, color: typeof PALETTE[0]) {
  // Glow
  ctx.shadowColor = color.glow;
  ctx.shadowBlur = s * 0.8;

  // Gradient fill
  const grad = ctx.createRadialGradient(s * 0.35, 0, 0, s * 0.4, 0, s * 0.7);
  grad.addColorStop(0, color.center);
  grad.addColorStop(0.4, color.inner);
  grad.addColorStop(1, color.outer);
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(s * 0.15, -s * 0.35, s * 0.65, -s * 0.35, s, 0);
  ctx.bezierCurveTo(s * 0.65, s * 0.35, s * 0.15, s * 0.35, 0, 0);
  ctx.fill();

  ctx.shadowBlur = 0;

  // Vein line
  ctx.strokeStyle = color.inner;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha *= 0.5;
  ctx.beginPath();
  ctx.moveTo(s * 0.05, 0);
  ctx.quadraticCurveTo(s * 0.5, -s * 0.03, s * 0.9, 0);
  ctx.stroke();
}

/** Draw a five-petal sakura flower */
function drawFlower(ctx: CanvasRenderingContext2D, s: number, color: typeof PALETTE[0]) {
  const petalLen = s * 0.7;

  // Glow
  ctx.shadowColor = color.glow;
  ctx.shadowBlur = s * 1.2;

  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI * 2) / 5);

    // Each petal with a gradient
    const grad = ctx.createRadialGradient(petalLen * 0.3, 0, 0, petalLen * 0.4, 0, petalLen * 0.6);
    grad.addColorStop(0, color.center);
    grad.addColorStop(0.5, color.inner);
    grad.addColorStop(1, color.outer);
    ctx.fillStyle = grad;

    // Heart-shaped petal tip (notched)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(petalLen * 0.3, -petalLen * 0.4, petalLen * 0.8, -petalLen * 0.25, petalLen * 0.85, -petalLen * 0.05);
    ctx.quadraticCurveTo(petalLen * 0.95, 0, petalLen * 0.85, petalLen * 0.05);
    ctx.bezierCurveTo(petalLen * 0.8, petalLen * 0.25, petalLen * 0.3, petalLen * 0.4, 0, 0);
    ctx.fill();

    ctx.restore();
  }

  ctx.shadowBlur = 0;

  // Center pistil
  const centerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.12);
  centerGrad.addColorStop(0, '#ffe082');
  centerGrad.addColorStop(0.6, '#ffcc33');
  centerGrad.addColorStop(1, '#f0a030');
  ctx.fillStyle = centerGrad;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Tiny stamens
  ctx.fillStyle = '#f0a030';
  for (let i = 0; i < 5; i++) {
    const angle = (i * Math.PI * 2) / 5 + Math.PI / 5;
    const dx = Math.cos(angle) * s * 0.16;
    const dy = Math.sin(angle) * s * 0.16;
    ctx.beginPath();
    ctx.arc(dx, dy, s * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draw tiny dot petal */
function drawTiny(ctx: CanvasRenderingContext2D, s: number, color: typeof PALETTE[0]) {
  ctx.shadowColor = color.glow;
  ctx.shadowBlur = s * 2;
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
  grad.addColorStop(0, color.center);
  grad.addColorStop(0.5, color.inner);
  grad.addColorStop(1, color.outer);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, s, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// ---- Component ----

const SakuraBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const petalsRef = useRef<Petal[]>([]);
  const frameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dpr = window.devicePixelRatio || 1;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    petalsRef.current = Array.from({ length: PETAL_COUNT }, () =>
      createPetal(window.innerWidth, window.innerHeight, false)
    );

    const animate = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      timeRef.current += 1;

      ctx.clearRect(0, 0, w, h);

      petalsRef.current.forEach((p, i) => {
        // Physics
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(timeRef.current * p.swingSpeed + p.phase) * 0.6;
        p.rotation += p.rotationSpeed;
        p.tilt3d += p.tiltSpeed;

        // 3D tilt effect — scale X to simulate depth rotation
        const scaleX = 0.4 + Math.abs(Math.cos(p.tilt3d)) * 0.6;

        // Reset if out of bounds
        if (p.y > h + 40 || p.x < -40 || p.x > w + 40) {
          petalsRef.current[i] = createPetal(w, h, true);
          return;
        }

        const color = PALETTE[p.colorIdx];

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.scale(scaleX, 1);
        ctx.globalAlpha = p.opacity;

        if (p.type === 'flower') {
          drawFlower(ctx, p.size, color);
        } else if (p.type === 'single') {
          drawSinglePetal(ctx, p.size, color);
        } else {
          drawTiny(ctx, p.size, color);
        }

        ctx.restore();
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[5]"
    />
  );
};

export default SakuraBackground;
