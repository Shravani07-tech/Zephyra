import { useEffect, useState, useRef } from "react";

import { mockApiClient } from "../api/client";
import type { Conversation, Message } from "../api/types";
import { useSpeech } from "./useSpeech";

export type SemanticStatus = "Standby" | "Listening" | "Thinking" | "Processing" | "Speaking";

export function useChatStream() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [streamingText, setStreamingText] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [status, setStatus] = useState<SemanticStatus>("Standby");

  const activeRequestIdRef = useRef<number | null>(null);
  const shouldPreventLoadRef = useRef<boolean>(false);

  const { speak, stop: stopSpeech } = useSpeech({
    onEnd: () => {
      setStatus((prev) => (prev === "Speaking" ? "Standby" : prev));
    },
  });

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
    if (shouldPreventLoadRef.current) {
      shouldPreventLoadRef.current = false;
      return;
    }

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
    stopSpeech();
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

  const sendMessage = async (text: string, isVoice: boolean = false) => {
    if (!text.trim() || isStreaming) {
      if (!text.trim()) {
        setStatus("Standby");
      }
      return;
    }

    const currentRequestId = Date.now();
    activeRequestIdRef.current = currentRequestId;

    // Interrupt/cancel previous speech when a new message starts
    stopSpeech();

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
    let hasReceivedChunk = false;

    try {
      await mockApiClient.sendMessageStream(
        activeConversationId,
        text,
        (chunk) => {
          if (activeRequestIdRef.current !== currentRequestId) return;

          if (!hasReceivedChunk) {
            hasReceivedChunk = true;
            setStatus("Processing");
          }
          setStreamingText((prev) => prev + chunk);
        },
        (newId) => {
          if (activeRequestIdRef.current !== currentRequestId) return;
          resolvedId = newId;
          if (activeConversationId !== newId) {
            shouldPreventLoadRef.current = true;
            setActiveConversationId(newId);
          }
          loadConversations();
        },
        (errorMsg) => {
          console.error("Stream error:", errorMsg);
        }
      );

      if (activeRequestIdRef.current !== currentRequestId) return;

      // Re-fetch persisted message history upon stream success
      let finalMessages: Message[] = [];
      if (resolvedId) {
        finalMessages = await mockApiClient.getConversationMessages(resolvedId);
        setMessages(finalMessages);
      }

      // Stream completed successfully. Handle TTS if requested
      if (isVoice) {
        const assistantMessage = finalMessages.findLast((m) => m.role === "assistant") || 
          (finalMessages.length > 0 ? finalMessages[finalMessages.length - 1] : null);
        const speakText = assistantMessage?.content || "";
        if (speakText) {
          setStatus("Speaking");
          speak(speakText);
        } else {
          setStatus("Standby");
        }
      } else {
        setStatus("Standby");
      }
    } catch (err) {
      console.error("Failed to execute message stream", err);
      if (activeRequestIdRef.current === currentRequestId) {
        setStatus("Standby");
      }
    } finally {
      if (activeRequestIdRef.current === currentRequestId) {
        setIsStreaming(false);
        setStreamingText("");
      }
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
    stopSpeech,
  };
}
