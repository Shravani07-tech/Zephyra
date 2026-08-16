import type { Conversation, Message } from "./types";

// Mock in-memory database store for design shell testing
let mockConversations: Conversation[] = [
  {
    id: "a52c3c90-efeb-4c8d-8fe3-1b9193b2a59a",
    created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  }
];

let mockMessages: Record<string, Message[]> = {
  "a52c3c90-efeb-4c8d-8fe3-1b9193b2a59a": [
    {
      id: 1,
      conversation_id: "a52c3c90-efeb-4c8d-8fe3-1b9193b2a59a",
      role: "user",
      content: "Hello Zephyra. Status update.",
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 2,
      conversation_id: "a52c3c90-efeb-4c8d-8fe3-1b9193b2a59a",
      role: "assistant",
      content: "Quiet Intelligence shell active. Real LLM connection mapped. Standing by for commands.",
      created_at: new Date(Date.now() - 3590000).toISOString(),
    }
  ]
};

export const mockApiClient = {
  async getConversations(): Promise<Conversation[]> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return [...mockConversations].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async getConversationMessages(conversationId: string): Promise<Message[]> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return [...(mockMessages[conversationId] || [])].sort((a, b) => a.id - b.id);
  },

  async deleteConversation(conversationId: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    mockConversations = mockConversations.filter((c) => c.id !== conversationId);
    delete mockMessages[conversationId];
  },

  async sendMessageStream(
    conversationId: string | null,
    text: string,
    onChunk: (chunk: string) => void,
    onConversation: (id: string) => void,
    onError: (err: string) => void
  ): Promise<void> {
    // Simulate initial latency
    await new Promise((resolve) => setTimeout(resolve, 400));

    let activeId = conversationId;
    if (!activeId) {
      activeId = "mock-" + Math.random().toString(36).substring(2, 15);
      const newConv: Conversation = {
        id: activeId,
        created_at: new Date().toISOString(),
      };
      mockConversations.push(newConv);
      mockMessages[activeId] = [];
      onConversation(activeId);
    }

    // Append User Message
    const userMsg: Message = {
      id: Date.now(),
      conversation_id: activeId,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    mockMessages[activeId].push(userMsg);

    // Simulate streaming reply chunks
    const replyText = `Zephyra Lite online. Received command: "${text}". Voice-first visual layers are active and standby modes are operational.`;
    const words = replyText.split(" ");
    let currentResponse = "";

    try {
      for (let i = 0; i < words.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 60 + Math.random() * 50));
        const chunk = (i > 0 ? " " : "") + words[i];
        currentResponse += chunk;
        onChunk(chunk);
      }

      // Append final Assistant Message
      const assistantMsg: Message = {
        id: Date.now() + 1,
        conversation_id: activeId,
        role: "assistant",
        content: currentResponse,
        created_at: new Date().toISOString(),
      };
      mockMessages[activeId].push(assistantMsg);

    } catch {
      onError("Streaming session disconnected unexpectedly.");
    }
  }
};
