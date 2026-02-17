import React, { useEffect, useRef } from 'react';

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
}

const PETAL_COUNT = 45;
const COLORS = [
  'rgba(255, 130, 160, 0.9)',
  'rgba(255, 105, 145, 0.85)',
  'rgba(255, 150, 175, 0.8)',
  'rgba(252, 120, 155, 0.85)',
  'rgba(255, 80, 130, 0.75)',
  'rgba(255, 170, 190, 0.9)',
];

function createPetal(canvasWidth: number, canvasHeight: number, startFromTop = false): Petal {
  return {
    x: Math.random() * canvasWidth,
    y: startFromTop ? -20 - Math.random() * 40 : Math.random() * canvasHeight,
    size: 10 + Math.random() * 16,
    speedY: 0.3 + Math.random() * 0.8,
    speedX: -0.2 + Math.random() * 0.4,
    rotation: Math.random() * 360,
    rotationSpeed: -1 + Math.random() * 2,
    opacity: 0.6 + Math.random() * 0.4,
    swingAmplitude: 20 + Math.random() * 40,
    swingSpeed: 0.01 + Math.random() * 0.02,
    phase: Math.random() * Math.PI * 2,
  };
}

function drawPetal(ctx: CanvasRenderingContext2D, petal: Petal, colorIndex: number) {
  ctx.save();
  ctx.translate(petal.x, petal.y);
  ctx.rotate((petal.rotation * Math.PI) / 180);
  ctx.globalAlpha = petal.opacity;

  const s = petal.size;
  ctx.fillStyle = COLORS[colorIndex % COLORS.length];

  // Draw a petal shape
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(s * 0.4, -s * 0.3, s * 0.8, -s * 0.15, s, 0);
  ctx.bezierCurveTo(s * 0.8, s * 0.15, s * 0.4, s * 0.3, 0, 0);
  ctx.fill();

  // Second layer for depth
  ctx.fillStyle = COLORS[(colorIndex + 1) % COLORS.length];
  ctx.globalAlpha = petal.opacity * 0.5;
  ctx.beginPath();
  ctx.moveTo(s * 0.1, 0);
  ctx.bezierCurveTo(s * 0.4, -s * 0.15, s * 0.7, -s * 0.08, s * 0.85, 0);
  ctx.bezierCurveTo(s * 0.7, s * 0.08, s * 0.4, s * 0.15, s * 0.1, 0);
  ctx.fill();

  ctx.restore();
}

const SakuraBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const petalsRef = useRef<Petal[]>([]);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    // Respect prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize petals
    petalsRef.current = Array.from({ length: PETAL_COUNT }, () =>
      createPetal(canvas.width, canvas.height, false)
    );

    const animate = () => {
      if (!canvas || !ctx) return;
      timeRef.current += 1;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      petalsRef.current.forEach((petal, i) => {
        // Update position
        petal.y += petal.speedY;
        petal.x += petal.speedX + Math.sin(timeRef.current * petal.swingSpeed + petal.phase) * 0.5;
        petal.rotation += petal.rotationSpeed;

        // Reset petal if out of bounds
        if (petal.y > canvas.height + 30 || petal.x < -30 || petal.x > canvas.width + 30) {
          petalsRef.current[i] = createPetal(canvas.width, canvas.height, true);
        }

        drawPetal(ctx, petal, i);
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[5]"
      style={{ opacity: 1 }}
    />
  );
};

export default SakuraBackground;
