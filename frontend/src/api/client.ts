import type { Conversation, Message } from "./types";

const BASE_URL = "http://127.0.0.1:8000";

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
    text: string,
    onChunk: (chunk: string) => void,
    onConversation: (id: string) => void,
    onError: (err: string) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: text,
        }),
      });

      if (!response.ok) {
        let errDetail = `HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson && errJson.detail) {
            errDetail = errJson.detail;
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
              const errMsg = data.detail || "Provider/API error occurred.";
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
      const errMsg = err.message || "Failed to process message stream.";
      onError(errMsg);
      throw err;
    }
  }
};
