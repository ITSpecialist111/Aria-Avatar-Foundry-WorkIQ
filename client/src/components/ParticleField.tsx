import { useRef, useEffect } from 'react';

interface ParticleFieldProps {
  isSpeaking: boolean;
  isToolCallActive: boolean;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  drift: number;
}

const PARTICLE_COUNT = 35;

export function ParticleField({ isSpeaking, isToolCallActive }: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize particles
    if (particlesRef.current.length === 0) {
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.3 + 0.1,
        opacity: Math.random() * 0.4 + 0.1,
        drift: (Math.random() - 0.5) * 0.2,
      }));
    }

    const resize = () => {
      canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
      canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
    };

    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const speedMult = isToolCallActive ? 2.5 : isSpeaking ? 1.5 : 1;
      const opacityMult = isToolCallActive ? 1.5 : isSpeaking ? 1.2 : 1;

      particlesRef.current.forEach(p => {
        // Move upward
        p.y -= (p.speed * speedMult * 0.001);
        p.x += p.drift * 0.001;

        // Wrap
        if (p.y < -0.05) {
          p.y = 1.05;
          p.x = Math.random();
        }
        if (p.x < -0.05) p.x = 1.05;
        if (p.x > 1.05) p.x = -0.05;

        const px = p.x * w;
        const py = p.y * h;
        const alpha = Math.min(p.opacity * opacityMult, 0.6);

        ctx.beginPath();
        ctx.arc(px, py, p.size * (window.devicePixelRatio || 1), 0, Math.PI * 2);
        ctx.fillStyle = isToolCallActive
          ? `rgba(245, 158, 11, ${alpha})`
          : `rgba(147, 197, 253, ${alpha})`;
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isSpeaking, isToolCallActive]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
