import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EMPTY_TRANSCRIPT,
  applyResults,
  commitInterim,
  createVoiceSession,
  displayText,
  type RecognitionLike,
  type RecognitionResultEvent,
} from "../src/hooks/voiceSession.ts";

function results(list: Array<[string, boolean]>, resultIndex = 0): RecognitionResultEvent {
  return {
    resultIndex,
    results: list.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript } })),
  };
}

class FakeRecognition implements RecognitionLike {
  continuous = false;
  interimResults = false;
  lang = "";
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onresult: ((event: RecognitionResultEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  starts = 0;
  stops = 0;
  aborts = 0;
  start() {
    this.starts += 1;
    this.onstart?.();
  }
  stop() {
    this.stops += 1;
  }
  abort() {
    this.aborts += 1;
  }
  emit(event: RecognitionResultEvent) {
    this.onresult?.(event);
  }
  end() {
    this.onend?.();
  }
}

function harness() {
  const rec = new FakeRecognition();
  let clock = 0;
  const timers: Array<() => void> = [];
  const log = {
    listening: [] as boolean[],
    live: [] as string[],
    finished: [] as string[],
    interrupted: [] as string[],
    errors: [] as string[],
  };
  const session = createVoiceSession(
    () => rec,
    {
      onListeningChange: (v) => log.listening.push(v),
      onTranscriptChange: (t) => log.live.push(t),
      onFinish: (t) => log.finished.push(t),
      onInterrupted: (t) => log.interrupted.push(t),
      onError: (m) => log.errors.push(m),
    },
    {
      now: () => clock,
      setTimer: (fn) => {
        timers.push(fn);
        return timers.length;
      },
      clearTimer: () => {
        timers.length = 0;
      },
    }
  );
  return {
    rec,
    session,
    log,
    advance(ms: number) {
      clock += ms;
    },
    runTimers() {
      const pending = timers.splice(0);
      pending.forEach((fn) => fn());
    },
    pendingTimers: () => timers.length,
  };
}

describe("voice transcript accumulation", () => {
  it("accumulates final results in order", () => {
    let state = applyResults(EMPTY_TRANSCRIPT, results([["Hello Zephyra", true]]));
    state = applyResults(state, results([["Hello Zephyra", true], [" tell me more", true]], 1));
    assert.equal(state.finalText, "Hello Zephyra tell me more");
  });

  it("interim text never overwrites or duplicates final text", () => {
    let state = applyResults(EMPTY_TRANSCRIPT, results([["Hello Zephyra", true]]));
    state = applyResults(state, results([["Hello Zephyra", true], ["tell", false]], 1));
    state = applyResults(state, results([["Hello Zephyra", true], ["tell me what", false]], 1));
    assert.equal(state.finalText, "Hello Zephyra");
    assert.equal(displayText(state), "Hello Zephyra tell me what");
    state = applyResults(state, results([["Hello Zephyra", true], ["tell me what you can do", true]], 1));
    assert.deepEqual(state, { finalText: "Hello Zephyra tell me what you can do", interim: "" });
  });

  it("keeps unfinalized words when a run ends", () => {
    const state = commitInterim({ finalText: "Hello Zephyra", interim: "tell me" });
    assert.deepEqual(state, { finalText: "Hello Zephyra tell me", interim: "" });
  });
});

describe("voice session lifecycle", () => {
  it("restarts after a browser-initiated end without duplicating text", () => {
    const h = harness();
    h.session.start();
    h.rec.emit(results([["Hello Zephyra,", true]]));
    h.advance(3000);
    h.rec.end(); // the browser ends the run after a pause
    h.runTimers();
    assert.equal(h.rec.starts, 2);
    // A new run reports its results from index 0 again.
    h.rec.emit(results([["tell me what you can help me with today.", true]]));
    h.session.stop();
    h.rec.end();
    assert.deepEqual(h.log.finished, [
      "Hello Zephyra, tell me what you can help me with today.",
    ]);
    assert.deepEqual(h.log.interrupted, []);
  });

  it("an interim phrase pending at a run's end survives the restart", () => {
    const h = harness();
    h.session.start();
    h.rec.emit(results([["Hello Zephyra", true], ["tell me", false]]));
    h.advance(2000);
    h.rec.end();
    h.runTimers();
    h.rec.emit(results([["a joke", true]]));
    h.session.stop();
    h.rec.end();
    assert.deepEqual(h.log.finished, ["Hello Zephyra tell me a joke"]);
  });

  it("explicit stop prevents any restart", () => {
    const h = harness();
    h.session.start();
    h.rec.emit(results([["Hello", true]]));
    h.session.stop();
    assert.equal(h.rec.stops, 1);
    h.rec.end();
    h.runTimers();
    assert.equal(h.rec.starts, 1);
    assert.equal(h.session.isActive(), false);
    assert.deepEqual(h.log.listening, [true, false]);
  });

  it("stop during a pending restart finishes immediately without restarting", () => {
    const h = harness();
    h.session.start();
    h.rec.emit(results([["Hello", true]]));
    h.advance(2000);
    h.rec.end();
    assert.equal(h.pendingTimers(), 1);
    h.session.stop();
    h.runTimers();
    assert.equal(h.rec.starts, 1);
    assert.deepEqual(h.log.finished, ["Hello"]);
  });

  it("dispose (unmount) prevents restarts and further callbacks", () => {
    const h = harness();
    h.session.start();
    h.rec.emit(results([["Hello", true]]));
    h.session.dispose();
    h.rec.end();
    h.runTimers();
    assert.equal(h.rec.starts, 1);
    assert.equal(h.rec.aborts, 1);
    assert.deepEqual(h.log.finished, []);
    assert.deepEqual(h.log.interrupted, []);
  });

  it("a fatal error stops listening and keeps the text for editing instead of sending", () => {
    const h = harness();
    h.session.start();
    h.rec.emit(results([["Hello Zephyra", true]]));
    h.rec.onerror?.({ error: "audio-capture" });
    h.rec.end();
    h.runTimers();
    assert.equal(h.rec.starts, 1);
    assert.deepEqual(h.log.finished, []);
    assert.deepEqual(h.log.interrupted, ["Hello Zephyra"]);
    assert.equal(h.log.errors.length, 1);
  });

  it("cancel (conversation switch) never submits", () => {
    const h = harness();
    h.session.start();
    h.rec.emit(results([["half a sentence", false]]));
    h.session.cancel();
    h.runTimers();
    assert.deepEqual(h.log.finished, []);
    assert.deepEqual(h.log.interrupted, ["half a sentence"]);
    assert.equal(h.session.isActive(), false);
  });

  it("stops instead of looping when runs keep ending immediately", () => {
    const h = harness();
    h.session.start();
    for (let i = 0; i < 5; i++) {
      h.rec.onerror?.({ error: "network" });
      h.rec.end();
      h.runTimers();
    }
    assert.equal(h.rec.starts, 3);
    assert.equal(h.session.isActive(), false);
    assert.equal(h.log.errors.length, 1);
  });

  it("starting while already listening does not open a second session", () => {
    const h = harness();
    h.session.start();
    h.session.start();
    assert.equal(h.rec.starts, 1);
  });
});
