/** A citation validated by the server against its per-run source registry. */
export interface Citation {
  source_id: string;
  title: string;
  url: string;
  retrieved_at: string;
}

export interface ResearchMetadata {
  run_id: string;
  citations: Citation[];
  rejected_markers: number;
}

/** Server-built structured metadata. Never derived from model text. */
export interface MessageMetadata {
  research?: ResearchMetadata;
}

export interface Message {
  id: number;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  metadata?: MessageMetadata | null;
  isError?: boolean;
  isAborted?: boolean;
  errorText?: string;
  userMessageId?: number;
}

export interface Conversation {
  id: string;
  created_at: string;
}
