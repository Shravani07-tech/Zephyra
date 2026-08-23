import React, { useEffect, useState, useCallback } from "react";
import { Trash2, Terminal, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { useChatStream } from "../hooks/useChatStream";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { Composer } from "./Composer";
import { EmptyState } from "./EmptyState";
import { MessageList } from "./MessageList";
import { NavBar } from "./NavBar";
import { BackgroundAtmosphere } from "./BackgroundAtmosphere";

export const ChatView: React.FC = () => {
  const {
    messages,
    conversations,
    activeConversationId,
    streamingText,
    isStreaming,
    status,
    setStatus,
    sendMessage,
    createNewConversation,
    selectConversation,
    deleteConversation,
    stopSpeech,
  } = useChatStream();

  const { isListening, volume, toggleListening } = useVoiceInput(
    (transcript) => {
      sendMessage(transcript, true);
    },
    (errorMsg) => {
      console.error("Voice input error:", errorMsg);
      setStatus("Standby");
      alert(`Microphone Error: ${errorMsg}`);
    }
  );

  const handleVoiceToggle = useCallback(() => {
    if (!isListening) {
      stopSpeech();
      setStatus("Listening");
    }
    toggleListening();
  }, [isListening, stopSpeech, setStatus, toggleListening]);

  // Sidebar Layout States
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSystemOpen, setIsSystemOpen] = useState(false);

  // Dynamic System Config State
  const [systemConfig, setSystemConfig] = useState({
    provider: "NVIDIA",
    model: "meta/llama-3.1-8b-instruct",
    status: "standby",
  });

  useEffect(() => {
    let active = true;
    const fetchSystemStatus = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/system/status");
        if (response.ok && active) {
          const data = await response.json();
          setSystemConfig(data);
        }
      } catch (err) {
        console.warn("Could not retrieve backend system status, using safe local defaults:", err);
      }
    };
    fetchSystemStatus();
    return () => {
      active = false;
    };
  }, []);

  // Sync vocal recording states to ambient global status safely
  useEffect(() => {
    if (!isListening) {
      setStatus((prev) => (prev === "Listening" ? "Standby" : prev));
    }
  }, [isListening, setStatus]);

  // Global space key handler for immediate voice interaction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        handleVoiceToggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleVoiceToggle]);

  const hasMessages = messages.length > 0 || isStreaming;

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) + ' ' + date.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
  };

  return (
    <div className="h-full w-full flex flex-col bg-zephyra-bg text-zephyra-text-primary overflow-hidden relative">
      {/* Atmospheric dynamic canvas layer */}
      <BackgroundAtmosphere status={status} isHistoryOpen={isHistoryOpen} isSystemOpen={isSystemOpen} volume={volume} isListening={isListening} />

      {/* Top Banner Control */}
      <NavBar
        status={status}
        onNewChat={createNewConversation}
        isHistoryOpen={isHistoryOpen}
        isSystemOpen={isSystemOpen}
        onToggleHistory={() => setIsHistoryOpen(!isHistoryOpen)}
        onToggleSystem={() => setIsSystemOpen(!isSystemOpen)}
      />

      <div className="flex-1 w-full flex overflow-hidden relative z-10">
        
        {/* Left Side: Conversation Threads History */}
        <AnimatePresence initial={false}>
          {isHistoryOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 288, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-0 md:relative z-20 h-full border-r border-zephyra-border-hairline/20 bg-[#08090D]/95 md:bg-transparent backdrop-blur-2xl md:backdrop-blur-none flex flex-col shrink-0 overflow-hidden"
            >
              <div className="w-72 h-full flex flex-col">
                {/* Header aligned to 64px NavBar */}
                <div className="p-4 border-b border-zephyra-border-hairline/20 flex items-center gap-2 select-none h-[64px]">
                  <Terminal className="w-3.5 h-3.5 text-zephyra-accent" />
                  <span className="font-mono text-[9px] tracking-[0.2em] text-zephyra-text-muted uppercase">Recent Threads</span>
                </div>

                {/* List Scroll */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                  {conversations.length === 0 ? (
                    <div className="p-6 text-center select-none">
                      <span className="font-mono text-[8px] text-zephyra-text-veryMuted uppercase tracking-widest">No active threads</span>
                    </div>
                  ) : (
                    conversations.map((conv) => (
                      <motion.div
                        key={conv.id}
                        whileHover={{ backgroundColor: "rgba(26, 34, 53, 0.2)" }}
                        transition={{ duration: 0.2 }}
                        className={`group relative w-full flex items-center justify-between p-3 rounded-md border text-left cursor-pointer border-b border-zephyra-border-hairline/15 ${
                          activeConversationId === conv.id
                            ? "border-zephyra-border-surface/40 bg-zephyra-border-hairline/35 text-zephyra-text-primary shadow-xs"
                            : "border-transparent text-zephyra-text-muted hover:text-zephyra-text-primary"
                        }`}
                        onClick={() => selectConversation(conv.id)}
                      >
                        {/* Left edge active indicator */}
                        {activeConversationId === conv.id && (
                          <div className="absolute left-0 top-1/4 bottom-1/4 w-[1px] bg-zephyra-accent" />
                        )}

                        <div className="flex flex-col gap-0.5 min-w-0 pr-2 pl-1 font-mono">
                          <span className="text-[9px] tracking-wide truncate">
                            session_{conv.id.substring(0, 8)}
                          </span>
                          <span className="text-[8px] text-zephyra-text-veryMuted">
                            {formatTime(conv.created_at)}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conv.id);
                          }}
                          aria-label="Delete thread"
                          className="p-1 rounded text-zephyra-text-veryMuted hover:text-red-400 hover:bg-red-950/20 opacity-0 group-hover:opacity-100 transition-all border-0 bg-transparent cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Interaction Feed */}
        <main className="flex-1 flex flex-col items-center justify-between overflow-hidden relative">
          {hasMessages ? (
            <MessageList
              messages={messages}
              streamingText={streamingText}
              isStreaming={isStreaming}
            />
          ) : (
            <EmptyState
              onMicClick={handleVoiceToggle}
              status={status}
              isListening={isListening}
              volume={volume}
            />
          )}

          <Composer
            onSend={sendMessage}
            onMicClick={handleVoiceToggle}
            isListening={isListening}
            isSending={isStreaming}
            volume={volume}
            status={status}
          />
        </main>

        {/* Right Side: Context & System Monitors */}
        <AnimatePresence initial={false}>
          {isSystemOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 288, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 md:relative z-20 h-full border-l border-zephyra-border-hairline/20 bg-[#08090D]/95 md:bg-transparent backdrop-blur-2xl md:backdrop-blur-none flex flex-col shrink-0 overflow-hidden"
            >
              <div className="w-72 h-full flex flex-col">
                {/* Header aligned to 64px NavBar */}
                <div className="p-4 border-b border-zephyra-border-hairline/20 flex items-center gap-2 select-none h-[64px]">
                  <Cpu className="w-3.5 h-3.5 text-zephyra-accent" />
                  <span className="font-mono text-[9px] tracking-[0.2em] text-zephyra-text-muted uppercase">System Monitor</span>
                </div>

                {/* Telemetry Metric details (Structured tabular telemetry) */}
                <div className="p-4 space-y-2 select-none font-mono text-[9px] text-zephyra-text-muted uppercase tracking-widest text-left">
                  <div className="grid grid-cols-2 py-2 border-b border-zephyra-border-hairline/15">
                    <span className="text-zephyra-text-veryMuted">STATUS</span>
                    <span className="text-zephyra-text-primary font-semibold text-right">{status}</span>
                  </div>

                  <div className="grid grid-cols-2 py-2 border-b border-zephyra-border-hairline/15">
                    <span className="text-zephyra-text-veryMuted">PROVIDER</span>
                    <span className="text-zephyra-text-primary font-semibold text-right">{systemConfig.provider}</span>
                  </div>

                  <div className="flex flex-col gap-1 py-2.5 border-b border-zephyra-border-hairline/15">
                    <span className="text-zephyra-text-veryMuted">CORE MODEL</span>
                    <span className="text-zephyra-text-primary font-light lowercase text-[8px] truncate mt-0.5 block" title={systemConfig.model}>
                      {systemConfig.model}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 py-2 border-b border-zephyra-border-hairline/15">
                    <span className="text-zephyra-text-veryMuted">CONTEXT UTIL</span>
                    <div className="flex items-center justify-end gap-1 font-mono text-[8px] tracking-normal lowercase text-right">
                      <span className="text-zephyra-accent font-semibold tracking-wider font-mono">[■■□□□□]</span>
                      <span className="text-zephyra-text-primary">0.32%</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 py-2.5 border-b border-zephyra-border-hairline/15">
                    <span className="text-zephyra-text-veryMuted">SUBSYSTEMS</span>
                    <div className="flex flex-wrap gap-1.5 lowercase tracking-normal mt-1">
                      <span className="px-1.5 py-0.5 rounded border border-zephyra-border-surface/40 bg-zephyra-border-hairline/30 text-zephyra-text-muted text-[8px]">memory</span>
                      <span className="px-1.5 py-0.5 rounded border border-zephyra-border-surface/40 bg-zephyra-border-hairline/30 text-zephyra-text-muted text-[8px]">speech-api</span>
                      <span className="px-1.5 py-0.5 rounded border border-zephyra-border-surface/40 bg-zephyra-border-hairline/30 text-zephyra-text-muted text-[8px]">voice-input</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 py-2 border-b border-zephyra-border-hairline/15">
                    <span className="text-zephyra-text-veryMuted">SHELL ENGINE</span>
                    <span className="text-zephyra-accent font-normal text-right">OPERATIONAL</span>
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};
