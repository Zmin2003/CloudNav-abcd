import React, { useEffect, useRef } from 'react';

// ==================== Types ====================

interface Petal {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  rot: number;
  rotSpeed: number;
  opacity: number;
  phase: number;
  swingFreq: number;
  swingAmp: number;
  flipAngle: number;
  flipSpeed: number;
  curlAngle: number;
  curlSpeed: number;
  colorIdx: number;
  variant: number;
}

// ==================== Palette ====================
// Enhanced vibrant palette for dreamy glassmorphism background
const PALETTE = [
  { edge: '#ff8fb8', mid: '#fbcfe8', base: '#fdf2f8', vein: '#f472b6' },
  { edge: '#f472b6', mid: '#fce7f3', base: '#fdf2f8', vein: '#fb7185' },
  { edge: '#fb7185', mid: '#ffe4e6', base: '#fff1f2', vein: '#f43f5e' },
  { edge: '#e879f9', mid: '#fae8ff', base: '#fdf4ff', vein: '#d946ef' },
];

// Reduce petal count on mobile for performance (evaluated lazily at first use)
function getPetalCount(): number {
  if (typeof window === 'undefined') return 25;
  const isMobile = 'ontouchstart' in window || window.innerWidth < 768;
  return isMobile ? 25 : 45;
}

// ==================== Create ====================

function create(w: number, h: number, top: boolean): Petal {
  // Guard against zero-dimension viewport (mobile initial paint)
  const safeW = Math.max(w, 320);
  const safeH = Math.max(h, 480);
  return {
    x: Math.random() * safeW,
    y: top ? -(20 + Math.random() * 50) : Math.random() * safeH,
    size: 12 + Math.random() * 16,
    speedY: 0.3 + Math.random() * 0.6,
    speedX: -0.15 + Math.random() * 0.3,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (-0.4 + Math.random() * 0.8) * 0.02,
    opacity: 0.7 + Math.random() * 0.3,
    phase: Math.random() * Math.PI * 2,
    swingFreq: 0.005 + Math.random() * 0.01,
    swingAmp: 0.5 + Math.random() * 1.0,
    flipAngle: Math.random() * Math.PI * 2,
    flipSpeed: 0.008 + Math.random() * 0.018,
    curlAngle: Math.random() * Math.PI * 2,
    curlSpeed: 0.005 + Math.random() * 0.012,
    colorIdx: Math.floor(Math.random() * PALETTE.length),
    variant: Math.floor(Math.random() * 4),
  };
}

// ==================== Draw ====================

