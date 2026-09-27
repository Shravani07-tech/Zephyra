/**
 * Browser speech-recognition session with transcript accumulation.
 *
 * Chrome and Edge end a recognition session on their own (after a pause, a
 * network hiccup or an internal time limit), even with `continuous = true`.
 * One listening session therefore spans several recognition runs: finalized
 * text accumulates across restarts, and text still interim when a run ends is
 * kept rather than dropped. Only an explicit user stop submits the transcript;
 * any other ending hands it back for editing instead of sending it.
 */

/** The subset of the Web Speech API recognition object used here. */
export interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

export interface TranscriptState {
  finalText: string;
  interim: string;
}

export const EMPTY_TRANSCRIPT: TranscriptState = { finalText: "", interim: "" };

function joinText(a: string, b: string): string {
  const left = a.trim();
  const right = b.trim();
  if (!left) return right;
  if (!right) return left;
  return `${left} ${right}`;
}

/**
 * Fold one `result` event into the transcript. Results before `resultIndex`
 * were already counted; final ones are appended once, and the interim text is
 * replaced (never appended), so a revised hypothesis cannot duplicate words.
 */
export function applyResults(state: TranscriptState, event: RecognitionResultEvent): TranscriptState {
  let finalText = state.finalText;
  let interim = "";
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    const text = result[0]?.transcript ?? "";
    if (result.isFinal) {
      finalText = joinText(finalText, text);
    } else {
      interim = joinText(interim, text);
    }
  }
  return { finalText, interim };
}

/** A run ended: keep any unfinalized words instead of losing them. */
export function commitInterim(state: TranscriptState): TranscriptState {
  return { finalText: joinText(state.finalText, state.interim), interim: "" };
}

export function displayText(state: TranscriptState): string {
  return joinText(state.finalText, state.interim);
}

const FATAL_ERRORS = new Set([
  "not-allowed",
  "service-not-allowed",
  "audio-capture",
  "language-not-supported",
]);

/** Restart attempts that end within this window without any speech count as failures. */
const RAPID_END_MS = 1000;
const MAX_RAPID_ENDS = 3;
const RESTART_DELAY_MS = 50;

export interface VoiceSessionCallbacks {
  onListeningChange(listening: boolean): void;
  /** Live transcript (final + interim) while listening. */
  onTranscriptChange(text: string): void;
  /** The user stopped listening: the transcript is ready to submit. */
  onFinish(text: string): void;
  /** Listening ended without a user stop: keep the text for editing. */
  onInterrupted(text: string): void;
  onError(message: string): void;
}

export interface VoiceSessionOptions {
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  lang?: string;
}

export interface VoiceSession {
  start(): void;
  /** Explicit user stop: finish and submit the transcript. */
  stop(): void;
  /** Stop without submitting (e.g. conversation switch); text is kept for editing. */
  cancel(): void;
  /** Tear down silently (unmount). No callbacks fire afterwards. */
  dispose(): void;
  isActive(): boolean;
}

type EndMode = "user-stop" | "cancel" | "fatal" | null;

export function createVoiceSession(
  createRecognition: () => RecognitionLike | null,
  callbacks: VoiceSessionCallbacks,
  options: VoiceSessionOptions = {}
): VoiceSession {
  const now = options.now ?? (() => Date.now());
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let recognition: RecognitionLike | null = null;
  let active = false;
  let running = false;
  let disposed = false;
  let endMode: EndMode = null;
  let transcript: TranscriptState = EMPTY_TRANSCRIPT;
  let runStartedAt = 0;
  let runHadResults = false;
  let rapidEnds = 0;
  let restartTimer: unknown = null;

  const clearRestart = () => {
    if (restartTimer !== null) {
      clearTimer(restartTimer);
      restartTimer = null;
    }
  };

  const detach = (rec: RecognitionLike) => {
    rec.onstart = null;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
  };

  const finish = () => {
    clearRestart();
    const mode = endMode;
    const text = displayText(commitInterim(transcript));
    if (recognition) detach(recognition);
    recognition = null;
    active = false;
    running = false;
    endMode = null;
    transcript = EMPTY_TRANSCRIPT;
    if (disposed) return;
    callbacks.onListeningChange(false);
    if (!text) return;
    if (mode === "user-stop") callbacks.onFinish(text);
    else callbacks.onInterrupted(text);
  };

  const runOnce = (rec: RecognitionLike): boolean => {
    try {
      runStartedAt = now();
      runHadResults = false;
      rec.start();
      running = true;
      return true;
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === "InvalidStateError") {
        // Already running: the current run continues.
        running = true;
        return true;
      }
      return false;
    }
  };

  return {
    start() {
      if (active || disposed) return;
      const rec = createRecognition();
      if (!rec) {
        callbacks.onError("Speech recognition is not supported in this browser.");
        return;
      }
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      if (options.lang) rec.lang = options.lang;

      recognition = rec;
      active = true;
      endMode = null;
      transcript = EMPTY_TRANSCRIPT;
      rapidEnds = 0;

      rec.onstart = () => {
        if (recognition !== rec) return;
        callbacks.onListeningChange(true);
      };
      rec.onresult = (event) => {
        if (recognition !== rec) return;
        runHadResults = true;
        transcript = applyResults(transcript, event);
        callbacks.onTranscriptChange(displayText(transcript));
      };
      rec.onerror = (event) => {
        if (recognition !== rec) return;
        if (FATAL_ERRORS.has(event.error)) {
          endMode = "fatal";
          callbacks.onError(`Microphone/Permission Error: ${event.error}`);
        }
        // "no-speech", "network" and "aborted" end the run; onend decides.
      };
      rec.onend = () => {
        if (recognition !== rec) return;
        running = false;
        transcript = commitInterim(transcript);
        if (endMode !== null) {
          finish();
          return;
        }
        // The browser ended the run on its own: keep listening.
        if (!runHadResults && now() - runStartedAt < RAPID_END_MS) {
          rapidEnds += 1;
        } else {
          rapidEnds = 0;
        }
        if (rapidEnds >= MAX_RAPID_ENDS) {
          endMode = "cancel";
          callbacks.onError("Speech recognition keeps stopping. Your words so far were kept.");
          finish();
          return;
        }
        clearRestart();
        restartTimer = setTimer(() => {
          restartTimer = null;
          if (recognition !== rec || endMode !== null) return;
          if (!runOnce(rec)) {
            endMode = "cancel";
            finish();
          }
        }, RESTART_DELAY_MS);
      };

      if (!runOnce(rec)) {
        callbacks.onError("Failed to start speech recognition.");
        recognition = null;
        active = false;
        detach(rec);
      }
    },

    stop() {
      if (!active) return;
      endMode = "user-stop";
      clearRestart();
      if (running && recognition) {
        // stop() lets the browser finalize pending audio; onend then finishes.
        try {
          recognition.stop();
          return;
        } catch {
          // fall through and finish now
        }
      }
      finish();
    },

    cancel() {
      if (!active) return;
      endMode = "cancel";
      clearRestart();
      const rec = recognition;
      finish();
      try {
        rec?.abort();
      } catch {
        // already stopped
      }
    },

    dispose() {
      disposed = true;
      clearRestart();
      const rec = recognition;
      recognition = null;
      active = false;
      running = false;
      if (rec) {
        detach(rec);
        try {
          rec.abort();
        } catch {
          // already stopped
        }
      }
    },

    isActive() {
      return active;
    },
  };
}
