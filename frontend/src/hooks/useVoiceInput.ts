import { useState, useRef, useEffect, useCallback } from "react";

import { createVoiceSession, type RecognitionLike, type VoiceSession } from "./voiceSession";

export interface VoiceInputHandlers {
  /** The user stopped listening: submit this transcript. */
  onTranscript?: (text: string) => void;
  /** Listening ended on its own (error, switch): keep this text for editing. */
  onInterrupted?: (text: string) => void;
  onError?: (errorMsg: string) => void;
}

export function useVoiceInput(handlers: VoiceInputHandlers = {}) {
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");

  // Latest handlers, so a session never calls a stale closure.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const sessionRef = useRef<VoiceSession | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<any>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const volumeIntervalRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopAudioVolume = useCallback(() => {
    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setVolume(0);
  }, []);

  const startAudioVolume = useCallback(async () => {
    // If stream/audio context is already active, don't recreate it to prevent multiple requests
    if (streamRef.current && audioContextRef.current) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;

      volumeIntervalRef.current = setInterval(() => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        // Calculate average volume
        let values = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          values += dataArrayRef.current[i];
        }
        const average = values / dataArrayRef.current.length;
        // Map average volume (0-255) to a scale (0 to 1)
        const mappedVolume = Math.min(1, average / 128);
        setVolume(mappedVolume);
      }, 100);
    } catch (err: any) {
      // The level meter is cosmetic; recognition reports its own mic errors.
      console.warn("Could not start audio context for volume levels:", err);
      stopAudioVolume();
    }
  }, [stopAudioVolume]);

  const getSession = useCallback((): VoiceSession => {
    if (sessionRef.current) return sessionRef.current;
    const session = createVoiceSession(
      () => {
        const SpeechRecognitionAPI =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        return SpeechRecognitionAPI ? (new SpeechRecognitionAPI() as RecognitionLike) : null;
      },
      {
        onListeningChange: (listening) => {
          setIsListening(listening);
          if (listening) {
            startAudioVolume();
          } else {
            stopAudioVolume();
            setLiveTranscript("");
          }
        },
        onTranscriptChange: setLiveTranscript,
        onFinish: (text) => handlersRef.current.onTranscript?.(text),
        onInterrupted: (text) => handlersRef.current.onInterrupted?.(text),
        onError: (message) => {
          console.warn("Speech recognition:", message);
          handlersRef.current.onError?.(message);
        },
      },
      { lang: (typeof navigator !== "undefined" && navigator.language) || "en-US" }
    );
    sessionRef.current = session;
    return session;
  }, [startAudioVolume, stopAudioVolume]);

  const startListening = useCallback(() => getSession().start(), [getSession]);
  const stopListening = useCallback(() => sessionRef.current?.stop(), []);
  /** Stop without submitting; the transcript goes to `onInterrupted`. */
  const cancelListening = useCallback(() => sessionRef.current?.cancel(), []);

  const toggleListening = useCallback(() => {
    const session = getSession();
    if (session.isActive()) {
      session.stop();
    } else {
      session.start();
    }
  }, [getSession]);

  // Clean up on unmount: no restart and no callbacks after this.
  useEffect(() => {
    return () => {
      sessionRef.current?.dispose();
      sessionRef.current = null;
      stopAudioVolume();
    };
  }, [stopAudioVolume]);

  return {
    isListening,
    volume,
    liveTranscript,
    startListening,
    stopListening,
    cancelListening,
    toggleListening,
  };
}
