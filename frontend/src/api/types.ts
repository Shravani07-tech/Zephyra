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

/** A document attached to a conversation for File Assistant questions. */
export interface UploadedFile {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  status: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  created_at: string;
  /** Semantic title from the first meaningful message; null until there is one. */
  title?: string | null;
}
