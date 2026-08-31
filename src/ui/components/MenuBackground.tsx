import { useEffect, useRef } from 'react';
import { GameStateManager } from '../../game/state/GameState.ts';

interface MenuBackgroundProps {
  accentColor?: string;
  secondaryColor?: string;
  density?: 'normal' | 'high' | 'minimal';
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  maxOpacity: number;
  shape: 'square' | 'triangle' | 'diamond' | 'circle';
  rotation: number;
  rotSpeed: number;
  color: string;
}

/**
 * MenuBackground: Premium live animated synth & geometric particle background for menus.
 * Features drifting perspective cyber grid, ambient glowing orbs, floating geometric motes,
 * and slow light rays. Designed to remain ultra-smooth (60 FPS) and non-distracting.
 */
export function MenuBackground({
  accentColor = '#00E5FF',
  secondaryColor = '#BF5AF2',
}: MenuBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const colorsRef = useRef({ accent: accentColor, secondary: secondaryColor });

  // Update color refs without restarting animation loop
  useEffect(() => {
    colorsRef.current = { accent: accentColor, secondary: secondaryColor };
  }, [accentColor, secondaryColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;

    const settings = GameStateManager.getInstance().getSettings();
    const isReducedMotion = settings.reducedMotion;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Generate floating geometric particles
    const particleCount = isReducedMotion ? 10 : 28;
    const particles: Particle[] = [];

    const shapes: ('square' | 'triangle' | 'diamond' | 'circle')[] = [
      'square',
      'triangle',
      'diamond',
      'circle',
    ];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 3 + Math.random() * 8,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: -(0.2 + Math.random() * 0.45),
        opacity: Math.random() * 0.3,
        maxOpacity: 0.15 + Math.random() * 0.2,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.015,
        color: Math.random() > 0.4 ? colorsRef.current.accent : colorsRef.current.secondary,
      });
    }

    let gridOffset = 0;
    let time = 0;

    const render = () => {
      time += 0.016;
      gridOffset = (gridOffset + 0.3) % 60;
      const currentAccent = colorsRef.current.accent;
      const currentSecondary = colorsRef.current.secondary;

      // 1. Deep Space Canvas Base
      ctx.fillStyle = '#070A12';
      ctx.fillRect(0, 0, width, height);

      // 2. Ambient Volumetric Glow Orbs
      const glow1 = ctx.createRadialGradient(
        width * 0.3 + Math.sin(time * 0.5) * 40,
        height * 0.3 + Math.cos(time * 0.4) * 30,
        10,
        width * 0.3,
        height * 0.3,
        width * 0.5
      );
      glow1.addColorStop(0, `${currentAccent}18`);
      glow1.addColorStop(0.5, `${currentAccent}05`);
      glow1.addColorStop(1, 'transparent');
      ctx.fillStyle = glow1;
      ctx.fillRect(0, 0, width, height);

      const glow2 = ctx.createRadialGradient(
        width * 0.75 + Math.cos(time * 0.4) * 40,
        height * 0.7 + Math.sin(time * 0.6) * 30,
        10,
        width * 0.75,
        height * 0.7,
        width * 0.45
      );
      glow2.addColorStop(0, `${currentSecondary}15`);
      glow2.addColorStop(0.6, `${currentSecondary}04`);
      glow2.addColorStop(1, 'transparent');
      ctx.fillStyle = glow2;
      ctx.fillRect(0, 0, width, height);

      // 3. Cyber Isometric / Orthogonal Grid Lines
      const gridSize = 56;
      ctx.lineWidth = 1;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.beginPath();
      // Vertical lines
      for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      // Drifting Horizontal lines
      for (let y = gridOffset; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Subtle pulse on selected grid intersections
      const pulseOpacity = (Math.sin(time * 2) + 1) * 0.5;
      ctx.fillStyle = `${currentAccent}${Math.floor(pulseOpacity * 18).toString(16).padStart(2, '0')}`;
      for (let x = gridSize * 2; x < width; x += gridSize * 4) {
        for (let y = (gridOffset + gridSize * 2) % (gridSize * 4); y < height; y += gridSize * 4) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. Floating Geometric Ambient Particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!isReducedMotion) {
          p.x += p.speedX;
          p.y += p.speedY;
          p.rotation += p.rotSpeed;

          // Wrap edges smoothly
          if (p.y < -30) {
            p.y = height + 20;
            p.x = Math.random() * width;
            p.color = Math.random() > 0.4 ? currentAccent : currentSecondary;
          }
          if (p.x < -30) p.x = width + 20;
          if (p.x > width + 30) p.x = -20;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.strokeStyle = p.color;
        ctx.fillStyle = `${p.color}15`;
        ctx.globalAlpha = p.maxOpacity;
        ctx.lineWidth = 1;

        if (p.shape === 'square') {
          ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else if (p.shape === 'diamond') {
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.7, 0);
          ctx.lineTo(0, p.size);
          ctx.lineTo(-p.size * 0.7, 0);
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
        } else if (p.shape === 'triangle') {
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.86, p.size * 0.5);
          ctx.lineTo(-p.size * 0.86, p.size * 0.5);
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fill();
        }

        ctx.restore();
      }

      // 5. Cinematic Edge Vignette
      const vignette = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.4,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.8
      );
      vignette.addColorStop(0, 'transparent');
      vignette.addColorStop(1, 'rgba(3, 5, 9, 0.75)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      id="menu-live-background-canvas"
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none"
    />
  );
}
