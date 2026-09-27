import type { Message } from "../api/types";

/**
 * Replace a client-only user message ID with the ID the server persisted.
 *
 * An aborted send never refetches history, so the optimistic user message (and
 * any partial assistant reply pointing at it) keeps a local ID that the server
 * does not know. Regenerate must target the persisted ID.
 */
export function reconcileUserMessageId(
  messages: Message[],
  localId: number,
  persisted: Pick<Message, "id" | "conversation_id">
): Message[] {
  return messages.map((m) => {
    if (m.id === localId && m.role === "user") {
      return { ...m, id: persisted.id, conversation_id: persisted.conversation_id };
    }
    if (m.userMessageId === localId) {
      return { ...m, userMessageId: persisted.id };
    }
    return m;
  });
}

/** The persisted user message matching an optimistic one, newest first. */
export function findPersistedUserMessage(history: Message[], content: string): Message | undefined {
  return history.findLast((m) => m.role === "user" && m.content === content);
}
