import { useEffect, useState, useRef } from "react";

import { mockApiClient } from "../api/client";
import type { Conversation, Message, ResearchMetadata } from "../api/types";
import { advanceToThinking } from "./chatStatus";
import { findPersistedUserMessage, reconcileUserMessageId } from "./reconcile";
import { createRequestTracker } from "./requestTracker";
import { useSpeech } from "./useSpeech";

export type SemanticStatus = "IDLE" | "AWAKENING" | "THINKING" | "GENERATING" | "COMPLETING" | "ERROR" | "ABORTED" | "LISTENING" | "SPEAKING" | "PAUSED";

export function useChatStream() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [streamingText, setStreamingText] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [pendingResearch, setPendingResearch] = useState<ResearchMetadata | null>(null);
  const [status, setStatus] = useState<SemanticStatus>("IDLE");

  // Only the current request may update state; see requestTracker.ts.
  const [requests] = useState(createRequestTracker);
  const shouldPreventLoadRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingTextRef = useRef<string>("");

  const {
    voiceState,
    speak,
    pause: pauseSpeech,
    resume: resumeSpeech,
    stop: stopSpeech,
  } = useSpeech({
    onEnd: () => {
      setStatus((prev) => (prev === "SPEAKING" || prev === "PAUSED" ? "IDLE" : prev));
    },
  });

  const pauseVoice = () => {
    pauseSpeech();
    setStatus((prev) => (prev === "SPEAKING" ? "PAUSED" : prev));
  };

  const resumeVoice = () => {
    resumeSpeech();
    setStatus((prev) => (prev === "PAUSED" ? "SPEAKING" : prev));
  };

  const stopVoice = () => {
    stopSpeech();
    setStatus((prev) => (prev === "SPEAKING" || prev === "PAUSED" ? "IDLE" : prev));
  };

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
    // Invalidate first so a stream still winding down cannot touch the new view.
    requests.invalidate();
    setActiveConversationId(id);
    setStreamingText("");
    setPendingResearch(null);
    streamingTextRef.current = "";
    setIsStreaming(false);
    setStatus("IDLE");
    stopSpeech();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const deleteConversation = async (id: string) => {
    await mockApiClient.deleteConversation(id);
    await loadConversations();
    if (activeConversationId === id) {
      selectConversation(null);
    }
  };

  /** The active conversation's ID, creating an empty conversation if needed. */
  const ensureConversation = async (): Promise<string> => {
    if (activeConversationId) return activeConversationId;
    const conversation = await mockApiClient.createConversation();
    setActiveConversationId(conversation.id);
    loadConversations();
    return conversation.id;
  };

  const createNewConversation = () => {
    selectConversation(null);
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // The server saves a user turn before streaming its reply, but an aborted send
  // never refetches history. Adopt the persisted ID so Regenerate can target it.
  const adoptPersistedUserId = async (
    conversationId: string,
    localId: number,
    content: string,
    requestId: number
  ) => {
    try {
      const history = await mockApiClient.getConversationMessages(conversationId);
      const persisted = findPersistedUserMessage(history, content);
      if (!persisted || !requests.isCurrent(requestId)) return;
      setMessages((prev) => reconcileUserMessageId(prev, localId, persisted));
    } catch (e) {
      console.warn("Could not reconcile aborted message with server history", e);
    }
  };

  const sendMessage = async (text: string, isVoice: boolean = false) => {
    if (!text.trim() || isStreaming) {
      if (!text.trim()) {
        setStatus("IDLE");
      }
      return;
    }

    const currentRequestId = requests.begin();
    streamingTextRef.current = "";

    // Interrupt/cancel previous speech when a new message starts
    stopSpeech();

    setStatus("AWAKENING");
    setTimeout(() => {
      if (requests.isCurrent(currentRequestId)) setStatus(advanceToThinking);
    }, 400);
    setIsStreaming(true);
    setStreamingText("");
    setPendingResearch(null);

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
    let aborted = false;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await mockApiClient.sendMessageStream({
        conversationId: activeConversationId,
        text,
        signal: controller.signal,
        onChunk: (chunk) => {
          if (!requests.isCurrent(currentRequestId)) return;

          if (!hasReceivedChunk) {
            hasReceivedChunk = true;
            setStatus("GENERATING");
          }
          const nextText = streamingTextRef.current + chunk;
          streamingTextRef.current = nextText;
          setStreamingText(nextText);
        },
        onConversation: (newId) => {
          if (!requests.isCurrent(currentRequestId)) return;
          resolvedId = newId;
          if (activeConversationId !== newId) {
            shouldPreventLoadRef.current = true;
            setActiveConversationId(newId);
          }
          loadConversations();
        },
        onCitations: (research) => {
          if (!requests.isCurrent(currentRequestId)) return;
          setPendingResearch(research);
        },
        onError: (errorMsg) => {
          console.error("Stream error:", errorMsg);
        },
      });

      if (!requests.isCurrent(currentRequestId)) return;

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
          setStatus("SPEAKING");
          speak(speakText);
        } else {
          setStatus("IDLE");
        }
      } else {
        setStatus("COMPLETING");
        setTimeout(() => {
          if (requests.isCurrent(currentRequestId)) setStatus("IDLE");
        }, 800);
      }
    } catch (err: any) {
      if (err.name === "AbortError" || (err instanceof DOMException && err.name === "AbortError")) {
        aborted = true;
      } else {
        console.error("Failed to execute message stream", err);
        if (requests.isCurrent(currentRequestId)) {
          const errorMsg = err.message || "Failed to process message stream.";
          if (resolvedId) {
            try {
              const dbMsgs = await mockApiClient.getConversationMessages(resolvedId);
              setMessages(
                dbMsgs.map((m, idx) =>
                  idx === dbMsgs.length - 1 && m.role === "user"
                    ? { ...m, isError: true, errorText: errorMsg }
                    : m
                )
              );
            } catch {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === localUserMsg.id ? { ...m, isError: true, errorText: errorMsg } : m
                )
              );
            }
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === localUserMsg.id ? { ...m, isError: true, errorText: errorMsg } : m
              )
            );
          }
        }
      }
      if (requests.isCurrent(currentRequestId)) {
        setStatus("ERROR");
        setTimeout(() => {
          if (requests.isCurrent(currentRequestId)) setStatus("IDLE");
        }, 2000);
      }
    } finally {
      if (requests.isCurrent(currentRequestId)) {
        setIsStreaming(false);
        if (aborted) {
          setStatus("ABORTED");
          setTimeout(() => {
            if (requests.isCurrent(currentRequestId)) setStatus("IDLE");
          }, 2000);
          // Keep the already-generated portion of the assistant response visible
          if (streamingTextRef.current.trim().length > 0) {
            const abortedAssistantMsg: Message = {
              id: Date.now(),
              conversation_id: resolvedId || activeConversationId || "temp",
              role: "assistant",
              content: streamingTextRef.current,
              created_at: new Date().toISOString(),
              isAborted: true,
              userMessageId: localUserMsg.id,
            };
            setMessages((prev) => [...prev, abortedAssistantMsg]);
          } else {
            setMessages((prev) =>
              prev.map((m) => (m.id === localUserMsg.id ? { ...m, isAborted: true } : m))
            );
          }
          if (resolvedId) {
            void adoptPersistedUserId(resolvedId, localUserMsg.id, text, currentRequestId);
          }
        }
        setStreamingText("");
        abortControllerRef.current = null;
      }
      // The first message titles a new conversation; refresh the list.
      void loadConversations();
    }
  };

  const retryMessage = async (userMessageId: number) => {
    if (isStreaming) return;

    // Find the target user message
    const userMsg =
      messages.find((m) => m.id === userMessageId && m.role === "user") ||
      messages.find((m) => m.id === userMessageId);
    if (!userMsg || userMsg.role !== "user") return;

    const currentRequestId = requests.begin();
    streamingTextRef.current = "";

    stopSpeech();

    setStatus("AWAKENING");
    setTimeout(() => {
      if (requests.isCurrent(currentRequestId)) setStatus(advanceToThinking);
    }, 400);
    setIsStreaming(true);
    setStreamingText("");
    setPendingResearch(null);

    // Remove transient assistant output for this turn & clear error state from user message
    setMessages((prev) => {
      const targetIndex = prev.findIndex((m) => m.id === userMsg.id && m.role === "user");
      if (targetIndex === -1) return prev;

      const updated = [...prev];
      updated[targetIndex] = {
        ...updated[targetIndex],
        isError: undefined,
        isAborted: undefined,
        errorText: undefined,
      };

      // Remove any subsequent transient assistant message for this user turn
      if (targetIndex + 1 < updated.length && updated[targetIndex + 1].role === "assistant") {
        const nextMsg = updated[targetIndex + 1];
        if (nextMsg.isAborted || nextMsg.isError || nextMsg.userMessageId === userMsg.id) {
          updated.splice(targetIndex + 1, 1);
        }
      }
      return updated;
    });

    let resolvedId = userMsg.conversation_id !== "temp" ? userMsg.conversation_id : activeConversationId;
    if (resolvedId === "temp") {
      resolvedId = null;
    }
    let hasReceivedChunk = false;

    let aborted = false;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await mockApiClient.sendMessageStream({
        conversationId: resolvedId,
        retryMessageId: userMsg.id,
        signal: controller.signal,
        onChunk: (chunk) => {
          if (!requests.isCurrent(currentRequestId)) return;

          if (!hasReceivedChunk) {
            hasReceivedChunk = true;
            setStatus("GENERATING");
          }
          const nextText = streamingTextRef.current + chunk;
          streamingTextRef.current = nextText;
          setStreamingText(nextText);
        },
        onConversation: (newId) => {
          if (!requests.isCurrent(currentRequestId)) return;
          resolvedId = newId;
          if (activeConversationId !== newId) {
            shouldPreventLoadRef.current = true;
            setActiveConversationId(newId);
          }
          loadConversations();
        },
        onCitations: (research) => {
          if (!requests.isCurrent(currentRequestId)) return;
          setPendingResearch(research);
        },
        onError: (errorMsg) => {
          console.error("Stream retry error:", errorMsg);
        },
      });

      if (!requests.isCurrent(currentRequestId)) return;

      // Synchronize with authoritative backend conversation history on completion
      let finalMessages: Message[] = [];
      if (resolvedId) {
        finalMessages = await mockApiClient.getConversationMessages(resolvedId);
        setMessages(finalMessages);
      }
      setStatus("COMPLETING");
      setTimeout(() => {
        if (requests.isCurrent(currentRequestId)) setStatus("IDLE");
      }, 800);
    } catch (err: any) {
      if (err.name === "AbortError" || (err instanceof DOMException && err.name === "AbortError")) {
        aborted = true;
      } else {
        console.error("Failed to execute retry stream", err);
        if (requests.isCurrent(currentRequestId)) {
          const errorMsg = err.message || "Retry failed.";
          setMessages((prev) =>
            prev.map((m) => (m.id === userMsg.id ? { ...m, isError: true, errorText: errorMsg } : m))
          );
        }
      }
      if (requests.isCurrent(currentRequestId)) {
        setStatus("ERROR");
        setTimeout(() => {
          if (requests.isCurrent(currentRequestId)) setStatus("IDLE");
        }, 2000);
      }
    } finally {
      if (requests.isCurrent(currentRequestId)) {
        setIsStreaming(false);
        if (aborted) {
          setStatus("ABORTED");
          setTimeout(() => {
            if (requests.isCurrent(currentRequestId)) setStatus("IDLE");
          }, 2000);
          if (streamingTextRef.current.trim().length > 0) {
            const abortedAssistantMsg: Message = {
              id: Date.now(),
              conversation_id: resolvedId || activeConversationId || "temp",
              role: "assistant",
              content: streamingTextRef.current,
              created_at: new Date().toISOString(),
              isAborted: true,
              userMessageId: userMsg.id,
            };
            setMessages((prev) => [...prev, abortedAssistantMsg]);
          } else {
            setMessages((prev) =>
              prev.map((m) => (m.id === userMsg.id ? { ...m, isAborted: true } : m))
            );
          }
        }
        setStreamingText("");
        setPendingResearch(null);
        abortControllerRef.current = null;
      }
    }
  };

  return {
    conversations,
    activeConversationId,
    messages,
    loading,
    streamingText,
    pendingResearch,
    isStreaming,
    status,
    setStatus,
    sendMessage,
    retryMessage,
    stopGeneration,
    selectConversation,
    deleteConversation,
    createNewConversation,
    ensureConversation,
    voiceState,
    pauseVoice,
    resumeVoice,
    stopVoice,
    stopSpeech,
    speak,
  };
}
