import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { mockApiClient, type StreamChatOptions } from "../src/api/client.ts";
import type { ResearchMetadata } from "../src/api/types.ts";

const realFetch = globalThis.fetch;

interface FetchCall {
  body: Record<string, unknown>;
  signal: AbortSignal | null | undefined;
}

function sse(...events: Record<string, unknown>[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
}

/** Serve an SSE body split into small pieces to exercise the line buffer. */
function mockFetch(body: string, calls: FetchCall[]): void {
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push({ body: JSON.parse(String(init?.body)), signal: init?.signal });
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < body.length; i += 7) {
          controller.enqueue(encoder.encode(body.slice(i, i + 7)));
        }
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
  }) as typeof fetch;
}

function recorder(overrides: Partial<StreamChatOptions> = {}) {
  const log = {
    chunks: [] as string[],
    conversations: [] as string[],
    citations: [] as ResearchMetadata[],
    errors: [] as string[],
  };
  const options: StreamChatOptions = {
    conversationId: null,
    text: "hello",
    onChunk: (c) => log.chunks.push(c),
    onConversation: (id) => log.conversations.push(id),
    onCitations: (r) => log.citations.push(r),
    onError: (e) => log.errors.push(e),
    ...overrides,
  };
  return { log, options };
}

const RESEARCH: ResearchMetadata = {
  run_id: "run1",
  rejected_markers: 1,
  citations: [
    { source_id: "src-1a2b3c4d", title: "T", url: "https://e.com/", retrieved_at: "2026-01-01" },
  ],
};

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("sendMessageStream contract", () => {
  it("routes every event to the named callback and passes the abort signal", async () => {
    const calls: FetchCall[] = [];
    mockFetch(
      sse(
        { event: "conversation", conversation_id: "c-1" },
        { event: "chunk", text: "Hi " },
        { event: "chunk", text: "there" },
        { event: "citations", research: RESEARCH },
        { event: "done" }
      ),
      calls
    );
    const controller = new AbortController();
    const { log, options } = recorder({ signal: controller.signal, conversationId: "temp" });

    await mockApiClient.sendMessageStream(options);

    assert.deepEqual(log.conversations, ["c-1"]);
    assert.deepEqual(log.chunks, ["Hi ", "there"]);
    assert.deepEqual(log.citations, [RESEARCH]);
    assert.deepEqual(log.errors, []);
    assert.equal(calls[0].signal, controller.signal);
    assert.deepEqual(calls[0].body, { conversation_id: null, message: "hello" });
  });

  it("sends retry_message_id instead of message text for regenerate", async () => {
    const calls: FetchCall[] = [];
    mockFetch(sse({ event: "done" }), calls);
    const { options } = recorder({ conversationId: "c-9", text: null, retryMessageId: 42 });

    await mockApiClient.sendMessageStream(options);

    assert.deepEqual(calls[0].body, { conversation_id: "c-9", retry_message_id: 42 });
  });

  it("reports a server error event exactly once and rejects", async () => {
    mockFetch(
      sse({ event: "error", code: "RESEARCH_UNAVAILABLE", detail: "Research failed: timeout." }),
      []
    );
    const { log, options } = recorder();

    await assert.rejects(mockApiClient.sendMessageStream(options), /Research failed: timeout\./);
    assert.deepEqual(log.errors, ["Research failed: timeout."]);
  });

  it("treats a stream that ends without done as a failure", async () => {
    mockFetch(sse({ event: "chunk", text: "partial" }), []);
    const { log, options } = recorder();

    await assert.rejects(mockApiClient.sendMessageStream(options), /ended unexpectedly/);
    assert.equal(log.errors.length, 1);
  });

  it("ignores malformed citation payloads", async () => {
    mockFetch(sse({ event: "citations", research: { citations: "nope" } }, { event: "done" }), []);
    const { log, options } = recorder();

    await mockApiClient.sendMessageStream(options);
    assert.deepEqual(log.citations, []);
  });

  it("rejects with AbortError and no error callback when aborted", async () => {
    globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("The operation was aborted.", "AbortError"))
        );
      })) as typeof fetch;
    const controller = new AbortController();
    const { log, options } = recorder({ signal: controller.signal });

    const pending = mockApiClient.sendMessageStream(options);
    controller.abort();

    await assert.rejects(pending, (err: Error) => err.name === "AbortError");
    assert.deepEqual(log.errors, []);
  });
});
