import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { mockApiClient } from "../src/api/client.ts";
import { MAX_UPLOAD_BYTES, validateAttachment } from "../src/api/files.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("attachment validation", () => {
  it("accepts every supported type within the size limit", () => {
    for (const name of ["a.pdf", "b.TXT", "c.md", "d.csv", "e.docx", "f.xlsx"]) {
      assert.equal(validateAttachment({ name, size: 1024 }), null, name);
    }
  });

  it("rejects unsupported, empty, and oversized files", () => {
    assert.match(validateAttachment({ name: "run.exe", size: 10 }) ?? "", /Unsupported/);
    assert.match(validateAttachment({ name: "notes.pdf.exe", size: 10 }) ?? "", /Unsupported/);
    assert.match(validateAttachment({ name: "a.txt", size: 0 }) ?? "", /empty/);
    assert.match(validateAttachment({ name: "a.pdf", size: MAX_UPLOAD_BYTES + 1 }) ?? "", /10 MB/);
    assert.equal(validateAttachment({ name: "a.pdf", size: MAX_UPLOAD_BYTES }), null);
  });
});

describe("file API client", () => {
  it("uploads as multipart with the conversation id", async () => {
    let sent: FormData | undefined;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      sent = init?.body as FormData;
      return new Response(JSON.stringify({ id: "d1", filename: "a.txt", status: "READY" }), {
        status: 201,
      });
    }) as typeof fetch;

    const doc = await mockApiClient.uploadFile("c-1", new File(["hi"], "a.txt", { type: "text/plain" }));
    assert.equal(doc.id, "d1");
    assert.equal(sent?.get("conversation_id"), "c-1");
    assert.equal((sent?.get("file") as File).name, "a.txt");
  });

  it("surfaces the server's error detail on a failed upload", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ detail: "Failed to process file: corrupt PDF" }), {
        status: 422,
      })) as typeof fetch;

    await assert.rejects(
      mockApiClient.uploadFile("c-1", new File(["x"], "a.pdf")),
      /Failed to process file: corrupt PDF/
    );
  });

  it("creates a conversation with POST", async () => {
    let method: string | undefined;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      method = init?.method;
      return new Response(JSON.stringify({ id: "c-9", created_at: "t" }), { status: 201 });
    }) as typeof fetch;

    assert.equal((await mockApiClient.createConversation()).id, "c-9");
    assert.equal(method, "POST");
  });
});
