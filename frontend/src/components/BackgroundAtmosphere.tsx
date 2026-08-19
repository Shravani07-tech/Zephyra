import React, { useEffect, useRef } from "react";

interface BackgroundAtmosphereProps {
  status?: string;
  isHistoryOpen?: boolean;
  isSystemOpen?: boolean;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  radius: number;
  angle: number;
  size: number;
  parallax: number;
  opacity: number;
  rotationSpeed: number;
  speedZ: number;
  isTeal: boolean;
  isForeground: boolean;
  hasPrev: boolean;
}

export const BackgroundAtmosphere: React.FC<BackgroundAtmosphereProps> = ({
  status = "Standby",
  isHistoryOpen = false,
  isSystemOpen = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef(status);
  const isHistoryOpenRef = useRef(isHistoryOpen);
  const isSystemOpenRef = useRef(isSystemOpen);

  // Sync props to refs to prevent canvas teardown on render updates
  useEffect(() => {
    statusRef.current = status;
    isHistoryOpenRef.current = isHistoryOpen;
    isSystemOpenRef.current = isSystemOpen;
  }, [status, isHistoryOpen, isSystemOpen]);

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

    // Coordinate states for pointer-based parallax
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      targetMouseY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    };

    if (!prefersReducedMotion && window.innerWidth >= 768) {
      window.addEventListener("mousemove", handleMouseMove);
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    // Initialize 3D particles (110 particles total for ideal density)
    const particleCount = 110;
    const particles: Particle[] = [];
    const fov = 400; // Focal length perspective config

    for (let i = 0; i < particleCount; i++) {
      const z = Math.random() * 600 - 50; // Random depth coordinate
      let baseOpacity = 0;
      let parallax = 0;
      let baseSize = 0;
      let speedZ = 0;
      let isForeground = false;

      // Classify into three highly distinguishable depth layers
      if (z > 300) {
        // Distant (tiny, extremely dim, slow)
        baseOpacity = Math.random() * 0.04 + 0.01;
        parallax = 6;
        baseSize = Math.random() * 0.5 + 0.2;
        speedZ = Math.random() * 0.08 + 0.03;
      } else if (z > 100) {
        // Midground (moderate size, slightly brighter, normal speed)
        baseOpacity = Math.random() * 0.1 + 0.04;
        parallax = 22;
        baseSize = Math.random() * 0.9 + 0.5;
        speedZ = Math.random() * 0.4 + 0.15;
      } else {
        // Foreground (larger, sparse, noticeable perspective motion & trails)
        baseOpacity = Math.random() * 0.18 + 0.1;
        parallax = 48;
        baseSize = Math.random() * 1.5 + 0.9;
        speedZ = Math.random() * 1.6 + 0.8;
        isForeground = true;
      }

      // Arrange 75% of particles directly along computational concentric orbits
      const onOrbit = Math.random() < 0.75;
      let radius = Math.random() * 320 + 40;
      
      if (onOrbit) {
        const orbitLevels = [60, 115, 175, 235, 305, 380, 460, 550];
        const selectedLevel = orbitLevels[Math.floor(Math.random() * orbitLevels.length)];
        radius = selectedLevel + (Math.random() * 8 - 4);
      }

      const angle = Math.random() * Math.PI * 2;
      const isTeal = Math.random() < 0.45; // 45% accented particles

      particles.push({
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        z,
        radius,
        angle,
        size: baseSize,
        parallax,
        opacity: baseOpacity,
        rotationSpeed: (Math.random() * 0.0005 + 0.00015) * (Math.random() < 0.5 ? 1 : -1),
        speedZ,
        isTeal,
        isForeground,
        hasPrev: false,
      });
    }

    // Dynamic core coordinates with linear interpolation
    let currentCenterX = width / 2;
    let currentCenterY = height / 2;
    let lastCheckTime = 0;

    let targetCenterX = width / 2;
    let targetCenterY = height / 2;

    // Animation Loop
    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const activeStatus = statusRef.current;

      // 1. Throttled DOM inspection (every 15 frames / 250ms) to center the core behind the greeting
      const now = Date.now();
      if (now - lastCheckTime > 250) {
        lastCheckTime = now;
        const coreElement = document.querySelector('[aria-label*="voice connection"]');
        if (coreElement) {
          const rect = coreElement.getBoundingClientRect();
          targetCenterX = rect.left + rect.width / 2;
          targetCenterY = rect.top + rect.height / 2;
        } else {
          // Fallback calculation: workspace main content center
          const sidebarLeft = (isHistoryOpenRef.current && window.innerWidth >= 768) ? 288 : 0;
          const sidebarRight = (isSystemOpenRef.current && window.innerWidth >= 768) ? 288 : 0;
          const workspaceWidth = width - sidebarLeft - sidebarRight;
          targetCenterX = sidebarLeft + workspaceWidth / 2;
          targetCenterY = 72 + (height - 72 - 140) / 2;
        }
      }

      // Smoothly slide orbital center
      currentCenterX += (targetCenterX - currentCenterX) * 0.08;
      currentCenterY += (targetCenterY - currentCenterY) * 0.08;

      // Determine state-based multipliers
      let speedMultiplier = 1.0;
      let orbitIntensity = 0.016;
      let rotationMultiplier = 1.0;

      if (activeStatus === "Listening") {
        speedMultiplier = 1.3;
        orbitIntensity = 0.03;
      } else if (activeStatus === "Thinking") {
        speedMultiplier = 1.5;
        rotationMultiplier = 2.2;
        orbitIntensity = 0.024;
      } else if (activeStatus === "Processing") {
        speedMultiplier = 2.5;
        orbitIntensity = 0.028;
      } else if (activeStatus === "Speaking") {
        speedMultiplier = 1.2;
        orbitIntensity = 0.035;
      } else {
        // Standby
        speedMultiplier = 0.7;
        orbitIntensity = 0.012;
      }

      // Smoothly interpolate pointer offsets
      if (!prefersReducedMotion) {
        currentMouseX += (targetMouseX - currentMouseX) * 0.04;
        currentMouseY += (targetMouseY - currentMouseY) * 0.04;
      } else {
        currentMouseX = 0;
        currentMouseY = 0;
      }

      // 2. Render background teal radial glow (breathing subtly)
      const breath = Math.sin(Date.now() * 0.003) * 0.06;
      const glowScale = Math.min(width, height) * 0.65;
      const nebulaGlow = ctx.createRadialGradient(
        currentCenterX,
        currentCenterY,
        0,
        currentCenterX,
        currentCenterY,
        glowScale
      );
      
      const nebAlpha = orbitIntensity + (activeStatus === "Speaking" ? Math.sin(Date.now() * 0.006) * 0.01 + 0.01 : breath * 0.05 + 0.05);
      nebulaGlow.addColorStop(0, `rgba(0, 201, 167, ${nebAlpha * 2.2})`);
      nebulaGlow.addColorStop(0.4, `rgba(0, 100, 150, ${nebAlpha * 0.6})`);
      nebulaGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = nebulaGlow;
      ctx.fillRect(0, 0, width, height);

      // 3. Render Concentric Orbital Rings (8 rings total with depth opacity hierarchy)
      const orbitLevels = [60, 115, 175, 235, 305, 380, 460, 550];
      ctx.lineWidth = 0.8;

      orbitLevels.forEach((level, index) => {
        const radiusX = level;
        const radiusY = level * 0.52; // Vertical perspective compression (flat angle)

        ctx.beginPath();
        ctx.ellipse(currentCenterX, currentCenterY, radiusX, radiusY, 0, 0, Math.PI * 2);
        
        // Depth opacity distribution: inner orbits are cleaner/stronger; outer are very dim
        let ringOpacityFactor = 0.2;
        if (index <= 1) ringOpacityFactor = 1.3; // Inner
        else if (index <= 4) ringOpacityFactor = 0.7; // Middle
        else ringOpacityFactor = 0.25; // Outer

        const finalRingAlpha = orbitIntensity * ringOpacityFactor * (0.85 + Math.sin(Date.now() * 0.0018 + index) * 0.15);
        ctx.strokeStyle = `rgba(0, 201, 167, ${finalRingAlpha})`;
        ctx.stroke();
      });

      // 4. Render central intelligence core node (luminous radial dot)
      const coreBreath = 1 + (activeStatus === "Speaking" ? Math.sin(Date.now() * 0.008) * 0.1 : Math.sin(Date.now() * 0.003) * 0.05);
      const coreSize = 10 * coreBreath;
      const coreGlow = ctx.createRadialGradient(
        currentCenterX,
        currentCenterY,
        1,
        currentCenterX,
        currentCenterY,
        coreSize
      );
      coreGlow.addColorStop(0, "rgba(0, 255, 210, 0.95)");
      coreGlow.addColorStop(0.3, "rgba(0, 201, 167, 0.45)");
      coreGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(currentCenterX, currentCenterY, coreSize, 0, Math.PI * 2);
      ctx.fill();

      // 5. Update and render 3D particles with perspective projection
      particles.forEach((p) => {
        let prevScreenX = 0;
        let prevScreenY = 0;

        if (p.hasPrev) {
          const prevScale = fov / p.z;
          prevScreenX = currentCenterX + p.x * prevScale + currentMouseX * p.parallax;
          prevScreenY = currentCenterY + p.y * prevScale * 0.52 + currentMouseY * p.parallax * 0.52;
        }

        if (!prefersReducedMotion) {
          // Physics: subtract depth coordinates to zoom inward
          p.z -= p.speedZ * speedMultiplier;
          
          // Rotation speed scale adjustments
          p.angle += p.rotationSpeed * rotationMultiplier;
          p.x = p.radius * Math.cos(p.angle);
          p.y = p.radius * Math.sin(p.angle);
        }

        // Recycle particle to deep background once it passes behind viewer screen plane
        if (p.z <= 15) {
          p.z = Math.random() * 200 + 400; // Far z boundary
          const newAngle = Math.random() * Math.PI * 2;
          const newRadius = Math.random() * 320 + 40;
          p.x = newRadius * Math.cos(newAngle);
          p.y = newRadius * Math.sin(newAngle);
          p.angle = newAngle;
          p.radius = newRadius;
          p.hasPrev = false;
          return;
        }

        // Perspective Projection calculation
        const scale = fov / p.z;
        const projectedX = currentCenterX + p.x * scale + currentMouseX * p.parallax;
        const projectedY = currentCenterY + p.y * scale * 0.52 + currentMouseY * p.parallax * 0.52;

        // Skip drawing if pushed fully off-screen
        if (projectedX < 0 || projectedX > width || projectedY < 0 || projectedY > height) {
          p.hasPrev = false;
          return;
        }

        // Dynamic twinkle/glow animation opacity
        const twinkle = Math.sin(Date.now() * 0.003 + p.z) * 0.35 + 0.65;
        const finalOpacity = p.opacity * twinkle;

        // Foreground trails vs standard circular particles
        if (p.isForeground && p.hasPrev && !prefersReducedMotion) {
          ctx.beginPath();
          ctx.lineWidth = Math.min(1.3, p.size * scale * 0.45);
          ctx.strokeStyle = p.isTeal 
            ? `rgba(0, 201, 167, ${finalOpacity * 1.5})` 
            : `rgba(240, 244, 255, ${finalOpacity * 0.9})`;
          
          ctx.moveTo(prevScreenX, prevScreenY);
          ctx.lineTo(projectedX, projectedY);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.fillStyle = p.isTeal 
            ? `rgba(0, 201, 167, ${finalOpacity * 1.5})` 
            : `rgba(240, 244, 255, ${finalOpacity * 0.8})`;
          
          ctx.arc(projectedX, projectedY, p.size * scale, 0, Math.PI * 2);
          ctx.fill();
        }

        p.hasPrev = true;
      });

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
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
