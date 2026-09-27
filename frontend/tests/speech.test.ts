import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { prepareSpeechText } from "../src/hooks/useSpeech.ts";

describe("speech text preparation", () => {
  it("does not read research citation markers aloud", () => {
    const spoken = prepareSpeechText(
      "Revenue grew 6 percent [src-1a2b3c4d]. Services hit a record [src-1a2b3c4d, src-5e6f7a8b]."
    );
    assert.equal(spoken, "Revenue grew 6 percent. Services hit a record.");
  });

  it("keeps ordinary bracketed prose", () => {
    assert.equal(prepareSpeechText("Released in 2024 [beta]."), "Released in 2024 [beta].");
  });
});
