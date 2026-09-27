import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSafeHttpUrl, renderableCitations } from "../src/api/citations.ts";
import type { MessageMetadata } from "../src/api/types.ts";

const good = { source_id: "src-1a2b3c4d", title: "Good", url: "https://e.com/a", retrieved_at: "t" };

describe("citation rendering", () => {
  it("renders only server-provided citations", () => {
    const metadata: MessageMetadata = {
      research: { run_id: "r", rejected_markers: 0, citations: [good] },
    };
    assert.deepEqual(renderableCitations(metadata), [good]);
  });

  it("returns nothing without server metadata, whatever the message text says", () => {
    assert.deepEqual(renderableCitations(undefined), []);
    assert.deepEqual(renderableCitations(null), []);
    assert.deepEqual(renderableCitations({}), []);
  });

  it("drops citations with unsafe or malformed urls", () => {
    const metadata = {
      research: {
        run_id: "r",
        rejected_markers: 0,
        citations: [
          good,
          { ...good, source_id: "src-00000001", url: "javascript:alert(1)" },
          { ...good, source_id: "src-00000002", url: "data:text/html,x" },
          { ...good, source_id: "src-00000003", url: "not a url" },
        ],
      },
    } as MessageMetadata;
    assert.deepEqual(renderableCitations(metadata), [good]);
  });

  it("accepts only http and https", () => {
    assert.equal(isSafeHttpUrl("http://e.com"), true);
    assert.equal(isSafeHttpUrl("https://e.com"), true);
    assert.equal(isSafeHttpUrl("ftp://e.com"), false);
    assert.equal(isSafeHttpUrl(42), false);
  });
});
