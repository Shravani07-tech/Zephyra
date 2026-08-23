import React from "react";
import { motion } from "framer-motion";

interface EmptyStateProps {
  onMicClick: () => void;
  status: string;
  isListening: boolean;
  volume: number;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onMicClick,
  isListening,
}) => {
  // Simple greeting based on current local hours
  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return "Good morning";
    if (hours < 17) return "Good afternoon";
    return "Good evening";
  };

  const greeting = getGreeting();

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative p-6 select-none animate-fade-in w-full max-w-[800px] mx-auto z-10">
      {/* Voice Connection Button container (aligned with full-screen background nucleus) */}
      <div className="relative w-80 h-80 md:w-[380px] md:h-[380px] lg:w-[440px] lg:h-[440px] mb-12 flex items-center justify-center select-none">
        
        {/* Center Hotspot Glass Core Button (covers the nucleus interactive hotspot) */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onMicClick}
          aria-label={isListening ? "Deactivate voice connection" : "Activate voice connection"}
          className={`relative z-10 w-14 h-14 rounded-full border border-zephyra-accent/25 bg-black/45 hover:border-zephyra-accent/60 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zephyra-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#060c14] flex items-center justify-center cursor-pointer shadow-[0_0_20px_rgba(0,0,0,0.8)] ${
            isListening ? "border-zephyra-accent shadow-[0_0_25px_rgba(0,229,255,0.45)] bg-zephyra-accent/5" : ""
          }`}
        >
          {/* Glowing dot indicator */}
          <span className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
            isListening ? "bg-[#00e5ff] shadow-[0_0_12px_rgba(0,229,255,0.95)] animate-pulse" : "bg-[#00e5ff]/35"
          }`} />
        </motion.button>
      </div>

      {/* Greeting and instructions */}
      <div className="text-center space-y-4 max-w-lg select-none">
        <h2 className="text-4xl md:text-[46px] font-sans font-extralight tracking-tight text-zephyra-text-primary leading-[1.15]">
          {greeting}<span className="text-zephyra-accent">.</span>
        </h2>
        <p className="text-sm md:text-base font-sans font-light tracking-wide text-zephyra-text-muted/80 leading-relaxed max-w-sm mx-auto">
          How can I assist your workflow today?
        </p>
        
        {/* Short-cuts hint bar */}
        <div className="pt-8 flex justify-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-zephyra-border-surface/30 bg-zephyra-border-hairline/20">
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
