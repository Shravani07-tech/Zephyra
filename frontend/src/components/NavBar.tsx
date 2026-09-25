import React from "react";
import { Plus, Cpu, PanelLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { SemanticStatus } from "../hooks/useChatStream";

interface NavBarProps {
  status: SemanticStatus;
  systemConfig?: { provider: string; model: string; status: string };
  onNewChat: () => void;
  isHistoryOpen: boolean;
  isSystemOpen: boolean;
  onToggleHistory: () => void;
  onToggleSystem: () => void;
}

export const NavBar: React.FC<NavBarProps> = ({
  status,
  systemConfig,
  onNewChat,
  isHistoryOpen,
  isSystemOpen,
  onToggleHistory,
  onToggleSystem,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case "LISTENING":
        return "bg-zephyra-accent shadow-[0_0_10px_rgba(0,229,255,0.7)]";
      case "AWAKENING":
      case "THINKING":
        return "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]";
      case "GENERATING":
        return "bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.6)]";
      case "COMPLETING":
      case "SPEAKING":
        return "bg-teal-300 shadow-[0_0_10px_rgba(94,234,212,0.7)]";
      case "ERROR":
      case "ABORTED":
        return "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]";
      case "PAUSED":
        return "bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.7)]";
      case "IDLE":
      default:
        return "bg-zephyra-text-veryMuted/50";
    }
  };

  return (
    <header className="h-[64px] w-full border-b border-zephyra-border-hairline/20 bg-[#08090D]/90 backdrop-blur-xl px-4 md:px-6 flex items-center justify-between z-30 shrink-0">
      {/* Brand Group & Toggle History */}
      <div className="flex items-center gap-3.5">
        {/* Toggle history sidebar panel */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 250, damping: 25, mass: 1.2 }}
          onClick={onToggleHistory}
          aria-label="Toggle history panel"
          className={`p-1.5 rounded border transition-colors duration-200 cursor-pointer focus:outline-none ${
            isHistoryOpen
              ? "border-zephyra-accent/30 text-zephyra-accent bg-zephyra-accent/5"
              : "border-zephyra-border-surface/40 bg-zephyra-border-hairline/25 text-zephyra-text-muted hover:text-zephyra-text-primary"
          }`}
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </motion.button>

        {/* Geometric brand symbol */}
        <div className="flex items-center justify-center select-none" aria-hidden="true">
          <svg className="w-4 h-4 text-zephyra-accent" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L20 12L12 22L4 12L12 2" stroke="currentColor" strokeWidth="0.8" className="opacity-20" />
            <path d="M12 6L18 12L12 18L6 12L12 6" stroke="currentColor" strokeWidth="1.0" className="opacity-60" />
            <circle cx="12" cy="12" r="1" fill="currentColor" className="animate-pulse-subtle" />
          </svg>
        </div>

        {/* Logo Text Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          transition={{ type: "spring", stiffness: 250, damping: 25, mass: 1.2 }}
          onClick={onNewChat}
          className="flex items-center gap-2 text-left focus:outline-none cursor-pointer bg-transparent border-0 p-0 m-0"
          aria-label="Zephyra Brand Home"
        >
          <span className="font-sans text-sm tracking-[0.14em] font-light text-zephyra-text-primary hover:text-zephyra-accent transition-colors duration-250">
            Zephyra
          </span>
          <span className="font-mono text-[7px] tracking-wider text-zephyra-text-veryMuted uppercase px-1.5 py-0.5 border border-zephyra-border-surface/40 rounded bg-zephyra-border-hairline/30 select-none">
            Lite
          </span>
        </motion.button>
      </div>

      {/* Center/Right Control & State Telemetry Panel */}
      <div className="flex items-center gap-4">
        {/* Core System Telemetry Text (Subtle, Monospace) */}
        <div className="hidden lg:flex flex-col items-end gap-0.5 select-none font-mono text-[8px] tracking-[0.12em] text-zephyra-text-veryMuted uppercase">
          <span>core engine</span>
          <span className="text-zephyra-text-muted lowercase tracking-normal font-sans font-light">
            {systemConfig?.model
              ? `${systemConfig.provider.toLowerCase()} / ${systemConfig.model}`
              : "nvidia / llama-3.1"}
          </span>
        </div>

        <span className="hidden lg:inline text-zephyra-border-surface/50 select-none">|</span>

        {/* Ambient status capsule */}
        <div
          className="flex items-center gap-2.5 px-3 py-1 rounded-md border border-zephyra-border-surface/40 bg-[#1A2235]/10 backdrop-blur-md"
          aria-live="polite"
        >
          <span className="relative flex h-1.5 w-1.5">
            {status === "LISTENING" && (
              <span className="animate-status-pulse absolute inline-flex h-full w-full rounded-full bg-zephyra-accent opacity-75"></span>
            )}
            {(status === "THINKING" || status === "AWAKENING") && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60"></span>
            )}
            {status === "GENERATING" && (
              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-70"></span>
            )}
            {(status === "SPEAKING" || status === "COMPLETING") && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-70"></span>
            )}
            {status === "PAUSED" && (
              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-70"></span>
            )}
            {(status === "ERROR" || status === "ABORTED") && (
              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-70"></span>
            )}
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 transition-all duration-300 ${getStatusColor()}`} />
          </span>

          <div className="overflow-hidden h-3 flex items-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={status}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="font-mono text-[8px] md:text-[9px] tracking-widest text-zephyra-text-muted uppercase select-none block font-medium"
              >
                {status}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* Reset / New Chat Action */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 250, damping: 25, mass: 1.2 }}
          onClick={onNewChat}
          aria-label="Create new conversation"
          className="p-1.5 rounded border border-zephyra-border-surface bg-zephyra-border-hairline/30 text-zephyra-text-muted hover:text-zephyra-text-primary hover:border-zephyra-text-veryMuted transition-colors duration-200 focus:outline-none cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden md:inline font-mono text-[8px] tracking-wider uppercase">New Chat</span>
        </motion.button>

        {/* Toggle system monitor panel */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 250, damping: 25, mass: 1.2 }}
          onClick={onToggleSystem}
          aria-label="Toggle system monitor"
          className={`p-1.5 rounded border transition-colors duration-200 cursor-pointer focus:outline-none ${
            isSystemOpen
              ? "border-zephyra-accent/30 text-zephyra-accent bg-zephyra-accent/5"
              : "border-zephyra-border-surface/40 bg-zephyra-border-hairline/25 text-zephyra-text-muted hover:text-zephyra-text-primary"
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
        </motion.button>
      </div>
    </header>
  );
};
