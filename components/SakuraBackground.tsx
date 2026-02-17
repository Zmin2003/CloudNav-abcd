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
// Real Somei Yoshino cherry blossoms: very pale pink to white

const PALETTE = [
  { edge: '#e8789a', mid: '#f5a8c0', base: '#fde0e8', vein: '#d06888' },
  { edge: '#e06090', mid: '#f098b5', base: '#fcd8e4', vein: '#c85080' },
  { edge: '#ea80a0', mid: '#f5b0c8', base: '#fce4ec', vein: '#d87098' },
  { edge: '#d87095', mid: '#f0a0b8', base: '#fad8e2', vein: '#c06085' },
  { edge: '#f090a8', mid: '#f8b8cc', base: '#fee8ef', vein: '#e07898' },
];

const PETAL_COUNT = 38;

// ==================== Create ====================

function create(w: number, h: number, top: boolean): Petal {
  return {
    x: Math.random() * w,
    y: top ? -(20 + Math.random() * 50) : Math.random() * h,
    size: 10 + Math.random() * 14,
    speedY: 0.2 + Math.random() * 0.55,
    speedX: -0.1 + Math.random() * 0.25,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (-0.4 + Math.random() * 0.8) * 0.02,
    opacity: 0.65 + Math.random() * 0.35,
    phase: Math.random() * Math.PI * 2,
    swingFreq: 0.006 + Math.random() * 0.012,
    swingAmp: 0.4 + Math.random() * 0.8,
    flipAngle: Math.random() * Math.PI * 2,
    flipSpeed: 0.008 + Math.random() * 0.018,
    curlAngle: Math.random() * Math.PI * 2,
    curlSpeed: 0.005 + Math.random() * 0.012,
    colorIdx: Math.floor(Math.random() * PALETTE.length),
    variant: Math.floor(Math.random() * 4),
  };
}

// ==================== Draw ====================

function drawPetal(ctx: CanvasRenderingContext2D, p: Petal, t: number) {
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

  // Soft glow
  ctx.shadowColor = 'rgba(255,180,200,0.25)';
  ctx.shadowBlur = s * 0.6;
  ctx.shadowOffsetY = s * 0.1;

  // Main petal gradient: stem(white) → tip(pink)
  const grad = ctx.createLinearGradient(0, 0, s, 0);
  grad.addColorStop(0, c.base);
  grad.addColorStop(0.3, c.base);
  grad.addColorStop(0.65, c.mid);
  grad.addColorStop(1, c.edge);
  ctx.fillStyle = grad;

  // Petal shape: narrow stem → wide body → notched heart tip
  ctx.beginPath();
  ctx.moveTo(0, 0);
  // Upper edge
  ctx.bezierCurveTo(s * 0.2, -bodyW * 0.3, s * 0.45, -bodyW, s * 0.75, -bodyW * 0.85);
  ctx.quadraticCurveTo(s * 0.92, -bodyW * 0.35, s, -notchDepth);
  // Heart notch
  ctx.quadraticCurveTo(s * 0.96, 0, s, notchDepth);
  // Lower edge
  ctx.quadraticCurveTo(s * 0.92, bodyW * 0.35, s * 0.75, bodyW * 0.85);
  ctx.bezierCurveTo(s * 0.45, bodyW, s * 0.2, bodyW * 0.3, 0, 0);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Veins
  ctx.globalAlpha = p.opacity * 0.2;
  ctx.strokeStyle = c.vein;
  ctx.lineWidth = 0.4;
  ctx.lineCap = 'round';

  // Center vein
  ctx.beginPath();
  ctx.moveTo(s * 0.05, 0);
  ctx.quadraticCurveTo(s * 0.5, 0, s * 0.92, 0);
  ctx.stroke();

  // Side veins
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
    ctx.globalAlpha = p.opacity * Math.abs(curlVal) * 0.6;
    const side = curlVal > 0 ? -1 : 1;
    const curlGrad = ctx.createLinearGradient(s * 0.3, 0, s * 0.9, side * bodyW * -0.6);
    curlGrad.addColorStop(0, 'rgba(255,255,255,0)');
    curlGrad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
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

  // Edge rim light
  ctx.globalAlpha = p.opacity * 0.1;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(s * 0.5, -bodyW * 0.95);
  ctx.quadraticCurveTo(s * 0.85, -bodyW * 0.5, s, -notchDepth);
  ctx.stroke();

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

  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const w = () => window.innerWidth;
    const h = () => window.innerHeight;

    petalsRef.current = Array.from({ length: PETAL_COUNT }, () => create(w(), h(), false));

    const animate = () => {
      tRef.current += 1;
      const t = tRef.current;
      ctx.clearRect(0, 0, w(), h());

      for (let i = 0; i < petalsRef.current.length; i++) {
        const p = petalsRef.current[i];

        // Natural movement
        const drift = Math.sin(t * p.swingFreq + p.phase) * p.swingAmp;
        const gustX = Math.sin(t * 0.002 + p.phase * 2) * 0.15;

        p.x += p.speedX + drift + gustX;
        p.y += p.speedY + Math.cos(t * p.swingFreq * 0.7 + p.phase) * 0.08;
        p.rot += p.rotSpeed + drift * 0.005;
        p.flipAngle += p.flipSpeed;
        p.curlAngle += p.curlSpeed;

        if (p.y > h() + 50 || p.x < -50 || p.x > w() + 50) {
          petalsRef.current[i] = create(w(), h(), true);
          continue;
        }

        drawPetal(ctx, p, t);
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, [enabled]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[5]"
    />
  );
};

export default SakuraBackground;
