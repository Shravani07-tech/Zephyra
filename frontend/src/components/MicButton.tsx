import React from "react";
import { Mic, Square } from "lucide-react";
import { motion } from "framer-motion";

interface MicButtonProps {
  isListening: boolean;
  volume?: number;
  onClick: () => void;
  disabled?: boolean;
}

export const MicButton: React.FC<MicButtonProps> = ({
  isListening,
  volume = 0,
  onClick,
  disabled = false,
}) => {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      aria-label={isListening ? "Stop voice input" : "Start voice input"}
      className={`relative h-10 w-10 rounded-full border transition-colors duration-300 flex items-center justify-center focus:outline-none ${
        isListening
          ? "bg-zephyra-accent/10 border-zephyra-accent text-zephyra-accent shadow-[0_0_15px_rgba(0,229,255,0.25)]"
          : "bg-zephyra-border-hairline/30 border-zephyra-border-surface text-zephyra-text-muted hover:text-zephyra-text-primary hover:border-zephyra-text-veryMuted"
      } ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {/* Dynamic sound wave ring overlay */}
      {isListening && (
        <motion.span
          animate={{
            scale: 1.15 + volume * 0.45,
            opacity: Math.max(0.2, 0.65 - volume * 0.3)
          }}
          transition={{ type: "spring", stiffness: 350, damping: 15 }}
          className="absolute inset-0 rounded-full bg-zephyra-accent/15"
        />
      )}
      <span className="relative z-10 flex items-center justify-center">
        {isListening ? (
          <Square className="h-3.5 w-3.5 fill-current animate-pulse" />
        ) : (
          <Mic className="h-3.5 w-3.5" />
        )}
      </span>
    </motion.button>
  );
};
