import React, { useEffect, useState } from "react";
import type { SemanticStatus } from "../hooks/useChatStream";

interface EmptyStateProps {
  onMicClick: () => void;
  status: SemanticStatus;
  isListening: boolean;
  volume?: number;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onMicClick,
  status,
  isListening,
  volume = 0,
}) => {
  const [greeting, setGreeting] = useState("Good day");

  useEffect(() => {
    const hours = new Date().getHours();
    if (hours < 12) {
      setGreeting("Good morning");
    } else if (hours < 17) {
      setGreeting("Good afternoon");
    } else {
      setGreeting("Good evening");
    }
  }, []);

  // Compute animations and styles based on system status
  const getOrbStateStyles = () => {
    switch (status) {
      case "Listening":
        return {
          glowClass: "animate-pulse bg-zephyra-accent/20 blur-2xl",
          orbitClass: "animate-spin-slow",
          middleOrbitClass: "animate-reverse-spin-slow",
          ringClass: "border-zephyra-accent/45 scale-105",
          coreBorder: "border-zephyra-accent shadow-[0_0_25px_rgba(0,201,167,0.4)]",
          dotClass: "bg-zephyra-accent animate-ping",
        };
      case "Thinking":
        return {
          glowClass: "animate-pulse-subtle bg-amber-500/10 blur-xl",
          orbitClass: "animate-spin-slow",
          middleOrbitClass: "animate-reverse-spin-slow",
          ringClass: "border-amber-500/35 animate-pulse-subtle",
          coreBorder: "border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.25)]",
          dotClass: "bg-amber-500 animate-pulse",
        };
      case "Processing":
        return {
          glowClass: "animate-pulse bg-indigo-500/10 blur-lg",
          orbitClass: "animate-reverse-spin-slow",
          middleOrbitClass: "animate-spin-slow",
          ringClass: "border-indigo-500/35 animate-pulse",
          coreBorder: "border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.25)]",
          dotClass: "bg-indigo-400 animate-pulse",
        };
      case "Speaking":
        return {
          glowClass: "animate-orb-breathe-slow bg-teal-400/15 blur-xl",
          orbitClass: "animate-spin-slow",
          middleOrbitClass: "animate-reverse-spin-slow",
          ringClass: "border-teal-400/40 animate-ring-expand",
          coreBorder: "border-teal-400 shadow-[0_0_20px_rgba(45,212,191,0.35)]",
          dotClass: "bg-teal-400 scale-105 animate-pulse",
        };
      default: // Standby
        return {
          glowClass: "animate-orb-breathe-slow bg-zephyra-accent/8 blur-lg",
          orbitClass: "animate-orb-orbit",
          middleOrbitClass: "animate-reverse-spin-slow",
          ringClass: "border-zephyra-border-surface/40",
          coreBorder: "border-zephyra-border-surface hover:border-zephyra-accent/40 shadow-sm",
          dotClass: "bg-zephyra-accent/35 group-hover:bg-zephyra-accent/75",
        };
    }
  };

  const orbStyles = getOrbStateStyles();

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative p-6 select-none animate-fade-in w-full max-w-[800px] mx-auto">
      {/* Intelligence Core Composition */}
      <div className="relative w-36 h-36 md:w-40 md:h-40 mb-12 flex items-center justify-center select-none">
        
        {/* Layer 1: Outer ambient glow halo */}
        <div
          className={`absolute rounded-full transition-all duration-750 ease-out ${orbStyles.glowClass}`}
          style={{
            width: "135%",
            height: "135%",
            transform: status === "Listening" ? `scale(${1.1 + volume * 0.4})` : undefined,
          }}
        />

        {/* Layer 2: Barely-visible Outer Orbit */}
        <div
          className={`absolute rounded-full border border-dashed border-zephyra-accent/5 transition-all duration-700 ${orbStyles.orbitClass}`}
          style={{
            width: "115%",
            height: "115%",
          }}
        />

        {/* Layer 3: Medium Orbit */}
        <div
          className={`absolute rounded-full border border-zephyra-border-surface/20 transition-all duration-700 ${orbStyles.middleOrbitClass}`}
          style={{
            width: "95%",
            height: "95%",
          }}
        />

        {/* Layer 4: Primary Intelligence Ring */}
        <div
          className={`absolute rounded-full border border-dashed transition-all duration-500 ${orbStyles.ringClass}`}
          style={{
            width: "78%",
            height: "78%",
            transform: status === "Listening" ? `scale(${1 + volume * 0.2})` : undefined,
          }}
        />

        {/* Layer 5: Inner Core Hairline */}
        <div
          className="absolute rounded-full border border-zephyra-border-surface/25"
          style={{
            width: "60%",
            height: "60%",
          }}
        />

        {/* Layer 6: Speaking concentric ripple wave */}
        {status === "Speaking" && (
          <div className="absolute w-24 h-24 rounded-full border border-teal-400/30 animate-ring-expand pointer-events-none" />
        )}

        {/* Layer 7: Core physical node interaction button */}
        <button
          onClick={onMicClick}
          aria-label={isListening ? "Deactivate voice connection" : "Activate voice connection"}
          className={`relative z-10 w-11 h-11 md:w-12 md:h-12 rounded-full bg-linear-to-b from-[#1A2235]/60 to-[#08090D] border transition-all duration-350 flex items-center justify-center focus:outline-none cursor-pointer group ${orbStyles.coreBorder}`}
        >
          {/* Central state-specific indicator dot */}
          <span className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${orbStyles.dotClass}`} />
        </button>
      </div>

      {/* Greeting and instructions */}
      <div className="text-center space-y-4 max-w-lg select-none">
        <h2 className="text-4xl md:text-[46px] font-sans font-extralight tracking-tight text-zephyra-text-primary leading-[1.15]">
          {greeting}<span className="text-zephyra-accent">.</span>
        </h2>
        <p className="text-sm md:text-base font-sans font-light tracking-wide text-zephyra-text-muted/80 leading-relaxed max-w-sm mx-auto">
          How can I assist your workflow today?
        </p>
        
        {/* Technical styled instruction deck shortcuts */}
        <div className="pt-8 flex justify-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-zephyra-border-surface/40 bg-zephyra-border-hairline/25">
            <span className="font-mono text-[8px] md:text-[9px] tracking-widest text-zephyra-text-veryMuted uppercase flex items-center gap-2 select-none">
              <kbd className="px-1.5 py-0.5 rounded border border-zephyra-border-surface bg-zephyra-border-hairline/60 text-[8px] text-zephyra-text-muted font-mono font-semibold shadow-xs">Space</kbd>
              <span>to speak</span>
              <span className="opacity-30">•</span>
              <span>or type below</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
