import React, { useState, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { MicButton } from "./MicButton";

interface ComposerProps {
  onSend: (text: string) => void;
  onMicClick: () => void;
  isListening: boolean;
  isSending: boolean;
  volume?: number;
}

export const Composer: React.FC<ComposerProps> = ({
  onSend,
  onMicClick,
  isListening,
  isSending,
  volume = 0,
}) => {
  const [text, setText] = useState("");
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

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-[720px] px-4 md:px-0 mb-8 sticky bottom-8 z-20 animate-fade-in"
    >
      <div className="relative flex flex-col gap-2 p-2 bg-[#08090D]/70 backdrop-blur-2xl border border-zephyra-border-surface/30 rounded-2xl shadow-[0_16px_48px_-12px_rgba(0,0,0,0.9)] focus-within:border-zephyra-accent/20 focus-within:shadow-[0_0_30px_rgba(0,201,167,0.03)] transition-all duration-300">
        {/* Fine top border highlight */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-linear-to-r from-transparent via-zephyra-accent/8 to-transparent pointer-events-none rounded-t-2xl" />
        
        {/* Core Input Row */}
        <div className="flex items-end gap-3 px-1">
          {/* Integrated circular microphone action */}
          <MicButton
            isListening={isListening}
            volume={volume}
            onClick={onMicClick}
            disabled={isSending}
          />

          {/* Autogrowing command textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 2000))}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening..." : "Enter a command to initiate workflow..."}
            disabled={isSending || isListening}
            rows={1}
            maxLength={2000}
            aria-label="Composer text input"
            className="flex-1 bg-transparent border-0 resize-none font-sans text-sm text-zephyra-text-primary placeholder-zephyra-text-veryMuted/65 focus:ring-0 focus:outline-none py-2.5 max-h-32 min-h-[36px] overflow-y-auto custom-scrollbar leading-relaxed"
          />

          {/* Submit action */}
          <button
            type="submit"
            disabled={!text.trim() || isSending || isListening}
            aria-label="Send command"
            className={`h-10 w-10 rounded-full border transition-all duration-300 flex items-center justify-center focus:outline-none ${
              text.trim() && !isSending && !isListening
                ? "bg-zephyra-accent/10 border-zephyra-accent/30 text-zephyra-accent hover:bg-zephyra-accent hover:text-[#08090D] scale-100 hover:scale-105 cursor-pointer shadow-[0_0_12px_rgba(0,201,167,0.15)]"
                : "bg-transparent border-transparent text-zephyra-text-veryMuted opacity-15 scale-95 cursor-not-allowed"
            }`}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>

        {/* Shortcuts and limits bar */}
        <div className="flex items-center justify-between px-2.5 pt-2 pb-0.5 border-t border-zephyra-border-hairline/50 select-none font-mono text-[8px] md:text-[9px] text-zephyra-text-veryMuted uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-zephyra-border-surface bg-zephyra-border-hairline/50 text-[8px] text-zephyra-text-muted">Enter ↵</kbd> 
              <span className="text-[8px] hidden md:inline">to send</span>
            </span>
            <span className="opacity-30">•</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-zephyra-border-surface bg-zephyra-border-hairline/50 text-[8px] text-zephyra-text-muted">Shift + Enter</kbd> 
              <span className="text-[8px] hidden md:inline">for newline</span>
            </span>
          </div>
          <div>
            {isListening ? (
              <span className="text-zephyra-accent flex items-center gap-1.5 lowercase tracking-normal font-sans font-light text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-zephyra-accent animate-pulse" />
                listening
              </span>
            ) : (
              `${text.length} / 2000`
            )}
          </div>
        </div>
      </div>
    </form>
  );
};

