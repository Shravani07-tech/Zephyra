export interface Message {
  id: number;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  isError?: boolean;
  isAborted?: boolean;
  errorText?: string;
  userMessageId?: number;
}

export interface Conversation {
  id: string;
  created_at: string;
}
