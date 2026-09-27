import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { conversationTitle } from "../src/api/conversationTitle.ts";
import { advanceToThinking } from "../src/hooks/chatStatus.ts";

describe("THINKING timer", () => {
  it("moves AWAKENING to THINKING", () => {
    assert.equal(advanceToThinking("AWAKENING"), "THINKING");
  });

  it("never pulls a finished, failed, stopped or speaking turn back to THINKING", () => {
    for (const status of ["GENERATING", "COMPLETING", "IDLE", "ERROR", "ABORTED", "SPEAKING"]) {
      assert.equal(advanceToThinking(status), status);
    }
  });
});

describe("conversation titles", () => {
  it("shows the semantic title", () => {
    assert.equal(conversationTitle({ title: "DBMS Exam Preparation" }), "DBMS Exam Preparation");
  });

  it("never falls back to a session ID", () => {
    for (const title of [null, undefined, "", "   "]) {
      const label = conversationTitle({ title });
      assert.equal(label, "New conversation");
      assert.doesNotMatch(label, /session_/);
    }
  });
});
