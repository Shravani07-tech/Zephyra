import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRequestTracker } from "../src/hooks/requestTracker.ts";

describe("request tracker", () => {
  it("only the latest request is current", () => {
    const tracker = createRequestTracker();
    const first = tracker.begin();
    const second = tracker.begin();
    assert.equal(tracker.isCurrent(first), false);
    assert.equal(tracker.isCurrent(second), true);
  });

  it("conversation switch / New Chat invalidates the in-flight request", () => {
    const tracker = createRequestTracker();
    const inFlight = tracker.begin();
    tracker.invalidate();
    assert.equal(tracker.isCurrent(inFlight), false);
  });

  it("a stale stream cannot mutate the newly selected conversation", () => {
    // Mirrors useChatStream: every state write is guarded by isCurrent(id).
    const tracker = createRequestTracker();
    const view = { conversation: "A", messages: ["a1"] };
    const staleId = tracker.begin();

    tracker.invalidate(); // user switches to conversation B
    view.conversation = "B";
    view.messages = ["b1"];
    const freshId = tracker.begin();

    const applyIfCurrent = (id: number, messages: string[]) => {
      if (tracker.isCurrent(id)) view.messages = messages;
    };
    applyIfCurrent(staleId, ["a1", "a2 (late reply)"]);
    assert.deepEqual(view.messages, ["b1"]);

    applyIfCurrent(freshId, ["b1", "b2"]);
    assert.deepEqual(view.messages, ["b1", "b2"]);
  });

  it("request ids never repeat, even within the same millisecond", () => {
    const tracker = createRequestTracker();
    const ids = new Set(Array.from({ length: 100 }, () => tracker.begin()));
    assert.equal(ids.size, 100);
  });
});
