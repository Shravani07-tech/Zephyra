import React, { useEffect, useRef } from "react";

export const BackgroundAtmosphere: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Detect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Initialize particles
    const particleCount = 45;
    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.2 + 0.4, // micro points
        speedX: (Math.random() - 0.5) * 0.12,
        speedY: (Math.random() - 0.5) * 0.12,
        opacity: Math.random() * 0.08 + 0.03, // extremely low visibility
      });
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    // Animation Loop
    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw faint technical orbit traces in center
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.strokeStyle = "rgba(0, 201, 167, 0.02)"; // very low opacity
      ctx.lineWidth = 1;
      
      // Orbit 1
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.min(width, height) * 0.35, 0, Math.PI * 2);
      ctx.stroke();

      // Orbit 2
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.min(width, height) * 0.22, 0, Math.PI * 2);
      ctx.stroke();

      // Draw particle nodes
      particles.forEach((p) => {
        ctx.fillStyle = `rgba(240, 244, 255, ${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (!prefersReducedMotion) {
          // Update position
          p.x += p.speedX;
          p.y += p.speedY;

          // Boundary wrapping
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;
        }
      });

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{ mixBlendMode: "screen" }}
    />
  );
};
