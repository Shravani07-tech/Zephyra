import React, { useState, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { motion } from "framer-motion";
import { MicButton } from "./MicButton";

interface ComposerProps {
  onSend: (text: string) => void;
  onMicClick: () => void;
  isListening: boolean;
  isSending: boolean;
  volume?: number;
  status?: string;
}

export const Composer: React.FC<ComposerProps> = ({
  onSend,
  onMicClick,
  isListening,
  isSending,
  volume = 0,
  status = "Standby",
}) => {
  const [text, setText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSending || isListening) return;
    onSend(text.trim());
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-grow height logic
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(128, textarea.scrollHeight)}px`;
    }
  }, [text]);

  // V3.1 Responsive Composer States Glow Mapping
  let borderColor = "rgba(26, 34, 53, 0.4)";
  let shadowColor = "rgba(0, 0, 0, 0)";
  let shadowBlur = "0px";
  let bg = "rgba(8, 9, 13, 0.85)";

  if (isFocused) {
    borderColor = "rgba(0, 229, 255, 0.35)";
    shadowColor = "rgba(0, 229, 255, 0.08)";
    shadowBlur = "25px";
  } else if (isListening) {
    borderColor = "rgba(0, 229, 255, 0.5)";
    shadowColor = "rgba(0, 229, 255, 0.12)";
    shadowBlur = "30px";
  } else if (isSending || status === "Thinking" || status === "Processing") {
    borderColor = "rgba(0, 140, 255, 0.45)";
    shadowColor = "rgba(0, 140, 255, 0.08)";
    shadowBlur = "25px";
  } else if (status === "Speaking") {
    borderColor = "rgba(220, 250, 255, 0.35)";
    shadowColor = "rgba(220, 250, 255, 0.06)";
    shadowBlur = "25px";
    bg = "rgba(10, 13, 20, 0.88)";
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-[720px] px-4 md:px-0 mb-8 sticky bottom-8 z-20"
    >
      <motion.div
        animate={{
          borderColor,
          boxShadow: `0 0 ${shadowBlur} ${shadowColor}, 0 16px 48px -12px rgba(0,0,0,0.9)`,
          backgroundColor: bg,
        }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative flex flex-col gap-1.5 p-2 bg-[#08090D]/85 backdrop-blur-2xl border rounded-2xl"
      >
        {/* Fine top border highlight */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-linear-to-r from-transparent via-zephyra-accent/8 to-transparent pointer-events-none rounded-t-2xl" />
        
        {/* Top Input Area */}
        <div className="w-full flex items-start px-2.5">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 2000))}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={isListening ? "Listening..." : "Enter a command to initiate workflow..."}
            disabled={isSending || isListening}
            rows={1}
            maxLength={2000}
            aria-label="Composer text input"
            className="flex-1 bg-transparent border-0 resize-none font-sans text-sm text-zephyra-text-primary placeholder-zephyra-text-veryMuted/65 focus:ring-0 focus:outline-none py-2 max-h-32 min-h-[38px] overflow-y-auto custom-scrollbar leading-relaxed"
          />
        </div>

        {/* Bottom Telemetry & Control Bar */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1 border-t border-zephyra-border-hairline/60 select-none">
          {/* Left: Voice Telemetry Controls */}
          <div className="flex items-center gap-3">
            <MicButton
              isListening={isListening}
              volume={volume}
              onClick={onMicClick}
              disabled={isSending}
            />
            <div className="h-3 flex items-center">
              {isListening ? (
                <span className="text-zephyra-accent flex items-center gap-1.5 font-mono text-[8px] md:text-[9px] tracking-widest uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-zephyra-accent animate-pulse" />
                  listening
                </span>
              ) : (
                <span className="font-mono text-[8px] md:text-[9px] text-zephyra-text-veryMuted uppercase tracking-widest">
                  telemetry: ready
                </span>
              )}
            </div>
          </div>

          {/* Right: Keyboard Shortcuts & Submit Button */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 font-mono text-[8px] md:text-[9px] text-zephyra-text-veryMuted uppercase tracking-widest">
              <kbd className="px-1.5 py-0.5 rounded border border-zephyra-border-surface bg-zephyra-border-hairline/60 text-[8px] text-zephyra-text-muted">Enter ↵</kbd>
              <span>to send</span>
            </div>

            <span className="font-mono text-[8px] md:text-[9px] text-zephyra-text-veryMuted select-none">
              {text.length} / 2000
            </span>

            <motion.button
              type="submit"
              disabled={!text.trim() || isSending || isListening}
              whileHover={text.trim() && !isSending && !isListening ? { scale: 1.05 } : {}}
              whileTap={text.trim() && !isSending && !isListening ? { scale: 0.95 } : {}}
              transition={{ type: "spring", stiffness: 450, damping: 15 }}
              aria-label="Send command"
              className={`h-8 w-8 rounded-full border transition-colors duration-300 flex items-center justify-center focus:outline-none ${
                text.trim() && !isSending && !isListening
                  ? "bg-zephyra-accent/10 border-zephyra-accent/30 text-zephyra-accent hover:bg-zephyra-accent hover:text-[#08090D] cursor-pointer shadow-[0_0_12px_rgba(0,229,255,0.25)]"
                  : "bg-transparent border-transparent text-zephyra-text-veryMuted opacity-15 cursor-not-allowed"
              }`}
            >
              <ArrowUp className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </form>
  );
};
