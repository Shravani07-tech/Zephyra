/**
 * The AWAKENING -> THINKING step runs on a short timer. A turn can finish (or
 * fail, or be stopped) before the timer fires, so the step only applies while
 * the status is still AWAKENING; otherwise a completed turn, or a voice reply
 * being spoken, would be pushed back to THINKING and stay there.
 */
export function advanceToThinking<S extends string>(prev: S): S | "THINKING" {
  return prev === "AWAKENING" ? "THINKING" : prev;
}
