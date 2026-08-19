import { useState, useRef, useEffect, useCallback } from "react";

export function useVoiceInput(
  onTranscript?: (text: string) => void,
  onError?: (errorMsg: string) => void
) {
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);

  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);
  const restartTimeoutRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<any>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const volumeIntervalRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Accumulate transcript segments
  const finalTranscriptRef = useRef<string>("");

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
      console.warn("Could not start audio context for volume levels:", err);
      setVolume(0);
      const errMsg = err.message || "Microphone access denied or unavailable.";
      onError?.(errMsg);
      // Disable listening state
      shouldListenRef.current = false;
      setIsListening(false);
      stopAudioVolume();
    }
  }, [onError, stopAudioVolume]);

  const getRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current;

    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return null;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    
    const browserLang = typeof navigator !== "undefined" ? navigator.language : "en-US";
    recognition.lang = browserLang || "en-US";

    recognitionRef.current = recognition;
    return recognition;
  }, []);

  const startListening = useCallback(() => {
    // Prevent starting loops or race states
    shouldListenRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    const recognition = getRecognition();
    if (!recognition) {
      const errMsg = "Speech recognition is not supported in this browser.";
      console.warn(errMsg);
      onError?.(errMsg);
      setIsListening(false);
      return;
    }

    // Abort previous session if any to ensure clean restart
    try {
      recognition.abort();
    } catch {}

    finalTranscriptRef.current = "";
    shouldListenRef.current = true;

    recognition.onstart = () => {
      setIsListening(true);
      startAudioVolume();
    };

    recognition.onresult = (event: any) => {
      let localFinalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          localFinalTranscript += result[0].transcript;
        }
      }
      if (localFinalTranscript) {
        finalTranscriptRef.current += localFinalTranscript;
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("SpeechRecognition error event:", event.error);
      const fatalErrors = ["not-allowed", "service-not-allowed", "audio-capture"];
      if (fatalErrors.includes(event.error)) {
        shouldListenRef.current = false;
        setIsListening(false);
        stopAudioVolume();
        onError?.(`Microphone/Permission Error: ${event.error}`);
      } else if (event.error === "no-speech") {
        // Suppress permanent stop on no-speech; we let the end handler auto-restart
        console.log("SpeechRecognition: no-speech. Auto-restart handles this onend.");
      }
    };

    recognition.onend = () => {
      if (!isMountedRef.current) return;
      if (shouldListenRef.current) {
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
        }
        restartTimeoutRef.current = setTimeout(() => {
          if (shouldListenRef.current && isMountedRef.current) {
            try {
              recognition.start();
            } catch (e: any) {
              // Ignore already-started state errors gracefully
              if (e.name !== "InvalidStateError") {
                console.warn("SpeechRecognition failed to auto-restart:", e);
              }
            }
          }
        }, 200);
      } else {
        setIsListening(false);
        stopAudioVolume();

        // Fire transcript callback with accumulated final transcript upon intentional stop
        const resultText = finalTranscriptRef.current.trim();
        if (onTranscript && resultText) {
          onTranscript(resultText);
        }
        
        // Reset buffer
        finalTranscriptRef.current = "";
      }
    };

    try {
      recognition.start();
    } catch (err: any) {
      if (err.name !== "InvalidStateError") {
        console.error("SpeechRecognition start error:", err);
        onError?.(err.message || "Failed to start speech recognition.");
        setIsListening(false);
      }
    }
  }, [getRecognition, startAudioVolume, stopAudioVolume, onError, onTranscript]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {}
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (shouldListenRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  // Clean up on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      shouldListenRef.current = false;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      const recognition = recognitionRef.current;
      if (recognition) {
        try {
          recognition.abort();
        } catch {}
      }
      stopAudioVolume();
    };
  }, [stopAudioVolume]);

  return {
    isListening,
    volume,
    startListening,
    stopListening,
    toggleListening,
  };
}
