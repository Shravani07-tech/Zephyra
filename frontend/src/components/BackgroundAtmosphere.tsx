import React, { useEffect, useRef } from "react";

interface BackgroundAtmosphereProps {
  status?: string;
  isHistoryOpen?: boolean;
  isSystemOpen?: boolean;
  volume?: number;
  isListening?: boolean;
}

interface CosmicParticle {
  x: number;
  y: number;
  z: number;
  size: number;
  speed: number;
  speedZ: number;
  opacity: number;
  colorPhase: number;
  trailLength: number;
  type: "bg" | "mid" | "fg" | "orbit" | "core" | "column";
  orbitIndex?: number;
  theta?: number;
  radius?: number;
  angle?: number;
  colIndex?: number;
  isVioletOption?: boolean;
}

interface PulseWave {
  radius: number;
  maxRadius: number;
  opacity: number;
  speed: number;
}

interface StateConfig {
  speedMultiplier: number;
  rotationMultiplier: number;
  orbitIntensity: number;
  currentOrbitOpacity: number;
  targetColor: { r: number; g: number; b: number };
}

interface CoreSpark {
  angle: number;
  radius: number;
  speed: number;
  size: number;
}

interface OutwardSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface HazeCloud {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  phase: number;
  speed: number;
}

// V3.3 Cinematic Visual State Configuration (Visibly Luminous Energy Contrast)
const STATE_CONFIGS: Record<string, StateConfig> = {
  Standby: {
    speedMultiplier: 0.28,
    rotationMultiplier: 0.35,
    orbitIntensity: 0.014,
    currentOrbitOpacity: 0.50,
    targetColor: { r: 0, g: 140, b: 245 }, // deep navy
  },
  Listening: {
    speedMultiplier: 0.35,
    rotationMultiplier: 0.45,
    orbitIntensity: 0.016,
    currentOrbitOpacity: 0.60,
    targetColor: { r: 0, g: 200, b: 255 }, // electric cyan
  },
  Thinking: {
    speedMultiplier: 0.48,
    rotationMultiplier: 0.62,
    orbitIntensity: 0.020,
    currentOrbitOpacity: 0.70,
    targetColor: { r: 100, g: 225, b: 255 }, // white-cyan
  },
  Processing: {
    speedMultiplier: 0.48, // identical to Thinking to prevent double-bump animation re-triggering
    rotationMultiplier: 0.62, // identical to Thinking to prevent double-bump animation re-triggering
    orbitIntensity: 0.020, // identical to Thinking to prevent double-bump animation re-triggering
    currentOrbitOpacity: 0.70, // identical to Thinking to prevent double-bump animation re-triggering
    targetColor: { r: 100, g: 225, b: 255 }, // intense electric white-cyan highlights
  },
  Speaking: {
    speedMultiplier: 0.32,
    rotationMultiplier: 0.40,
    orbitIntensity: 0.015,
    currentOrbitOpacity: 0.55,
    targetColor: { r: 0, g: 150, b: 245 }, // cyan-blue breathing
  },
};

