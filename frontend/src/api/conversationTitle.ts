import type { Conversation } from "./types";

export const UNTITLED_CONVERSATION = "New conversation";

/** User-facing conversation label. The ID is internal and never shown. */
export function conversationTitle(conversation: Pick<Conversation, "title">): string {
  const title = conversation.title?.trim();
  return title ? title : UNTITLED_CONVERSATION;
}
