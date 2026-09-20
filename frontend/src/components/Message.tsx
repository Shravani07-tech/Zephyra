import React from "react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import { RotateCcw, AlertTriangle } from "lucide-react";
import type { Message as MessageType } from "../api/types";

interface MessageProps {
  message: MessageType;
  onRetry?: (userMessageId: number) => void;
  isStreaming?: boolean;
}

export const Message: React.FC<MessageProps> = ({ message, onRetry, isStreaming = false }) => {
  const isUser = message.role === "user";

  const handleAction = () => {
    if (isStreaming || !onRetry) return;
    const targetId = isUser ? message.id : message.userMessageId;
    if (targetId !== undefined) {
      onRetry(targetId);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`w-full flex flex-col py-4 ${
        isUser ? "items-end" : "items-start"
      }`}
    >
      <div className="w-full">
        {/* Technical mono label */}
        <div className={`flex items-center gap-2 font-mono text-[8px] md:text-[9px] tracking-widest uppercase text-zephyra-text-veryMuted mb-2 select-none ${
          isUser ? "justify-end pr-4" : "justify-start pl-4"
        }`}>
          {!isUser && (
            <span className="h-1.5 w-1.5 rounded-full bg-zephyra-accent shadow-[0_0_8px_rgba(0,229,255,0.45)]" />
          )}
          <span>{isUser ? "User Node" : "System Output"}</span>
        </div>

        {/* Message Accent Rails (No Bubbles) */}
        {isUser ? (
          <div className="border-r-2 border-zephyra-border-surface/40 pr-4 py-0.5 text-right w-full flex flex-col items-end">
            <div className="font-sans leading-relaxed text-sm tracking-wide text-zephyra-text-secondary font-light whitespace-pre-wrap break-words max-w-[620px]">
              {message.content}
            </div>

            {/* User message failure state action */}
            {message.isError && (
              <div className="mt-2 flex items-center gap-2">
                <span className="font-mono text-[10px] text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {message.errorText || "Generation failed"}
                </span>
                <button
                  type="button"
                  onClick={handleAction}
                  disabled={isStreaming}
                  className="px-2.5 py-1 rounded border border-red-800/50 bg-red-950/30 hover:bg-red-900/50 text-red-300 font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            {/* User message aborted state (if no assistant partial text) */}
            {message.isAborted && (
              <div className="mt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleAction}
                  disabled={isStreaming}
                  className="px-2.5 py-1 rounded border border-zephyra-accent/40 bg-zephyra-accent/10 hover:bg-zephyra-accent/20 text-zephyra-accent font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Regenerate</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="border-l-2 border-zephyra-accent/40 pl-4 py-0.5 text-left">
            <div className="font-sans leading-relaxed text-sm tracking-wide text-zephyra-text-primary font-normal break-words">
              <ReactMarkdown
                components={{
                  h1: (props) => <h1 className="text-base font-bold my-3 text-zephyra-accent" {...props} />,
                  h2: (props) => <h2 className="text-sm font-bold my-2 text-zephyra-accent" {...props} />,
                  h3: (props) => <h3 className="text-xs font-bold my-1 text-zephyra-text-primary" {...props} />,
                  p: (props) => <p className="mb-2 leading-relaxed" {...props} />,
                  ul: (props) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
                  ol: (props) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
                  li: (props) => <li className="pl-0.5 mb-0.5" {...props} />,
                  pre: (props) => <pre className="bg-[#08090D]/60 border border-zephyra-border-surface/40 p-3 rounded-lg overflow-x-auto my-3 font-mono text-xs text-zephyra-text-primary custom-scrollbar" {...props} />,
                  code: ({ className, children, ...props }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="bg-[#1A2235]/40 text-zephyra-accent px-1.5 py-0.5 rounded font-mono text-[11px]" {...props}>
                        {children}
                      </code>
                    ) : (
                      <code className="font-mono text-xs text-zephyra-text-primary" {...props}>
                        {children}
                      </code>
                    );
                  },
                  a: (props) => <a className="text-zephyra-accent hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>

            {/* Assistant message aborted state action */}
            {message.isAborted && (
              <div className="mt-3 flex items-center gap-2 select-none">
                <span className="font-mono text-[9px] text-zephyra-text-veryMuted uppercase tracking-wider">Generation Stopped</span>
                <button
                  type="button"
                  onClick={handleAction}
                  disabled={isStreaming}
                  className="px-2.5 py-1 rounded border border-zephyra-accent/40 bg-zephyra-accent/10 hover:bg-zephyra-accent/20 text-zephyra-accent font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Regenerate</span>
                </button>
              </div>
            )}

            {/* Assistant message error state action */}
            {message.isError && (
              <div className="mt-3 flex items-center gap-2 select-none">
                <span className="font-mono text-[9px] text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {message.errorText || "Error occurred"}
                </span>
                <button
                  type="button"
                  onClick={handleAction}
                  disabled={isStreaming}
                  className="px-2.5 py-1 rounded border border-red-800/50 bg-red-950/30 hover:bg-red-900/50 text-red-300 font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