function drawPetal(ctx: CanvasRenderingContext2D, p: Petal, _t: number, useShadow: boolean) {
  const s = p.size;
  const c = PALETTE[p.colorIdx];
  const flipScale = 0.35 + Math.abs(Math.cos(p.flipAngle)) * 0.65;
  const curlVal = Math.sin(p.curlAngle) * 0.25;
  const notchDepth = s * (0.06 + p.variant * 0.02);
  const bodyW = s * 0.42;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.scale(flipScale, 1);
  ctx.globalAlpha = p.opacity;

  // Shadow only on desktop (very expensive on mobile GPU)
  if (useShadow) {
    ctx.shadowColor = 'rgba(255,180,220,0.6)';
    ctx.shadowBlur = s * 1.2;
    ctx.shadowOffsetY = s * 0.2;
  }

  // Main petal gradient
  const grad = ctx.createLinearGradient(0, 0, s, 0);
  grad.addColorStop(0, c.base);
  grad.addColorStop(0.3, c.base);
  grad.addColorStop(0.65, c.mid);
  grad.addColorStop(1, c.edge);
  ctx.fillStyle = grad;

  // Petal shape
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(s * 0.2, -bodyW * 0.3, s * 0.45, -bodyW, s * 0.75, -bodyW * 0.85);
  ctx.quadraticCurveTo(s * 0.92, -bodyW * 0.35, s, -notchDepth);
  ctx.quadraticCurveTo(s * 0.96, 0, s, notchDepth);
  ctx.quadraticCurveTo(s * 0.92, bodyW * 0.35, s * 0.75, bodyW * 0.85);
  ctx.bezierCurveTo(s * 0.45, bodyW, s * 0.2, bodyW * 0.3, 0, 0);
  ctx.closePath();
  ctx.fill();

  if (useShadow) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  // Veins
  ctx.globalAlpha = p.opacity * 0.25;
  ctx.strokeStyle = c.vein;
  ctx.lineWidth = 0.4;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(s * 0.05, 0);
  ctx.quadraticCurveTo(s * 0.5, 0, s * 0.92, 0);
  ctx.stroke();

  for (const sign of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 0.25, 0);
    ctx.quadraticCurveTo(s * 0.5, sign * bodyW * 0.35, s * 0.72, sign * bodyW * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.45, 0);
    ctx.quadraticCurveTo(s * 0.65, sign * bodyW * 0.25, s * 0.82, sign * bodyW * 0.45);
    ctx.stroke();
  }

  // Curl / fold highlight
  if (Math.abs(curlVal) > 0.05) {
    ctx.globalAlpha = p.opacity * Math.abs(curlVal) * 0.7;
    const side = curlVal > 0 ? -1 : 1;
    const curlGrad = ctx.createLinearGradient(s * 0.3, 0, s * 0.9, side * bodyW * -0.6);
    curlGrad.addColorStop(0, 'rgba(255,255,255,0)');
    curlGrad.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    curlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = curlGrad;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(s * 0.2, side * bodyW * -0.3, s * 0.45, side * bodyW * -1, s * 0.75, side * bodyW * -0.85);
    ctx.quadraticCurveTo(s * 0.92, side * bodyW * -0.35, s, side * -notchDepth);
    ctx.quadraticCurveTo(s * 0.96, 0, s * 0.5, 0);
    ctx.closePath();
    ctx.fill();
  }

  // Edge rim light (only on desktop for perf)
  if (useShadow) {
    ctx.globalAlpha = p.opacity * 0.15;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, -bodyW * 0.95);
    ctx.quadraticCurveTo(s * 0.85, -bodyW * 0.5, s, -notchDepth);
    ctx.stroke();
  }

  ctx.restore();
}

// ==================== Component ====================

interface SakuraProps {
  enabled?: boolean;
}

const SakuraBackground: React.FC<SakuraProps> = ({ enabled = true }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const petalsRef = useRef<Petal[]>([]);
  const frameRef = useRef<number>(0);
  const tRef = useRef<number>(0);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    if (!enabled) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Detect if touch device for performance optimisations
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const useShadow = !isTouch;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth || document.documentElement.clientWidth || 320;
      const h = window.innerHeight || document.documentElement.clientHeight || 480;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };

      // Redistribute petals if they were initialised with stale dimensions
      if (petalsRef.current.length > 0) {
        for (let i = 0; i < petalsRef.current.length; i++) {
          const p = petalsRef.current[i];
          // If petal is outside new viewport, re-create it
          if (p.x < -50 || p.x > w + 50 || p.y > h + 50) {
            petalsRef.current[i] = create(w, h, false);
          }
        }
      }
    };

    // Delay initial resize slightly to let mobile browsers settle layout
    const initTimer = setTimeout(() => {
      resize();

      const { w, h } = sizeRef.current;
      petalsRef.current = Array.from({ length: getPetalCount() }, () => create(w, h, false));

      const animate = () => {
        tRef.current += 1;
        const t = tRef.current;
        const { w: cw, h: ch } = sizeRef.current;
        ctx.clearRect(0, 0, cw, ch);

        for (let i = 0; i < petalsRef.current.length; i++) {
          const p = petalsRef.current[i];

          const drift = Math.sin(t * p.swingFreq + p.phase) * p.swingAmp;
          const gustX = Math.sin(t * 0.002 + p.phase * 2) * 0.2;

          p.x += p.speedX + drift + gustX;
          p.y += p.speedY + Math.cos(t * p.swingFreq * 0.7 + p.phase) * 0.1;
          p.rot += p.rotSpeed + drift * 0.006;
          p.flipAngle += p.flipSpeed;
          p.curlAngle += p.curlSpeed;

          if (p.y > ch + 50 || p.x < -50 || p.x > cw + 50) {
            petalsRef.current[i] = create(cw, ch, true);
            continue;
          }

          drawPetal(ctx, p, t, useShadow);
        }

        frameRef.current = requestAnimationFrame(animate);
      };

      frameRef.current = requestAnimationFrame(animate);
    }, 50);

    window.addEventListener('resize', resize);

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, [enabled]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: -1 }}
    />
  );
};

export default SakuraBackground;
