import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Square, Volume2, Play, X, Paperclip, FileText, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { MicButton } from "./MicButton";
import type { VoicePlaybackState } from "../hooks/useSpeech";
import type { UploadedFile } from "../api/types";
import { ACCEPTED_EXTENSIONS } from "../api/files";

interface ComposerProps {
  onSend: (text: string) => void;
  onMicClick: () => void;
  onStop?: () => void;
  voiceState?: VoicePlaybackState;
  onPauseVoice?: () => void;
  onResumeVoice?: () => void;
  onStopVoice?: () => void;
  isListening: boolean;
  isSending: boolean;
  volume?: number;
  status?: string;
  attachments?: UploadedFile[];
  onAttach?: (file: File) => void;
  onRemoveAttachment?: (documentId: string) => void;
  isUploading?: boolean;
  attachError?: string | null;
}

export const Composer: React.FC<ComposerProps> = ({
  onSend,
  onMicClick,
  onStop,
  voiceState = "idle",
  onPauseVoice,
  onResumeVoice,
  onStopVoice,
  isListening,
  isSending,
  volume = 0,
  status = "IDLE",
  attachments = [],
  onAttach,
  onRemoveAttachment,
  isUploading = false,
  attachError = null,
}) => {
  const [text, setText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again
    if (file && onAttach) onAttach(file);
  };
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
  } else if (isSending || status === "THINKING" || status === "GENERATING" || status === "AWAKENING") {
    borderColor = "rgba(0, 140, 255, 0.45)";
    shadowColor = "rgba(0, 140, 255, 0.08)";
    shadowBlur = "25px";
  } else if (status === "SPEAKING" || status === "COMPLETING") {
    borderColor = "rgba(220, 250, 255, 0.35)";
    shadowColor = "rgba(220, 250, 255, 0.06)";
    shadowBlur = "25px";
    bg = "rgba(10, 13, 20, 0.88)";
  } else if (status === "PAUSED") {
    borderColor = "rgba(252, 211, 77, 0.35)";
    shadowColor = "rgba(252, 211, 77, 0.06)";
    shadowBlur = "25px";
    bg = "rgba(15, 13, 10, 0.88)";
  } else if (status === "ERROR" || status === "ABORTED") {
    borderColor = "rgba(239, 68, 68, 0.45)";
    shadowColor = "rgba(239, 68, 68, 0.08)";
    shadowBlur = "25px";
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
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col gap-1.5 p-2 bg-[#08090D]/85 backdrop-blur-2xl border rounded-2xl"
      >
        {/* Fine top border highlight */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-linear-to-r from-transparent via-zephyra-accent/8 to-transparent pointer-events-none rounded-t-2xl" />
        
        {/* Attached files for this conversation */}
        {(attachments.length > 0 || isUploading || attachError) && (
          <div className="flex flex-wrap items-center gap-1.5 px-2.5 pt-1">
            {attachments.map((doc) => (
              <span
                key={doc.id}
                className="inline-flex items-center gap-1 max-w-[220px] px-2 py-0.5 rounded border border-zephyra-border-surface/40 bg-zephyra-border-hairline/30 font-mono text-[9px] text-zephyra-text-muted"
                title={doc.original_filename}
              >
                <FileText className="w-3 h-3 shrink-0 text-zephyra-accent/70" />
                <span className="truncate">{doc.filename}</span>
                {onRemoveAttachment && (
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(doc.id)}
                    disabled={isSending}
                    aria-label={`Remove file ${doc.filename}`}
                    className="ml-0.5 text-zephyra-text-veryMuted hover:text-red-300 disabled:opacity-40 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
            {isUploading && (
              <span className="inline-flex items-center gap-1 font-mono text-[9px] text-zephyra-text-veryMuted uppercase tracking-wider">
                <Loader2 className="w-3 h-3 animate-spin" />
                uploading
              </span>
            )}
            {attachError && (
              <span role="alert" className="font-mono text-[9px] text-red-400">
                {attachError}
              </span>
            )}
          </div>
        )}

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
            {onAttach && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS.join(",")}
                  onChange={handleFileChosen}
                  className="hidden"
                  aria-hidden="true"
                  tabIndex={-1}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending || isListening || isUploading}
                  aria-label="Attach a file"
                  title="Attach a file (PDF, TXT, MD, CSV, DOCX, XLSX up to 10 MB)"
                  className="h-8 w-8 rounded-full border border-zephyra-border-surface/40 text-zephyra-text-veryMuted hover:text-zephyra-accent hover:border-zephyra-accent/40 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <div className="h-3 flex items-center">
              {isListening ? (
                <span className="text-zephyra-accent flex items-center gap-1.5 font-mono text-[8px] md:text-[9px] tracking-widest uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-zephyra-accent animate-pulse" />
                  listening
                </span>
              ) : voiceState !== "idle" ? (
                <div className="flex items-center gap-1.5">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 250, damping: 25, mass: 1.2 }}
                    onClick={voiceState === "speaking" ? onPauseVoice : onResumeVoice}
                    aria-label={voiceState === "speaking" ? "Pause voice playback" : "Resume voice playback"}
                    className={`px-2.5 py-1 rounded border font-mono text-[9px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors duration-200 ${
                      voiceState === "speaking"
                        ? "border-teal-500/40 bg-teal-950/40 hover:bg-teal-900/60 text-teal-300 shadow-[0_0_12px_rgba(94,234,212,0.25)]"
                        : "border-amber-500/40 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.25)]"
                    }`}
                  >
                    {voiceState === "speaking" ? (
                      <>
                        <Volume2 className="w-3 h-3 text-teal-300 animate-pulse" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 text-amber-300 fill-current" />
                        <span>Resume</span>
                      </>
                    )}
                  </motion.button>
                  {onStopVoice && (
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 250, damping: 25, mass: 1.2 }}
                      onClick={onStopVoice}
                      aria-label="Stop voice playback"
                      className="p-1 rounded border border-zephyra-border-surface/40 bg-zephyra-border-hairline/30 hover:bg-red-950/40 hover:border-red-800/50 hover:text-red-300 text-zephyra-text-veryMuted transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </motion.button>
                  )}
                </div>
              ) : (
                <span className="font-mono text-[8px] md:text-[9px] text-zephyra-text-veryMuted uppercase tracking-widest">
                  telemetry: ready
                </span>
              )}
            </div>
          </div>

          {/* Right: Keyboard Shortcuts & Submit / Stop Button */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 font-mono text-[8px] md:text-[9px] text-zephyra-text-veryMuted uppercase tracking-widest">
              <kbd className="px-1.5 py-0.5 rounded border border-zephyra-border-surface bg-zephyra-border-hairline/60 text-[8px] text-zephyra-text-muted">Enter ↵</kbd>
              <span>to send</span>
            </div>

            <span className="font-mono text-[8px] md:text-[9px] text-zephyra-text-veryMuted select-none">
              {text.length} / 2000
            </span>

            {isSending ? (
              <motion.button
                type="button"
                onClick={onStop}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 250, damping: 25, mass: 1.2 }}
                aria-label="Stop generation"
                className="h-8 w-8 rounded-full border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors duration-300 flex items-center justify-center focus:outline-none cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.25)]"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </motion.button>
            ) : (
              <motion.button
                type="submit"
                disabled={!text.trim() || isListening}
                whileHover={text.trim() && !isListening ? { scale: 1.05 } : {}}
                whileTap={text.trim() && !isListening ? { scale: 0.95 } : {}}
                transition={{ type: "spring", stiffness: 250, damping: 25, mass: 1.2 }}
                aria-label="Send command"
                className={`h-8 w-8 rounded-full border transition-colors duration-300 flex items-center justify-center focus:outline-none ${
                  text.trim() && !isListening
                    ? "bg-zephyra-accent/10 border-zephyra-accent/30 text-zephyra-accent hover:bg-zephyra-accent hover:text-[#08090D] cursor-pointer shadow-[0_0_12px_rgba(0,229,255,0.25)]"
                    : "bg-transparent border-transparent text-zephyra-text-veryMuted opacity-15 cursor-not-allowed"
                }`}
              >
                <ArrowUp className="h-4 w-4" />
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </form>
  );
};
