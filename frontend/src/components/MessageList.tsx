import React, { useEffect, useRef } from "react";
import type { Message as MessageType } from "../api/types";
import { Message } from "./Message";

interface MessageListProps {
  messages: MessageType[];
  streamingText?: string;
  isStreaming?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  streamingText = "",
  isStreaming = false,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  return (
    <div className="flex-1 w-full max-w-[720px] px-4 md:px-0 flex flex-col overflow-y-auto custom-scrollbar pt-6 pb-12">
      
      {/* Persisted message turns */}
      {messages.map((msg) => (
        <Message key={msg.id} message={msg} />
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
          }}
        />
      )}

      <div ref={bottomRef} />
    </div>
  );
};
