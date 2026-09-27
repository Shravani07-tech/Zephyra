import React, { useEffect, useRef } from "react";
import type { Message as MessageType, ResearchMetadata } from "../api/types";
import { Message } from "./Message";

interface MessageListProps {
  messages: MessageType[];
  streamingText?: string;
  pendingResearch?: ResearchMetadata | null;
  isStreaming?: boolean;
  onRetry?: (userMessageId: number) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  streamingText = "",
  pendingResearch = null,
  isStreaming = false,
  onRetry,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  return (
    <div className="flex-1 w-full max-w-[720px] px-4 md:px-0 flex flex-col overflow-y-auto custom-scrollbar pt-6 pb-12">
      
      {/* Persisted message turns */}
      {messages.map((msg) => (
        <Message
          key={msg.id}
          message={msg}
          onRetry={onRetry}
          isStreaming={isStreaming}
        />
      ))}

      {/* Streaming response turn */}
      {isStreaming && streamingText.trim().length > 0 && (
        <Message
          message={{
            id: -1,
            conversation_id: "streaming",
            role: "assistant",
            content: streamingText,
            created_at: new Date().toISOString(),
            metadata: pendingResearch ? { research: pendingResearch } : null,
          }}
          isStreaming={isStreaming}
        />
      )}

      <div ref={bottomRef} />
    </div>
  );
};