export const BackgroundAtmosphere: React.FC<BackgroundAtmosphereProps> = ({
  status = "Standby",
  isHistoryOpen = false,
  isSystemOpen = false,
  volume = 0,
  isListening = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef(status);
  const isHistoryOpenRef = useRef(isHistoryOpen);
  const isSystemOpenRef = useRef(isSystemOpen);
  const volumeRef = useRef(volume);
  const isListeningRef = useRef(isListening);

  // Sync state values to refs
  useEffect(() => {
    statusRef.current = status;
    isHistoryOpenRef.current = isHistoryOpen;
    isSystemOpenRef.current = isSystemOpen;
    volumeRef.current = volume;
    isListeningRef.current = isListening;
  }, [status, isHistoryOpen, isSystemOpen, volume, isListening]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Parallax mouse offsets
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      targetMouseY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    };

    if (!prefersReducedMotion) {
      window.addEventListener("mousemove", handleMouseMove);
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    const fov = 400;

    // Define 7 Oblique Orbits
    const orbitDefinitions = [
      { rxFactor: 0.65, ryFactor: 0.30, tiltX: 55 * Math.PI / 180, tiltY: 20 * Math.PI / 180, baseRotateZ: 0, orbitSpeed: 0.0003, type: "primary" },
      { rxFactor: 0.58, ryFactor: 0.25, tiltX: -45 * Math.PI / 180, tiltY: 35 * Math.PI / 180, baseRotateZ: Math.PI / 4, orbitSpeed: -0.0004, type: "primary" },
      { rxFactor: 0.62, ryFactor: 0.24, tiltX: 30 * Math.PI / 180, tiltY: -40 * Math.PI / 180, baseRotateZ: -Math.PI / 3, orbitSpeed: 0.00025, type: "secondary" },
      { rxFactor: 0.52, ryFactor: 0.22, tiltX: 75 * Math.PI / 180, tiltY: 10 * Math.PI / 180, baseRotateZ: Math.PI / 2, orbitSpeed: -0.0002, type: "secondary" },
      { rxFactor: 0.75, ryFactor: 0.32, tiltX: -15 * Math.PI / 180, tiltY: -25 * Math.PI / 180, baseRotateZ: Math.PI / 6, orbitSpeed: 0.00035, type: "tertiary" },
      { rxFactor: 0.70, ryFactor: 0.28, tiltX: 40 * Math.PI / 180, tiltY: 45 * Math.PI / 180, baseRotateZ: -Math.PI / 6, orbitSpeed: -0.0003, type: "tertiary" },
      { rxFactor: 0.82, ryFactor: 0.35, tiltX: 20 * Math.PI / 180, tiltY: -15 * Math.PI / 180, baseRotateZ: Math.PI / 5, orbitSpeed: 0.00015, type: "tertiary" },
    ];

    // Initialize Particles
    const cosmicParticles: CosmicParticle[] = [];

    // A. DISTANT: 340 very tiny dim stars, slow movement
    for (let i = 0; i < 340; i++) {
      cosmicParticles.push({
        x: Math.random() * 2000 - 1000,
        y: Math.random() * 2000 - 1000,
        z: Math.random() * 600 + 100,
        size: Math.random() * 0.55 + 0.2,
        speed: 0,
        speedZ: Math.random() * 0.035 + 0.012,
        opacity: Math.random() * 0.08 + 0.04,
        colorPhase: Math.random() * Math.PI * 2,
        trailLength: 0,
        type: "bg",
        isVioletOption: Math.random() < 0.20,
      });
    }

    // B. MID: 200 cyan/blue stars, moderate brightness, twinkles
    for (let i = 0; i < 200; i++) {
      cosmicParticles.push({
        x: Math.random() * 1600 - 800,
        y: Math.random() * 1600 - 800,
        z: Math.random() * 400 + 50,
        size: Math.random() * 0.95 + 0.45,
        speed: 0,
        speedZ: Math.random() * 0.18 + 0.05,
        opacity: Math.random() * 0.22 + 0.08,
        colorPhase: Math.random() * Math.PI * 2,
        trailLength: 0,
        type: "mid",
        isVioletOption: Math.random() < 0.20,
      });
    }

    // C. NEAR: 55 bright cyan/white particles, soft glow, short trails
    for (let i = 0; i < 55; i++) {
      cosmicParticles.push({
        x: Math.random() * 1200 - 600,
        y: Math.random() * 1200 - 600,
        z: Math.random() * 200 + 20,
        size: Math.random() * 1.5 + 0.9,
        speed: 0,
        speedZ: Math.random() * 0.80 + 0.25,
        opacity: Math.random() * 0.35 + 0.12,
        colorPhase: Math.random() * Math.PI * 2,
        trailLength: 5,
        type: "fg",
        isVioletOption: Math.random() < 0.20,
      });
    }

    // D. ENERGY: Particles travelling along orbits (16 per orbit)
    for (let o = 0; o < orbitDefinitions.length; o++) {
      const pCount = 16;
      for (let p = 0; p < pCount; p++) {
        cosmicParticles.push({
          x: 0,
          y: 0,
          z: 0,
          size: Math.random() * 0.85 + 0.65,
          speed: (Math.random() * 0.003 + 0.0032) * (Math.random() < 0.5 ? 1 : -1),
          speedZ: 0,
          opacity: Math.random() * 0.42 + 0.22,
          colorPhase: Math.random() * Math.PI * 2,
          trailLength: 5,
          type: "orbit",
          orbitIndex: o,
          theta: (p / pCount) * Math.PI * 2,
        });
      }
    }

    // E. Core Cluster Particles
    for (let i = 0; i < 30; i++) {
      cosmicParticles.push({
        x: 0,
        y: 0,
        z: 0,
        size: Math.random() * 0.95 + 0.45,
        speed: (Math.random() * 0.007 + 0.0045) * (Math.random() < 0.5 ? 1 : -1),
        speedZ: 0,
        opacity: Math.random() * 0.45 + 0.10,
        colorPhase: Math.random() * Math.PI * 2,
        trailLength: 0,
        type: "core",
        radius: Math.random() * 22 + 12,
        angle: Math.random() * Math.PI * 2,
        colIndex: i,
      });
    }

    // F. Polar Column Particles
    for (let i = 0; i < 12; i++) {
      cosmicParticles.push({
        x: 0,
        y: Math.random() * 320 - 160,
        z: 0,
        size: Math.random() * 0.85 + 0.45,
        speed: Math.random() * 0.80 + 0.75,
        speedZ: 0,
        opacity: Math.random() * 0.38 + 0.12,
        colorPhase: Math.random() * Math.PI * 2,
        trailLength: 0,
        type: "column",
        colIndex: i,
      });
    }

    // Tightly orbiting core sparks (radius 50 - 90px)
    const coreSparks: CoreSpark[] = [];
    for (let i = 0; i < 7; i++) {
      coreSparks.push({
        angle: Math.random() * Math.PI * 2,
        radius: Math.random() * 40 + 50,
        speed: (Math.random() * 0.018 + 0.009) * (Math.random() < 0.5 ? 1 : -1),
        size: Math.random() * 0.85 + 0.45,
      });
    }

    // Outward shooting sparks
    const outwardSparks: OutwardSpark[] = [];

    // Faint atmospheric haze clouds
    const hazeClouds: HazeCloud[] = [];
    for (let i = 0; i < 4; i++) {
      hazeClouds.push({
        x: Math.random() * 800 - 400,
        y: Math.random() * 800 - 400,
        radius: Math.random() * 200 + 200,
        opacity: Math.random() * 0.007 + 0.003,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.0012 + 0.0004,
      });
    }

    let currentCenterX = width / 2;
    let currentCenterY = height / 2;
    let targetCenterX = width / 2;
    let targetCenterY = height / 2;
    let lastCheckTime = 0;

    let currentOrbitSpeed = 0.0003;
    let currentParticleSpeed = 0.8;
    let currentFilamentSpeed = 0.015;
    let currentFilamentActivity = 1.0;
    let currentNucleusGlow = 1.0;
    let currentNucleusScale = 1.0;
    let currentOrbitOpacityFactor = 0.7;
    let currentRotationSpeed = 1.0;

    let primaryR = 0;
    let primaryG = 200;
    let primaryB = 255;

    let time = 0;
    const pulses: PulseWave[] = [];
    let pulseTimer = 0;
    let currentVolume = 0;
    let previousStatus = "Standby";

    const project3D = (
      x: number,
      y: number,
      z: number,
      tiltX: number,
      tiltY: number,
      rotateZ: number,
      cx: number,
      cy: number,
      fov: number
    ) => {
      const cosZ = Math.cos(rotateZ);
      const sinZ = Math.sin(rotateZ);
      const x1 = x * cosZ - y * sinZ;
      const y1 = x * sinZ + y * cosZ;

      const cosX = Math.cos(tiltX);
      const sinX = Math.sin(tiltX);
      const y2 = y1 * cosX - z * sinX;
      const z2 = y1 * sinX + z * cosX;

      const cosY = Math.cos(tiltY);
      const sinY = Math.sin(tiltY);
      const x3 = x1 * cosY + z2 * sinY;
      const z3 = -x1 * sinY + z2 * cosY;

      const scale = fov / (fov + z3);
      const parallax = z3 / fov;
      return {
        x: cx + x3 * scale,
        y: cy + y2 * scale,
        z: z3,
        scale,
        parallax,
      };
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const activeStatus = statusRef.current;

      // Handle Interruption signature
      if (previousStatus === "Speaking" && activeStatus === "Listening") {
        pulses.length = 0;
        outwardSparks.length = 0;
        currentVolume = 0;
        currentOrbitSpeed = 0.0003;
      }
      previousStatus = activeStatus;

      let targetVolume = volumeRef.current;
      if (activeStatus === "Speaking") {
        targetVolume = 0.16 + 0.12 * Math.sin(time * 0.22) * Math.cos(time * 0.08);
      }
      currentVolume += (targetVolume - currentVolume) * 0.15;

      // Aligned positions
      const now = Date.now();
      if (now - lastCheckTime > 200) {
        lastCheckTime = now;
        const micBtn = document.querySelector('[aria-label*="voice connection"]');
        if (micBtn) {
          const rect = micBtn.getBoundingClientRect();
          targetCenterX = rect.left + rect.width / 2;
          targetCenterY = rect.top + rect.height / 2;
        } else {
          const sidebarLeft = (isHistoryOpenRef.current && window.innerWidth >= 768) ? 288 : 0;
          const sidebarRight = (isSystemOpenRef.current && window.innerWidth >= 768) ? 288 : 0;
          const wsWidth = width - sidebarLeft - sidebarRight;
          targetCenterX = sidebarLeft + wsWidth / 2;
          targetCenterY = 72 + (height - 72 - 140) / 2;
        }
      }

      currentCenterX += (targetCenterX - currentCenterX) * 0.08;
      currentCenterY += (targetCenterY - currentCenterY) * 0.08;

      // Configurations
      const cfg = STATE_CONFIGS[activeStatus] || STATE_CONFIGS.Standby;

      let speedMultiplier = cfg.speedMultiplier;
      let rotationMultiplier = cfg.rotationMultiplier;
      let orbitIntensity = cfg.orbitIntensity;
      let currentOrbitOpacity = cfg.currentOrbitOpacity;
      let targetR = cfg.targetColor.r;
      let targetG = cfg.targetColor.g;
      let targetB = cfg.targetColor.b;

      if (activeStatus === "Listening") {
        speedMultiplier = 0.35 + currentVolume * 0.5;
        rotationMultiplier = 0.45 + currentVolume * 0.5;
        orbitIntensity = 0.016 + currentVolume * 0.01;
        currentOrbitOpacity = 0.60 + currentVolume * 0.15;
      } else if (activeStatus === "Processing") {
        // Slow, cinematic color shifting (approx. 26s period)
        const cycleTime = time * 0.004;
        targetR = Math.floor(100 + 40 * Math.sin(cycleTime));
        targetG = Math.floor(210 + 15 * Math.cos(cycleTime));
        targetB = 255;
      }

      // Asymmetric LERP factors for smooth cinematic transitions:
      // - Transitioning to higher energy (ramp up): ~800-1100ms (LERP_UP = 0.04)
      // - Transitioning back to lower energy (decay): ~1200-1500ms (LERP_DOWN = 0.025)
      const interpolate = (curr: number, target: number) => {
        const factor = target > curr ? 0.04 : 0.025;
        return curr + (target - curr) * factor;
      };

      currentOrbitSpeed = interpolate(currentOrbitSpeed, speedMultiplier * 0.0003);
      currentParticleSpeed = interpolate(currentParticleSpeed, speedMultiplier);
      currentFilamentSpeed = interpolate(currentFilamentSpeed, speedMultiplier * 0.015);
      currentFilamentActivity = interpolate(currentFilamentActivity, orbitIntensity * 120);
      currentNucleusGlow = interpolate(currentNucleusGlow, orbitIntensity * 40);
      currentNucleusScale = interpolate(currentNucleusScale, 1.0 + currentVolume * 0.25);
      currentOrbitOpacityFactor = interpolate(currentOrbitOpacityFactor, currentOrbitOpacity);
      currentRotationSpeed = interpolate(currentRotationSpeed, rotationMultiplier);

      primaryR = interpolate(primaryR, targetR);
      primaryG = interpolate(primaryG, targetG);
      primaryB = interpolate(primaryB, targetB);

      if (!prefersReducedMotion) {
        currentMouseX += (targetMouseX - currentMouseX) * 0.04;
        currentMouseY += (targetMouseY - currentMouseY) * 0.04;
        time += 1.0;
      } else {
        currentMouseX = 0;
        currentMouseY = 0;
      }

      // A. Deep Space background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, "#010307");
      bgGrad.addColorStop(0.3, "#02060B");
      bgGrad.addColorStop(0.7, "#03101C");
      bgGrad.addColorStop(1, "#061827");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // B. Haze clouds
      hazeClouds.forEach((cloud) => {
        cloud.phase += cloud.speed;
        const driftX = 30 * Math.sin(cloud.phase);
        const driftY = 20 * Math.cos(cloud.phase);
        const hx = currentCenterX + cloud.x + driftX + currentMouseX * 10;
        const hy = currentCenterY + cloud.y + driftY + currentMouseY * 10;

        const hazeGrad = ctx.createRadialGradient(hx, hy, 10, hx, hy, cloud.radius);
        const alpha = cloud.opacity * currentNucleusGlow;
        hazeGrad.addColorStop(0, `rgba(0, 140, 255, ${alpha})`);
        hazeGrad.addColorStop(0.6, `rgba(0, 64, 128, ${alpha * 0.35})`);
        hazeGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = hazeGrad;
        ctx.beginPath();
        ctx.arc(hx, hy, cloud.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // C. Concentric background mesh
      const concentricLevels = [60, 115, 175, 235, 305, 380, 460, 550];
      ctx.lineWidth = 0.8;
      concentricLevels.forEach((level, index) => {
        const radiusX = level;
        const radiusY = level * 0.52;
        ctx.beginPath();
        ctx.ellipse(currentCenterX, currentCenterY, radiusX, radiusY, 0, 0, Math.PI * 2);
        
        let rOpacity = 0.15;
        if (index <= 1) rOpacity = 0.45;
        else if (index <= 4) rOpacity = 0.25;

        const finalRingAlpha = orbitIntensity * rOpacity * (0.85 + Math.sin(Date.now() * 0.0018 + index) * 0.15);
        ctx.strokeStyle = `rgba(0, 140, 255, ${finalRingAlpha * 0.25})`;
        ctx.stroke();
      });

      // D. Draw 7 Giant Oblique Orbits with Large Curvatures & Flowing Energy Packets
      const baseSize = Math.min(width, height);
      orbitDefinitions.forEach((def, oIdx) => {
        const rx = baseSize * def.rxFactor;
        const ry = baseSize * def.ryFactor;
        const orbitAngle = def.baseRotateZ + time * def.orbitSpeed * (speedMultiplier * 1.5);
        const steps = 90;
        const filNoise = 5.0 * currentFilamentActivity;

        const getPoint = (theta: number, isFilament = false) => {
          // Curvature offsets
          const radiusOffset = 6 * Math.sin(3 * theta + oIdx * 1.5);
          const rx_curr = rx + radiusOffset;
          const ry_curr = ry + radiusOffset;

          let r_add = 0;
          if (isFilament) {
            r_add = filNoise * Math.sin(5 * theta + time * 0.035 + oIdx);
          }
          const xp = (rx_curr + r_add) * Math.cos(theta);
          const yp = (ry_curr + r_add) * Math.sin(theta);
          return project3D(xp, yp, 0, def.tiltX, def.tiltY, orbitAngle, currentCenterX, currentCenterY, fov);
        };

        let opacityMult = 1.0;
        let filamentMult = 0.7;
        let orbitLineWidth = 2.4; // Upscaled line widths

        if (def.type === "secondary") {
          opacityMult = 0.55;
          filamentMult = 0.4;
          orbitLineWidth = 1.6;
        } else if (def.type === "tertiary") {
          opacityMult = 0.22;
          filamentMult = 0.12;
          orbitLineWidth = 1.0;
        }

        // Draw segmented orbits to render moving energy packets
        let prev = getPoint(0);
        for (let s = 1; s <= steps; s++) {
          const theta = (s / steps) * Math.PI * 2;
          const curr = getPoint(theta);

          ctx.beginPath();
          ctx.moveTo(prev.x + currentMouseX * prev.parallax * 15, prev.y + currentMouseY * prev.parallax * 15);
          ctx.lineTo(curr.x + currentMouseX * curr.parallax * 15, curr.y + currentMouseY * curr.parallax * 15);

          const depthFactor = (150 - curr.z) / 300;
          // Luminous pathAlpha base values
          const pathAlpha = (0.05 + 0.32 * depthFactor) * currentOrbitOpacityFactor * opacityMult;

          // Energy wave packet modulation
          const packet = 0.55 + 0.45 * Math.sin(6 * theta - time * 0.05 + oIdx);
          const finalOpacity = pathAlpha * packet;

          ctx.strokeStyle = `rgba(0, 140, 255, ${finalOpacity * 0.45})`;
          ctx.lineWidth = orbitLineWidth * depthFactor;
          ctx.stroke();

          ctx.strokeStyle = `rgba(${Math.floor(primaryR + (255 - primaryR) * 0.75)}, ${Math.floor(primaryG + (255 - primaryG) * 0.75)}, 255, ${finalOpacity})`;
          ctx.lineWidth = (orbitLineWidth * 0.25) + (orbitLineWidth * 0.25) * depthFactor;
          ctx.stroke();

          prev = curr;
        }

        // Energy Filaments (wavy lines)
        let prevFil = getPoint(0, true);
        // Calmer, slower filament glow breathing instead of aggressive flicker
        const processingGlow = activeStatus === "Processing" ? (0.80 + 0.20 * Math.sin(time * 0.02 + oIdx)) : 1.0;

        for (let s = 1; s <= steps; s++) {
          const theta = (s / steps) * Math.PI * 2;
          const currFil = getPoint(theta, true);

          ctx.beginPath();
          ctx.moveTo(prevFil.x + currentMouseX * prevFil.parallax * 12, prevFil.y + currentMouseY * prevFil.parallax * 12);
          ctx.lineTo(currFil.x + currentMouseX * currFil.parallax * 12, currFil.y + currentMouseY * currFil.parallax * 12);

          const depthFactor = (150 - currFil.z) / 300;
          const alpha = (0.02 + 0.18 * depthFactor) * currentOrbitOpacityFactor * filamentMult * processingGlow;
          ctx.strokeStyle = `rgba(0, 229, 255, ${alpha})`;
          ctx.lineWidth = 0.35 + 0.3 * depthFactor;
          ctx.stroke();

          prevFil = currFil;
        }
      });

      // E. Render central 5-layer Nucleus (RESTORED LARGE VISUAL AREA)
      const finalNucleusScale = 1.35 * currentNucleusScale;
      const cx = currentCenterX;
      const cy = currentCenterY;

      // Layer 1: Large diffuse atmospheric bloom (radius 220px, high alpha)
      const bloomRad = 220 * finalNucleusScale;
      const bloomGlow = ctx.createRadialGradient(cx, cy, 5, cx, cy, bloomRad);
      const bloomOpacity = 0.38 * currentNucleusGlow * (1 + currentVolume * 0.4);
      bloomGlow.addColorStop(0, `rgba(0, 229, 255, ${bloomOpacity})`);
      bloomGlow.addColorStop(0.4, `rgba(0, 140, 255, ${bloomOpacity * 0.45})`);
      bloomGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = bloomGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, bloomRad, 0, Math.PI * 2);
      ctx.fill();

      // Layer 2: Cyan energy halo (radius 110px, high alpha)
      ctx.beginPath();
      ctx.arc(cx, cy, 110 * finalNucleusScale, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 229, 255, ${0.45 * currentNucleusGlow})`;
      ctx.lineWidth = 2.2 * finalNucleusScale;
      ctx.stroke();

      // Layer 3: Electric-blue plasma ring (radius 75px, high alpha)
      ctx.beginPath();
      const plasmaPoints = 14;
      for (let i = 0; i <= plasmaPoints; i++) {
        const angle = (i / plasmaPoints) * Math.PI * 2;
        // Slow down high frequency plasma noise to feel expensive and controlled
        const noiseVal = 3.5 * Math.sin(angle * 4 + time * 0.025);
        const pr = (75 + noiseVal) * finalNucleusScale;
        const px = cx + Math.cos(angle) * pr;
        const py = cy + Math.sin(angle) * pr * 0.82;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = `rgba(0, 140, 255, ${0.68 * currentNucleusGlow})`;
      ctx.lineWidth = 1.8 * finalNucleusScale;
      ctx.stroke();

      // Layer 4: Warm amber/gold nucleus (radius 45px, References accent)
      const goldRad = 45 * finalNucleusScale;
      const goldGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, goldRad);
      const goldOpacity = 0.92 * currentNucleusGlow * (1 + currentVolume * 0.25);
      goldGlow.addColorStop(0, `rgba(255, 215, 90, ${goldOpacity})`);
      goldGlow.addColorStop(0.5, `rgba(255, 145, 30, ${goldOpacity * 0.65})`);
      goldGlow.addColorStop(0.9, `rgba(255, 80, 0, ${goldOpacity * 0.15})`);
      goldGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = goldGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, goldRad, 0, Math.PI * 2);
      ctx.fill();

      // Layer 5: White-hot center (radius 16px)
      const whiteRad = 16 * finalNucleusScale;
      ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
      ctx.beginPath();
      ctx.arc(cx, cy, whiteRad, 0, Math.PI * 2);
      ctx.fill();

      // Spark Emitter: Tightly orbiting core sparks (radius 50 - 90px)
      coreSparks.forEach((spark, idx) => {
        if (!prefersReducedMotion) {
          spark.angle += spark.speed * currentRotationSpeed;
        }
        const sx = cx + Math.cos(spark.angle) * spark.radius * finalNucleusScale;
        const sy = cy + Math.sin(spark.angle) * spark.radius * 0.72 * finalNucleusScale;

        const prevSx = cx + Math.cos(spark.angle - spark.speed * 2) * spark.radius * finalNucleusScale;
        const prevSy = cy + Math.sin(spark.angle - spark.speed * 2) * spark.radius * 0.72 * finalNucleusScale;
        let strokeColor = "rgba(255, 215, 90, 0.4)";
        let fillColor = "rgba(255, 255, 255, 0.95)";
        if (idx % 3 === 1) {
          strokeColor = "rgba(0, 229, 255, 0.4)";
          fillColor = "rgba(220, 252, 255, 0.95)";
        } else if (idx % 3 === 2) {
          strokeColor = "rgba(160, 40, 255, 0.4)";
          fillColor = "rgba(240, 220, 255, 0.95)";
        }

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(prevSx, prevSy);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = spark.size;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sx, sy, spark.size, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();
      });

      // Spark Emitter: Shoot random fading sparks outward from the core (restrained rate)
      let sparkChance = 0.01; // extremely low for standby/idle
      if (activeStatus === "Listening") {
        sparkChance = 0.06 + currentVolume * 0.30;
      } else if (activeStatus === "Thinking" || activeStatus === "Processing") {
        sparkChance = 0.04; // elegant, sparse active sparks
      } else if (activeStatus === "Speaking") {
        sparkChance = 0.03;
      }

      if (outwardSparks.length < 15 && Math.random() < sparkChance) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 2.2 + 1.2) * (1 + currentVolume * 1.5) * speedMultiplier;

        const randColor = Math.random();
        let spColor = "rgba(0, 229, 255, ";
        if (randColor < 0.35) {
          spColor = "rgba(255, 200, 50, ";
        } else if (randColor < 0.55) {
          spColor = "rgba(160, 40, 255, ";
        }

        outwardSparks.push({
          x: 0,
          y: 0,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * 0.7,
          life: Math.random() * 25 + 20,
          maxLife: 45,
          size: Math.random() * 0.95 + 0.55,
          color: spColor,
        });
      }

      for (let sIdx = outwardSparks.length - 1; sIdx >= 0; sIdx--) {
        const sp = outwardSparks[sIdx];
        if (!prefersReducedMotion) {
          sp.x += sp.vx;
          sp.y += sp.vy;
          sp.life -= 1;
        }

        if (sp.life <= 0) {
          outwardSparks.splice(sIdx, 1);
          continue;
        }

        const alpha = sp.life / sp.maxLife;
        const sx = cx + sp.x;
        const sy = cy + sp.y;

        const prevSx = sx - sp.vx * 1.8;
        const prevSy = sy - sp.vy * 1.8;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(prevSx, prevSy);
        ctx.strokeStyle = sp.color + (alpha * 0.7) + ")";
        ctx.lineWidth = sp.size;
        ctx.stroke();
      }

      // F. Render particles
      cosmicParticles.forEach((p) => {
        let prevScreenX = 0;
        let prevScreenY = 0;

        if (p.type === "bg" || p.type === "mid" || p.type === "fg") {
          const trailVal = activeStatus === "Processing" ? p.trailLength * 2.2 : p.trailLength;

          if (trailVal > 0 && !prefersReducedMotion) {
            const prevScale = fov / (p.z + p.speedZ * speedMultiplier * trailVal);
            const pParallax = p.type === "bg" ? 6 : p.type === "mid" ? 22 : 48;
            prevScreenX = currentCenterX + p.x * prevScale + currentMouseX * pParallax;
            prevScreenY = currentCenterY + p.y * prevScale * 0.52 + currentMouseY * pParallax * 0.52;
          }

          if (!prefersReducedMotion) {
            p.z -= p.speedZ * speedMultiplier * 1.2;
          }

          if (p.z <= 10) {
            p.z = Math.random() * 300 + 400;
            p.x = Math.random() * 2000 - 1000;
            p.y = Math.random() * 2000 - 1000;
            return;
          }

          const scale2 = fov / p.z;
          const pParallax = p.type === "bg" ? 6 : p.type === "mid" ? 22 : 48;
          const px = currentCenterX + p.x * scale2 + currentMouseX * pParallax;
          const py = currentCenterY + p.y * scale2 * 0.52 + currentMouseY * pParallax * 0.52;

          if (px < 0 || px > width || py < 0 || py > height) return;

          const starActivityGlow = activeStatus === "Processing" ? 1.35 : 1.0;
          const twinkle = 0.55 + 0.45 * Math.sin(time * 0.015 + p.colorPhase);
          const finalOpacity = p.opacity * twinkle * (0.8 + currentVolume * 0.2) * starActivityGlow;
          const size = p.size * scale2;

          const tVal = (time * 0.015 + p.colorPhase) % (Math.PI * 2);
          let r = 0, g = 200, b = 255;
          if (p.isVioletOption) {
            if (tVal < Math.PI * 0.66) {
              const f = tVal / (Math.PI * 0.66);
              r = 0; g = Math.floor(229 - 89 * f); b = 255;
            } else if (tVal < Math.PI * 1.33) {
              const f = (tVal - Math.PI * 0.66) / (Math.PI * 0.67);
              r = Math.floor(160 * f); g = Math.floor(140 - 100 * f); b = 255;
            } else {
              const f = (tVal - Math.PI * 1.33) / (Math.PI * 0.67);
              r = Math.floor(160 * (1 - f)); g = Math.floor(40 + 189 * f); b = 255;
            }
          } else {
            if (tVal < Math.PI * 0.66) {
              const f = tVal / (Math.PI * 0.66);
              r = 0; g = Math.floor(229 - 89 * f); b = 255;
            } else if (tVal < Math.PI * 1.33) {
              const f = (tVal - Math.PI * 0.66) / (Math.PI * 0.67);
              r = Math.floor(220 * f); g = Math.floor(140 + 112 * f); b = 255;
            } else {
              const f = (tVal - Math.PI * 1.33) / (Math.PI * 0.67);
              r = Math.floor(220 * (1 - f)); g = Math.floor(252 - 23 * f); b = 255;
            }
          }

          // Render soft glows around foreground stars
          if (p.type === "fg") {
            const fgGlow = ctx.createRadialGradient(px, py, 0, px, py, size * 4.0);
            fgGlow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${finalOpacity * 0.45})`);
            fgGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = fgGlow;
            ctx.beginPath();
            ctx.arc(px, py, size * 4.0, 0, Math.PI * 2);
            ctx.fill();
          }

          if (trailVal > 0 && prevScreenX > 0 && !prefersReducedMotion) {
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(prevScreenX, prevScreenY);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${finalOpacity * 0.55})`;
            ctx.lineWidth = size * 0.75;
            ctx.stroke();
          }

          ctx.beginPath();
          ctx.arc(px, py, size * 1.4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${finalOpacity})`;
          ctx.fill();
        }

        else if (p.type === "orbit") {
          const orbit = orbitDefinitions[p.orbitIndex!];
          const rx = baseSize * orbit.rxFactor;
          const ry = baseSize * orbit.ryFactor;
          
          if (!prefersReducedMotion) {
            const generateSpeedOffset = activeStatus === "Processing" ? 1.45 : 1.0;
            p.theta! += p.speed * currentParticleSpeed * 1.1 * generateSpeedOffset;
          }

          const orbitAngle = orbit.baseRotateZ + time * orbit.orbitSpeed * (speedMultiplier * 1.5);

          const radiusOffset = 6 * Math.sin(3 * p.theta! + p.orbitIndex! * 1.5);
          const rx_curr = rx + radiusOffset;
          const ry_curr = ry + radiusOffset;

          const xp = rx_curr * Math.cos(p.theta!);
          const yp = ry_curr * Math.sin(p.theta!);

          const proj = project3D(xp, yp, 0, orbit.tiltX, orbit.tiltY, orbitAngle, currentCenterX, currentCenterY, fov);
          const depthFactor = (150 - proj.z) / 300;

          const distToCenter = Math.sqrt(xp * xp + yp * yp);
          const proximityGlow = 1.0 + (1.0 - Math.min(1.0, distToCenter / (baseSize * 0.6))) * 0.8;
          const backSideFade = proj.z > 40 ? Math.max(0.15, 1.0 - (proj.z - 40) / 160) : 1.0;

          const twinkle = 0.7 + 0.3 * Math.sin(time * 0.06 + p.colorPhase);
          const opacity = p.opacity * depthFactor * twinkle * proximityGlow * backSideFade;
          const size = p.size * proj.scale;

          const px = proj.x + currentMouseX * proj.parallax * 15;
          const py = proj.y + currentMouseY * proj.parallax * 15;

          const trailTheta = p.theta! - p.speed * 4.0;
          const xt = rx_curr * Math.cos(trailTheta);
          const yt = ry_curr * Math.sin(trailTheta);
          const trailProj = project3D(xt, yt, 0, orbit.tiltX, orbit.tiltY, orbitAngle, currentCenterX, currentCenterY, fov);
          const ptx = trailProj.x + currentMouseX * trailProj.parallax * 15;
          const pty = trailProj.y + currentMouseY * trailProj.parallax * 15;

          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(ptx, pty);
          ctx.strokeStyle = `rgba(0, 229, 255, ${opacity * 0.45})`;
          ctx.lineWidth = size * 0.65;
          ctx.stroke();

          const pGlow = ctx.createRadialGradient(px, py, 0, px, py, size * 2.5);
          pGlow.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
          pGlow.addColorStop(0.35, `rgba(0, 229, 255, ${opacity * 0.85})`);
          pGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = pGlow;
          ctx.beginPath();
          ctx.arc(px, py, size * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        else if (p.type === "core") {
          if (!prefersReducedMotion) {
            p.angle! += p.speed * currentParticleSpeed * 1.5 * currentRotationSpeed;
          }
          const coreBreathFactor = 1.0 + 0.18 * Math.sin(time * 0.05 + p.colIndex!);
          const xp = p.radius! * Math.cos(p.angle!) * coreBreathFactor;
          const yp = p.radius! * Math.sin(p.angle!) * 0.7 * coreBreathFactor;
          const zp = p.radius! * Math.sin(p.angle!) * 0.6 * coreBreathFactor;

          const proj = project3D(xp, yp, zp, 30 * Math.PI / 180, 20 * Math.PI / 180, time * 0.005, currentCenterX, currentCenterY, fov);
          const depthFactor = (100 - proj.z) / 200;
          const opacity = p.opacity * depthFactor * (1.0 + currentVolume * 0.3);
          const size = p.size * proj.scale;

          const px = proj.x + currentMouseX * proj.parallax * 8;
          const py = proj.y + currentMouseY * proj.parallax * 8;

          ctx.beginPath();
          ctx.arc(px, py, size * 1.6, 0, Math.PI * 2);
          if (p.colIndex! % 3 === 0) {
            ctx.fillStyle = `rgba(255, 215, 90, ${opacity * 0.95})`; // amber
          } else if (p.colIndex! % 3 === 1) {
            ctx.fillStyle = `rgba(0, 229, 255, ${opacity * 0.9})`; // cyan
          } else {
            ctx.fillStyle = `rgba(0, 140, 255, ${opacity * 0.85})`; // blue
          }
          ctx.fill();
        }

        else if (p.type === "column") {
          if (!prefersReducedMotion) {
            p.y += p.speed * currentParticleSpeed * 2.5 * currentRotationSpeed;
            if (p.y > 180) p.y = -180;
          }
          const colRotation = time * 0.008 * currentRotationSpeed + p.colIndex! * 0.35;
          const colRadius = 6 * (1 + currentVolume * 0.4);
          const cx_col = colRadius * Math.cos(colRotation);
          const cz_col = colRadius * Math.sin(colRotation);

          const proj = project3D(cx_col, p.y, cz_col, 15 * Math.PI / 180, 5 * Math.PI / 180, 0, currentCenterX, currentCenterY, fov);
          const depthFactor = (100 - proj.z) / 200;
          const opacity = p.opacity * depthFactor * (0.65 + 0.35 * Math.sin(time * 0.04 + p.colIndex!));
          const size = p.size * proj.scale;

          const px = proj.x + currentMouseX * proj.parallax * 10;
          const py = proj.y + currentMouseY * proj.parallax * 10;

          const colGlow = ctx.createRadialGradient(px, py, 0, px, py, size * 2.5);
          colGlow.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
          colGlow.addColorStop(0.35, `rgba(0, 229, 255, ${opacity * 0.85})`);
          colGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = colGlow;
          ctx.beginPath();
          ctx.arc(px, py, size * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // G. Outward pulses when in Speaking state
      if (activeStatus === "Speaking") {
        pulseTimer++;
        if (pulseTimer >= 50) {
          pulseTimer = 0;
          pulses.push({
            radius: 20,
            maxRadius: baseSize * 0.65,
            opacity: 0.85,
            speed: 1.5,
          });
        }
      } else {
        pulseTimer = 0;
      }

      for (let pIdx = pulses.length - 1; pIdx >= 0; pIdx--) {
        const p = pulses[pIdx];
        if (!prefersReducedMotion) {
          p.radius += p.speed;
          p.opacity = Math.max(0, 0.85 - (p.radius - 20) / (baseSize * 0.6));
        }

        if (p.radius >= p.maxRadius || p.opacity <= 0) {
          pulses.splice(pIdx, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(currentCenterX, currentCenterY, p.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 229, 255, ${p.opacity * 0.35})`;
        ctx.lineWidth = 0.85;
        ctx.stroke();
      }

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
