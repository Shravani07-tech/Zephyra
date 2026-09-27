import type { Citation, MessageMetadata } from "./types";

/** Only http(s) links are ever rendered as clickable citations. */
export function isSafeHttpUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Citations to display for a message. They come only from server-built
 * metadata; bracketed markers in the message text are never interpreted.
 */
export function renderableCitations(metadata: MessageMetadata | null | undefined): Citation[] {
  const citations = metadata?.research?.citations;
  if (!Array.isArray(citations)) return [];
  return citations.filter(
    (c) => c && typeof c.source_id === "string" && typeof c.title === "string" && isSafeHttpUrl(c.url)
  );
}
