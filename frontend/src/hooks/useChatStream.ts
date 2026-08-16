import { useEffect, useState } from "react";

import { mockApiClient } from "../api/client";
import type { Conversation, Message } from "../api/types";

export type SemanticStatus = "Standby" | "Listening" | "Thinking" | "Processing" | "Speaking";

export function useChatStream() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [streamingText, setStreamingText] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [status, setStatus] = useState<SemanticStatus>("Standby");

  const loadConversations = async () => {
    try {
      const data = await mockApiClient.getConversations();
      setConversations(data);
    } catch (e) {
      console.error("Failed to load conversations", e);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadConversations();
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (activeConversationId) {
      const loadMessages = async () => {
        try {
          const data = await mockApiClient.getConversationMessages(activeConversationId);
          setMessages(data);
        } catch (e) {
          console.error("Failed to load messages", e);
        }
      };
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [activeConversationId]);

  const selectConversation = async (id: string | null) => {
    setActiveConversationId(id);
    setStreamingText("");
    setIsStreaming(false);
    setStatus("Standby");
  };

  const deleteConversation = async (id: string) => {
    await mockApiClient.deleteConversation(id);
    await loadConversations();
    if (activeConversationId === id) {
      selectConversation(null);
    }
  };

  const createNewConversation = () => {
    selectConversation(null);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    setStatus("Thinking");
    setIsStreaming(true);
    setStreamingText("");

    // Append local user message immediately
    const localUserMsg: Message = {
      id: Date.now(),
      conversation_id: activeConversationId || "temp",
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, localUserMsg]);

    let resolvedId = activeConversationId;

    try {
      await mockApiClient.sendMessageStream(
        activeConversationId,
        text,
        (chunk) => {
          setStatus("Speaking");
          setStreamingText((prev) => prev + chunk);
        },
        (newId) => {
          resolvedId = newId;
          setActiveConversationId(newId);
          loadConversations();
        },
        (errorMsg) => {
          console.error("Stream error:", errorMsg);
        }
      );

      // Re-fetch persisted message history upon stream success
      if (resolvedId) {
        const finalMessages = await mockApiClient.getConversationMessages(resolvedId);
        setMessages(finalMessages);
      }
    } catch (err) {
      console.error("Failed to execute message stream", err);
    } finally {
      setIsStreaming(false);
      setStreamingText("");
      setStatus("Standby");
    }
  };

  return {
    conversations,
    activeConversationId,
    messages,
    loading,
    streamingText,
    isStreaming,
    status,
    setStatus,
    sendMessage,
    selectConversation,
    deleteConversation,
    createNewConversation,
  };
}
