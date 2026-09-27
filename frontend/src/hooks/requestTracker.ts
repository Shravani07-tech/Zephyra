/**
 * Tracks which chat request is allowed to update UI state.
 *
 * Every send/retry calls `begin()`; switching conversations or starting a new
 * chat calls `invalidate()`. Callbacks from an older request check
 * `isCurrent(id)` and become no-ops, so a stale stream can never write into the
 * conversation the user has moved to.
 */
export interface RequestTracker {
  begin(): number;
  invalidate(): void;
  isCurrent(id: number): boolean;
}

export function createRequestTracker(): RequestTracker {
  let sequence = 0;
  let current: number | null = null;
  return {
    begin() {
      sequence += 1;
      current = sequence;
      return current;
    },
    invalidate() {
      current = null;
    },
    isCurrent(id: number) {
      return current === id;
    },
  };
}
