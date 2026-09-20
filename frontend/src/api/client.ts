import type { Conversation, Message } from "./types";

const BASE_URL = "http://127.0.0.1:8000";

function formatErrorDetail(detail: unknown): string {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item && typeof (item as Record<string, unknown>).msg === "string") {
          return (item as Record<string, unknown>).msg as string;
        }
        try {
          return JSON.stringify(item);
        } catch {
          return "";
        }
      })
      .filter(Boolean)
      .join("; ");
  }
  if (typeof detail === "object") {
    if ("msg" in detail && typeof (detail as Record<string, unknown>).msg === "string") {
      return (detail as Record<string, unknown>).msg as string;
    }
    if ("message" in detail && typeof (detail as Record<string, unknown>).message === "string") {
      return (detail as Record<string, unknown>).message as string;
    }
    try {
      return JSON.stringify(detail);
    } catch {
      return "";
    }
  }
  return String(detail);
}

export const mockApiClient = {
  async getConversations(): Promise<Conversation[]> {
    const response = await fetch(`${BASE_URL}/api/conversations`);
    if (!response.ok) {
      throw new Error(`Failed to load conversations: ${response.status} ${response.statusText}`);
    }
    return response.json();
  },

  async getConversationMessages(conversationId: string): Promise<Message[]> {
    const response = await fetch(`${BASE_URL}/api/conversations/${conversationId}/messages`);
    if (!response.ok) {
      throw new Error(`Failed to load messages: ${response.status} ${response.statusText}`);
    }
    return response.json();
  },

  async deleteConversation(conversationId: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/api/conversations/${conversationId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`Failed to delete conversation: ${response.status} ${response.statusText}`);
    }
  },

  async sendMessageStream(
    conversationId: string | null,
    text: string | null,
    onChunk: (chunk: string) => void,
    onConversation: (id: string) => void,
    onError: (err: string) => void,
    signal?: AbortSignal,
    retryMessageId?: number
  ): Promise<void> {
    try {
      const validConvId =
        conversationId && conversationId !== "temp" && conversationId.trim().length > 0
          ? conversationId
          : null;

      const payload: Record<string, unknown> = {
        conversation_id: validConvId,
      };
      if (retryMessageId !== undefined && retryMessageId !== null) {
        payload.retry_message_id = retryMessageId;
      } else {
        payload.message = text;
      }

      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok) {
        let errDetail = `HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson && errJson.detail) {
            const formatted = formatErrorDetail(errJson.detail);
            if (formatted) {
              errDetail = formatted;
            }
          }
        } catch {
          // ignore
        }
        throw new Error(`Server connection failed: ${errDetail}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No readable stream body found in response.");
      }

      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep the last partial line in the buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            const jsonStr = trimmed.slice(6);
            if (!jsonStr) continue;

            let data;
            try {
              data = JSON.parse(jsonStr);
            } catch (err) {
              console.warn("Malformed SSE JSON payload:", jsonStr, err);
              continue; // Skip malformed SSE lines
            }

            if (data.event === "conversation") {
              if (data.conversation_id) {
                onConversation(data.conversation_id);
              }
            } else if (data.event === "chunk") {
              if (data.text) {
                onChunk(data.text);
              }
            } else if (data.event === "error") {
              const errMsg = formatErrorDetail(data.detail) || "Provider/API error occurred.";
              onError(errMsg);
              throw new Error(errMsg);
            } else if (data.event === "done") {
              // Successful stream completion
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err: any) {
      if (err.name === "AbortError" || (err instanceof DOMException && err.name === "AbortError")) {
        throw err;
      }
      let errMsg = "Failed to process message stream.";
      if (typeof err === "string") {
        errMsg = err;
      } else if (err && typeof err === "object" && typeof err.message === "string" && err.message) {
        errMsg = err.message;
      } else if (err) {
        errMsg = formatErrorDetail(err) || errMsg;
      }
      if (errMsg.includes("[object Object]")) {
        errMsg = "Failed to process message stream.";
      }
      onError(errMsg);
      throw new Error(errMsg);
    }
  }
};
