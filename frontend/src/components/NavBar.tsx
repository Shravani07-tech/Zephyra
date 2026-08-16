import React from "react";
import { Plus, Menu, Cpu } from "lucide-react";
import type { SemanticStatus } from "../hooks/useChatStream";

interface NavBarProps {
  status: SemanticStatus;
  onNewChat: () => void;
  isHistoryOpen: boolean;
  isSystemOpen: boolean;
  onToggleHistory: () => void;
  onToggleSystem: () => void;
}

export const NavBar: React.FC<NavBarProps> = ({
  status,
  onNewChat,
  isHistoryOpen,
  isSystemOpen,
  onToggleHistory,
  onToggleSystem,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case "Listening":
        return "bg-zephyra-accent";
      case "Thinking":
        return "bg-amber-500";
      case "Processing":
        return "bg-indigo-500";
      case "Speaking":
        return "bg-teal-400";
      default:
        return "bg-zephyra-text-veryMuted";
    }
  };

  return (
    <header className="w-full h-[72px] border-b border-zephyra-border-hairline flex items-center justify-between px-6 bg-zephyra-bg/80 backdrop-blur-md z-30 sticky top-0">
      {/* Brand Group & Toggle History */}
      <div className="flex items-center gap-3.5">
        {/* Toggle history sidebar panel */}
        <button
          onClick={onToggleHistory}
          aria-label="Toggle thread history"
          className={`p-1.5 rounded border transition-all duration-200 cursor-pointer ${
            isHistoryOpen
              ? "border-zephyra-accent text-zephyra-accent bg-zephyra-accent/5"
              : "border-zephyra-border-surface bg-zephyra-border-hairline/30 text-zephyra-text-muted hover:text-zephyra-text-primary"
          }`}
        >
          <Menu className="w-3.5 h-3.5" />
        </button>

        {/* Geometric brand symbol */}
        <div className="flex items-center justify-center select-none" aria-hidden="true">
          <svg className="w-4 h-4 text-zephyra-accent" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L20 12L12 22L4 12L12 2" stroke="currentColor" strokeWidth="1" className="opacity-25" />
            <path d="M12 6L18 12L12 18L6 12L12 6" stroke="currentColor" strokeWidth="1.2" className="opacity-70" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" className="animate-pulse-subtle" />
          </svg>
        </div>

        {/* Logo Text Button */}
        <button
          onClick={onNewChat}
          className="flex items-center gap-2 text-left focus:outline-none cursor-pointer bg-transparent border-0 p-0 m-0"
          aria-label="Zephyra Lite Brand Home"
        >
          <span className="font-sans text-sm tracking-[0.16em] font-light text-zephyra-text-primary hover:text-zephyra-accent transition-colors duration-200">
            Zephyra
          </span>
          <span className="font-mono text-[8px] tracking-widest text-zephyra-text-veryMuted uppercase px-1.5 py-0.5 border border-zephyra-border-surface rounded bg-zephyra-border-hairline/60">
            Lite
          </span>
        </button>
      </div>

      {/* Actions & Status Pill Container */}
      <div className="flex items-center gap-3">
        {/* Reset / New Chat Action */}
        <button
          onClick={onNewChat}
          aria-label="Create new conversation"
          className="p-1.5 rounded border border-zephyra-border-surface bg-zephyra-border-hairline/30 text-zephyra-text-muted hover:text-zephyra-text-primary hover:border-zephyra-text-veryMuted transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-zephyra-accent cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden md:inline font-mono text-[8px] tracking-wider uppercase">New Chat</span>
        </button>

        {/* Ambient status capsule */}
        <div 
          className="flex items-center gap-2 px-3 py-1 rounded-full border border-zephyra-border-surface bg-[#1A2235]/15 backdrop-blur-md" 
          aria-live="polite"
        >
          <span className="relative flex h-1.5 w-1.5">
            {status === "Listening" && (
              <span className="animate-status-pulse absolute inline-flex h-full w-full rounded-full bg-zephyra-accent opacity-75"></span>
            )}
            {status === "Thinking" && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60"></span>
            )}
            {status === "Processing" && (
              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-70"></span>
            )}
            {status === "Speaking" && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-70"></span>
            )}
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 transition-all duration-300 ${getStatusColor()}`} />
          </span>
          <span className="font-mono text-[8px] md:text-[9px] tracking-widest text-zephyra-text-muted uppercase select-none">
            {status}
          </span>
        </div>

        {/* Toggle system monitor panel */}
        <button
          onClick={onToggleSystem}
          aria-label="Toggle system monitor"
          className={`p-1.5 rounded border transition-all duration-200 cursor-pointer ${
            isSystemOpen
              ? "border-zephyra-accent text-zephyra-accent bg-zephyra-accent/5"
              : "border-zephyra-border-surface bg-zephyra-border-hairline/30 text-zephyra-text-muted hover:text-zephyra-text-primary"
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};


