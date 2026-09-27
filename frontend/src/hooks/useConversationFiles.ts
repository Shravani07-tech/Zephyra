import { useEffect, useRef, useState } from "react";

import { mockApiClient } from "../api/client";
import { validateAttachment } from "../api/files";
import type { UploadedFile } from "../api/types";

/**
 * Files attached to the active conversation.
 *
 * List loads are sequenced so only the newest one applies, and results for a
 * conversation the user has since left are dropped.
 */
export function useConversationFiles(
  conversationId: string | null,
  ensureConversation: () => Promise<string>
) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentConversationRef = useRef<string | null>(conversationId);
  const loadSeqRef = useRef(0);

  const reload = async (targetId: string) => {
    const seq = ++loadSeqRef.current;
    try {
      const list = await mockApiClient.listFiles(targetId);
      if (seq === loadSeqRef.current && currentConversationRef.current === targetId) {
        setFiles(list);
      }
    } catch (e) {
      console.warn("Failed to load files", e);
    }
  };

  useEffect(() => {
    currentConversationRef.current = conversationId;
    setError(null);
    if (!conversationId) {
      loadSeqRef.current++;
      setFiles([]);
      return;
    }
    reload(conversationId);
  }, [conversationId]);

  const upload = async (file: File) => {
    const problem = validateAttachment(file);
    if (problem) {
      setError(problem);
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const targetId = await ensureConversation();
      currentConversationRef.current = targetId;
      await mockApiClient.uploadFile(targetId, file);
      await reload(targetId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const remove = async (documentId: string) => {
    const targetId = currentConversationRef.current;
    setError(null);
    try {
      await mockApiClient.deleteFile(documentId);
      if (targetId) await reload(targetId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove the file.");
    }
  };

  return { files, isUploading, error, upload, remove };
}
