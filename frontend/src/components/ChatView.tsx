import React, { useEffect, useState, useCallback } from "react";
import { Trash2, Terminal, Cpu } from "lucide-react";

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
      <BackgroundAtmosphere status={status} isHistoryOpen={isHistoryOpen} isSystemOpen={isSystemOpen} />

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
        <aside 
          className={`absolute md:relative z-20 w-72 h-full border-r border-zephyra-border-hairline/20 bg-[#08090D]/90 md:bg-transparent backdrop-blur-2xl md:backdrop-blur-none transition-all duration-300 flex flex-col shrink-0 ${
            isHistoryOpen ? "translate-x-0" : "-translate-x-full md:hidden"
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-zephyra-border-hairline/20 flex items-center gap-2 select-none h-[72px]">
            <Terminal className="w-3.5 h-3.5 text-zephyra-accent" />
            <span className="font-mono text-[9px] tracking-[0.2em] text-zephyra-text-muted uppercase">Recent Threads</span>
          </div>

          {/* List Scroll */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
            {conversations.length === 0 ? (
              <div className="p-6 text-center select-none">
                <span className="font-mono text-[9px] text-zephyra-text-veryMuted uppercase tracking-wider">No active threads</span>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group relative w-full flex items-center justify-between p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 overflow-hidden ${
                    activeConversationId === conv.id
                      ? "border-zephyra-border-surface bg-zephyra-border-hairline/40 text-zephyra-text-primary shadow-sm"
                      : "border-transparent text-zephyra-text-muted hover:text-zephyra-text-primary hover:bg-[#1A2235]/15"
                  }`}
                  onClick={() => selectConversation(conv.id)}
                >
                  {/* Left edge active indicator */}
                  {activeConversationId === conv.id && (
                    <div className="absolute left-0 top-1/4 bottom-1/4 w-[1.5px] bg-zephyra-accent" />
                  )}
                  
                  <div className="flex flex-col gap-1 min-w-0 pr-2 pl-1">
                    <span className="font-mono text-[9px] tracking-wide truncate">
                      session_{conv.id.substring(0, 8)}
                    </span>
                    <span className="font-mono text-[8px] text-zephyra-text-veryMuted">
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
                </div>
              ))
            )}
          </div>
        </aside>

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
          />
        </main>

        {/* Right Side: Context & System Monitors */}
        <aside 
          className={`absolute right-0 md:relative z-20 w-72 h-full border-l border-zephyra-border-hairline/20 bg-[#08090D]/90 md:bg-transparent backdrop-blur-2xl md:backdrop-blur-none transition-all duration-300 flex flex-col shrink-0 ${
            isSystemOpen ? "translate-x-0" : "translate-x-full md:hidden"
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-zephyra-border-hairline/20 flex items-center gap-2 select-none h-[72px]">
            <Cpu className="w-3.5 h-3.5 text-zephyra-accent" />
            <span className="font-mono text-[9px] tracking-[0.2em] text-zephyra-text-muted uppercase">System Monitor</span>
          </div>

          {/* Metric details */}
          <div className="p-4 space-y-4 select-none font-mono text-[9px] text-zephyra-text-muted uppercase tracking-widest">
            <div className="space-y-1">
              <span className="text-zephyra-text-veryMuted block">Active Status</span>
              <span className="text-zephyra-text-primary text-xs font-semibold block">{status}</span>
            </div>

            <div className="space-y-1 border-t border-zephyra-border-hairline/15 pt-3">
              <span className="text-zephyra-text-veryMuted block">System Provider</span>
              <span className="text-zephyra-text-primary font-semibold block">{systemConfig.provider}</span>
            </div>

            <div className="space-y-1 border-t border-zephyra-border-hairline/15 pt-3">
              <span className="text-zephyra-text-veryMuted block">Active Core Model</span>
              <span className="text-zephyra-text-primary font-normal block lowercase text-[9px] truncate" title={systemConfig.model}>
                {systemConfig.model}
              </span>
            </div>

            <div className="space-y-1.5 border-t border-zephyra-border-hairline/15 pt-3">
              <span className="text-zephyra-text-veryMuted block">Context Util</span>
              <div className="flex items-center gap-1.5 font-mono text-[8px] tracking-normal lowercase">
                <span className="text-zephyra-accent font-semibold tracking-wider font-mono">[■■□□□□□□□□]</span>
                <span className="text-zephyra-text-primary">0.32%</span>
              </div>
            </div>

            <div className="space-y-2 border-t border-zephyra-border-hairline/15 pt-3">
              <span className="text-zephyra-text-veryMuted block">Loaded Subsystems</span>
              <div className="flex flex-wrap gap-1.5 lowercase tracking-normal">
                <span className="px-1.5 py-0.5 rounded border border-zephyra-border-surface/40 bg-zephyra-border-hairline/30 text-zephyra-text-muted">memory</span>
                <span className="px-1.5 py-0.5 rounded border border-zephyra-border-surface/40 bg-zephyra-border-hairline/30 text-zephyra-text-muted">speech-api</span>
                <span className="px-1.5 py-0.5 rounded border border-zephyra-border-surface/40 bg-zephyra-border-hairline/30 text-zephyra-text-muted">voice-input</span>
              </div>
            </div>

            <div className="space-y-1 border-t border-zephyra-border-hairline/15 pt-3">
              <span className="text-zephyra-text-veryMuted block">Visual Shell Engine</span>
              <div className="flex items-center gap-1.5 text-zephyra-text-primary font-normal">
                <span className="h-1.5 w-1.5 rounded-full bg-zephyra-accent animate-pulse-subtle inline-block" />
                <span>operational</span>
              </div>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
};

