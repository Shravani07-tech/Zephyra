import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Message } from "../src/api/types.ts";
import { findPersistedUserMessage, reconcileUserMessageId } from "../src/hooks/reconcile.ts";

const LOCAL_ID = 1_790_000_000_000; // Date.now()-style optimistic ID

function msg(partial: Partial<Message>): Message {
  return {
    id: 0,
    conversation_id: "c-1",
    role: "user",
    content: "",
    created_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("aborted send reconciliation", () => {
  const view: Message[] = [
    msg({ id: 4, role: "assistant", content: "earlier reply" }),
    msg({ id: LOCAL_ID, conversation_id: "temp", content: "Tell me a story" }),
    msg({ id: LOCAL_ID + 1, role: "assistant", content: "Once upon", isAborted: true, userMessageId: LOCAL_ID }),
  ];

  it("swaps the optimistic ID for the persisted one on the user and partial messages", () => {
    const result = reconcileUserMessageId(view, LOCAL_ID, { id: 5, conversation_id: "c-1" });
    assert.equal(result[1].id, 5);
    assert.equal(result[1].conversation_id, "c-1");
    assert.equal(result[2].userMessageId, 5); // Regenerate now targets message 5
    assert.equal(result[2].isAborted, true); // partial-on-abort preserved
    assert.equal(result[2].content, "Once upon");
    assert.deepEqual(result[0], view[0]);
  });

  it("finds the newest persisted user message with the same text", () => {
    const history = [
      msg({ id: 1, content: "Tell me a story" }),
      msg({ id: 2, role: "assistant", content: "..." }),
      msg({ id: 5, content: "Tell me a story" }),
    ];
    assert.equal(findPersistedUserMessage(history, "Tell me a story")?.id, 5);
    assert.equal(findPersistedUserMessage(history, "something else"), undefined);
  });
});
